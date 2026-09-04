#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Command, InvalidArgumentError, Option } from "commander";
import { chromium } from "playwright";
import sharp from "sharp";

import { auditBoxSnapshot, syncBox } from "./lib/box.mjs";
import { prepareFavicon } from "./lib/favicon.mjs";
import { checkTranslations } from "./lib/i18n.mjs";
import { defaultParameters, imageStatus, optimizeImages } from "./lib/images.mjs";
import {
  exists,
  hugo,
  hugoPath,
  packageExecutable,
  projectRoot,
  run,
  SiteError,
  spawnManaged,
  withTemporaryDirectory,
} from "./lib/project.mjs";
import { auditMarkdownImages, auditOutput, updateBaselines } from "./lib/site-audit.mjs";
import { prepareSocialCard } from "./lib/social-card.mjs";
import { syncZotero } from "./lib/zotero.mjs";

function numericValue(label, { integer = false, minimum = 0, maximum = Infinity, exclusiveMinimum = false } = {}) {
  return (raw) => {
    const value = Number(raw);
    const belowMinimum = exclusiveMinimum ? value <= minimum : value < minimum;
    if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || belowMinimum || value > maximum) {
      const range =
        maximum === Infinity
          ? `${exclusiveMinimum ? "greater than" : "at least"} ${minimum}`
          : `${exclusiveMinimum ? "greater than" : "at least"} ${minimum} and at most ${maximum}`;
      throw new InvalidArgumentError(`${label} must be ${integer ? "an integer" : "a number"} ${range}.`);
    }
    return value;
  };
}

const positiveInteger = (label) => numericValue(label, { integer: true, exclusiveMinimum: true });
const nonnegativeNumber = (label) => numericValue(label);
const portNumber = numericValue("port", { integer: true, minimum: 0, maximum: 65_535, exclusiveMinimum: true });

export function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function commandStart({
  port = 1313,
  publishedOnly = false,
  liveReload = true,
  imageLab = false,
  environment,
  baseUrl,
  landingPath = "/",
} = {}) {
  const args = ["server", "--bind", "127.0.0.1", "--port", String(port), "--disableFastRender"];
  if (!publishedOnly) args.push("--buildDrafts", "--buildFuture");
  if (!liveReload) args.push("--disableLiveReload");
  const hugoEnvironment = imageLab ? "image-quality" : (environment ?? (publishedOnly ? "production" : undefined));
  if (hugoEnvironment) args.push("--environment", hugoEnvironment);
  if (baseUrl) args.push("--baseURL", baseUrl);

  const url = `http://127.0.0.1:${port}${landingPath}`;
  console.log(`Starting the site at ${url}`);
  console.log("Press Ctrl+C to stop.\n");
  const child = spawnManaged(hugoPath, args);
  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  const interrupt = () => forward("SIGINT");
  const terminate = () => forward("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    await new Promise((resolve, reject) => {
      child.once("error", (error) => reject(new SiteError(`Could not start Hugo: ${error.message}`, { cause: error })));
      child.once("exit", (code, signal) => {
        if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolve();
        else reject(new SiteError(`Preview stopped unexpectedly (exit ${code ?? signal}).`));
      });
    });
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}

async function commandNew(title, { slug = slugify(title), date = localDate() } = {}) {
  await createArticle({ title, slug, date });
  console.log(`Created content/posts/${slug}/index.md`);
  console.log("It is a draft and will not appear on the public site until draft: true is removed.");
}

export async function createArticle({ title, slug = slugify(title), date = localDate(), root = projectRoot }) {
  if (!title) throw new SiteError("An article title is required.");
  if (!slug || slug !== slugify(slug))
    throw new SiteError("The slug must contain lowercase words separated by hyphens.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new SiteError("The date must use YYYY-MM-DD.");
  const directory = path.join(root, "content/posts", slug);
  const file = path.join(directory, "index.md");
  if (await exists(file)) throw new SiteError(`An article already exists at content/posts/${slug}/index.md.`);
  await mkdir(directory, { recursive: true });
  await writeFile(
    file,
    `---\ntitle: ${JSON.stringify(title)}\ndescription: "Add a one- or two-sentence summary."\ndate: ${date}\ndraft: true\ntags: []\n---\n\nWrite the opening paragraph here.\n\n## First section\n\nContinue the article here.\n`,
  );
  return file;
}

async function commandImages({ check = false, force = false, format = "avif", target = 0.92, width = 800 } = {}) {
  const options = { force, format, target, width };
  if (check) {
    const status = await imageStatus({ ...options, qualities: defaultParameters.qualities });
    console.log(
      `${status.images.size} source image(s): ${status.cached.length} ready, ${status.stale.length} need optimization.`,
    );
    for (const image of status.stale) console.log(`  needs optimization: ${image}`);
    for (const image of status.dropped) console.log(`  no longer present: ${image}`);
    if (status.stale.length || status.dropped.length || status.staleParameters) {
      throw new SiteError("Image data needs to be refreshed with: npm run site -- images");
    }
    return;
  }
  await optimizeImages(options);
}

async function buildTo(destination, { drafts = false, baseUrl, production = false } = {}) {
  const args = ["--destination", destination, "--cleanDestinationDir", "--printPathWarnings", "--printI18nWarnings"];
  if (drafts) args.push("--buildDrafts", "--buildFuture");
  if (production) args.push("--gc", "--minify", "--environment", "production");
  if (baseUrl) args.push("--baseURL", baseUrl);
  await hugo(args);
}

async function prepareInputs({ check }) {
  await auditMarkdownImages();
  await auditBoxSnapshot();
  await prepareSocialCard({ check });
  await prepareFavicon({ check });
}

async function commandCheck({ strictImages = false } = {}) {
  console.log("Checking translations...");
  await checkTranslations({ quiet: true });
  console.log("Translations are complete.");
  await prepareInputs({ check: true });
  const imageState = await imageStatus();
  if (imageState.stale.length || imageState.dropped.length || imageState.staleParameters) {
    const message = `${imageState.stale.length} image(s) need optimization${imageState.dropped.length ? ` and ${imageState.dropped.length} old entry/entries can be removed` : ""}.`;
    if (strictImages) throw new SiteError(`${message} Run: npm run site -- images`);
    console.warn(`Note: ${message} The production build will refresh them automatically.`);
  } else {
    console.log(`Images are ready (${imageState.cached.length} cached measurements).`);
  }

  await withTemporaryDirectory("emily-check-", async (destination) => {
    console.log("Checking a complete build, including drafts...");
    await buildTo(destination, { drafts: true });
    console.log("Checking development exercises...");
    await run("python3", [path.join(projectRoot, "tools/check-exercises.py")], {
      env: { ...process.env, HUGO_BIN: hugoPath },
    });
    console.log("Auditing a production artifact...");
    await buildTo(destination, { production: true, baseUrl: "https://emilycdecker.com/" });
    await auditOutput({ output: destination });
  });
  console.log("All checks passed.");
}

async function commandBuild({ baseUrl, skipImages = false } = {}) {
  if (!skipImages) {
    console.log("Preparing images...");
    await optimizeImages();
  }
  await prepareInputs({ check: false });
  console.log("Building the production site...");
  const output = path.join(projectRoot, "public");
  await buildTo(output, { baseUrl, production: true });
  await auditOutput({ output });
  console.log("Production site written to public/.");
}

async function commandBaselines() {
  await prepareInputs({ check: true });
  await withTemporaryDirectory("emily-baselines-", async (destination) => {
    await buildTo(destination, { production: true, baseUrl: "https://emilycdecker.com/" });
    const baseline = await updateBaselines({ output: destination });
    console.log(
      `Recorded ${Object.keys(baseline.routes).length} preserved HTML route(s) in tools/site-baselines.json.`,
    );
  });
}

async function commandDoctor() {
  const packageMetadata = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
  const expectedNode = packageMetadata.engines.node;
  const expectedHugo = packageMetadata["hugo-bin"].hugoVersion;
  const checks = [[process.versions.node === expectedNode, "Node", process.version, `Install Node ${expectedNode}.`]];
  try {
    const result = await hugo(["version"], { capture: true });
    checks.push([result.stdout.includes(`v${expectedHugo}`), "Hugo", result.stdout.trim(), "Run npm install again."]);
  } catch (error) {
    checks.push([false, "Hugo", error.message, "Run npm install again."]);
  }
  checks.push([
    Boolean(sharp.versions?.vips),
    "Image tools",
    `Sharp/libvips ${sharp.versions?.vips || "missing"}`,
    "Run npm install again.",
  ]);
  const browserInstalled = await exists(chromium.executablePath());
  checks.push([
    browserInstalled,
    "Browser audit",
    browserInstalled ? "Chromium installed" : "optional; not installed",
    "Run npm run site -- setup --audit.",
  ]);

  let failures = 0;
  for (const [ready, name, detail, remedy] of checks) {
    console.log(`${ready ? "✓" : name === "Browser audit" ? "○" : "✗"} ${name}: ${detail}`);
    if (!ready && name !== "Browser audit") {
      failures += 1;
      console.log(`  ${remedy}`);
    }
  }
  console.log(
    failures ? "\nThe core setup needs attention." : "\nThe project is ready. Start it with: npm run site -- start",
  );
  if (failures) throw new SiteError(`${failures} required setup check(s) failed.`);
}

async function commandSetup() {
  console.log("Installing Chromium for browser audits...");
  await run(packageExecutable("playwright"), ["install", "chromium"]);
  console.log("Browser audit support is ready.");
}

async function commandAudit(options) {
  if (options.name && !options.url) throw new SiteError("--name can only be used with --url.");
  if (!(await exists(chromium.executablePath()))) {
    throw new SiteError("The audit browser is not installed. Run: npm run site -- setup --audit");
  }
  const { captureLoadStates } = await import("./capture-load-states.mjs");
  await captureLoadStates(options);
}

async function commandSprites(source, destination) {
  const args = source
    ? [source, ...(destination ? [destination] : [])]
    : [
        path.join(projectRoot, "assets/images/lemur-sprite-sheet.png"),
        path.join(projectRoot, "assets/images/lemur-sprites"),
      ];
  await run("bash", [path.join(projectRoot, "tools/generate-lemur-sprites.sh"), ...args]);
}

async function commandFonts({ setup = false, check = false } = {}) {
  const virtualPython = path.join(
    projectRoot,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  if (setup) {
    console.log("Installing the optional font-generation requirements...");
    await run("python3", ["-m", "venv", path.join(projectRoot, ".venv")]);
    await run(virtualPython, ["-m", "pip", "install", "fonttools", "brotli"]);
    return;
  }
  if (!(await exists(virtualPython))) {
    throw new SiteError("Font tools are not installed. Run: npm run site -- assets fonts --setup");
  }
  console.log("Regenerating the optimized heading fonts...");
  await run(virtualPython, [path.join(projectRoot, "tools/subset-fonts.py"), ...(check ? ["--check"] : [])]);
}

async function commandFormat() {
  await run(packageExecutable("biome"), ["check", "--write", "tools"]);
}

async function commandTest() {
  await run(packageExecutable("biome"), ["check", "tools"]);
  await run(process.execPath, [path.join(projectRoot, "tools/site.test.mjs")]);
}

function addPreviewOptions(command) {
  return command
    .option("--port <port>", "local server port", portNumber, 1313)
    .option("--no-live-reload", "disable Hugo's live-reload client")
    .option("--base-url <url>", "override Hugo's base URL");
}

export function themePreviewOptions(options) {
  return {
    ...options,
    publishedOnly: true,
    environment: "development",
    landingPath: "/exercises/",
  };
}

export function createSiteProgram({ writeOut, writeErr } = {}) {
  const program = new Command()
    .name("npm run site --")
    .description("Build, check, and maintain the Emily Decker site.")
    .helpCommand("help [command]", "Show help for a command")
    .showHelpAfterError("Run the command with --help for usage.")
    .exitOverride();
  if (writeOut || writeErr) {
    program.configureOutput({
      ...(writeOut ? { writeOut } : {}),
      ...(writeErr ? { writeErr } : {}),
    });
  }

  program.commandsGroup("Everyday commands:");
  addPreviewOptions(
    program
      .command("start")
      .summary("Preview the site, including drafts")
      .description("Preview the site locally, including drafts and future content by default.")
      .option("--published-only", "exclude draft and future content")
      .addOption(new Option("--image-lab", "enable the image-quality laboratory").conflicts("environment"))
      .option("--environment <name>", "select a Hugo environment"),
  ).action(commandStart);

  addPreviewOptions(
    program
      .command("theme")
      .summary("Preview the published Folio homepage")
      .description("Preview the development-only Folio theme exercise."),
  ).action((options) => commandStart(themePreviewOptions(options)));

  program
    .command("test")
    .summary("Run JavaScript checks and automated tests")
    .description("Check JavaScript formatting and lint rules, then run the automated tests.")
    .action(commandTest);

  program
    .command("new")
    .summary("Create a draft article folder")
    .description("Create a safe draft page bundle for a new article.")
    .argument("<title>", "article title")
    .option("--slug <slug>", "override the generated article slug")
    .option("--date <date>", "publication date in YYYY-MM-DD format")
    .action(commandNew);

  program
    .command("check")
    .summary("Check content, translations, images, and the build")
    .description("Run content checks and audit a complete temporary site build.")
    .option("--strict-images", "fail instead of warning when image measurements are stale")
    .action(commandCheck);

  program
    .command("build")
    .summary("Optimize images and make a production build")
    .description("Prepare inputs, build the production site, and audit the artifact.")
    .option("--base-url <url>", "override Hugo's base URL")
    .option("--skip-images", "do not refresh image measurements")
    .action(commandBuild);

  program
    .command("images")
    .summary("Optimize source images")
    .description("Optimize new or changed source images, or check their cached measurements.")
    .option("--check", "report stale measurements without writing")
    .option("--force", "remeasure every source image")
    .addOption(new Option("--format <format>", "output format").choices(["avif", "webp", "both"]).default("avif"))
    .option(
      "--target <score>",
      "minimum SSIM score",
      numericValue("target", { minimum: 0, maximum: 1, exclusiveMinimum: true }),
      0.92,
    )
    .option("--width <pixels>", "measurement width", positiveInteger("width"), 800)
    .action(commandImages);

  program
    .command("doctor")
    .summary("Report whether the checkout is ready")
    .description("Check the required runtime, Hugo, image tools, and optional audit browser.")
    .action(commandDoctor);

  program.commandsGroup("Optional and advanced commands:");
  program
    .command("format")
    .summary("Format and safely fix JavaScript tools")
    .description("Apply Biome formatting, import organization, and safe lint fixes to tools/.")
    .action(commandFormat);

  const setup = program
    .command("setup")
    .summary("Install optional project tooling")
    .description("Core setup is completed by npm install; --audit installs the optional Chromium browser.")
    .option("--audit", "install Chromium for browser audits");
  setup.action(async (options) => {
    if (!options.audit) setup.outputHelp();
    else await commandSetup();
  });

  program
    .command("audit")
    .summary("Capture slow-network loading states")
    .description("Capture compositor frames and correlate them with browser layout events.")
    .option("--url <url>", "capture one already-running site")
    .option("--name <name>", "name for a capture made with --url")
    .option("--path <path>", "page path when managing Hugo", "/")
    .option("--output <directory>", "artifact directory", "artifacts/load-states")
    .option("--latency-ms <milliseconds>", "delay applied to responses", nonnegativeNumber("latency"), 300)
    .option(
      "--download-kbps <kilobits>",
      "per-response transfer rate; zero disables throttling",
      nonnegativeNumber("download rate"),
      250,
    )
    .option("--font-delay-ms <milliseconds>", "additional font response delay", nonnegativeNumber("font delay"), 250)
    .option("--settle-ms <milliseconds>", "recording time after load", nonnegativeNumber("settle time"), 1800)
    .option("--width <pixels>", "viewport width", positiveInteger("width"), 1440)
    .option("--height <pixels>", "viewport height", positiveInteger("height"), 1000)
    .option("--with-live-reload", "include Hugo's injected live-reload client")
    .action(commandAudit);

  const baselines = program
    .command("baselines")
    .summary("Update route preservation and byte ceilings")
    .description("Accept new HTML routes and refresh ceilings without deleting preserved routes.")
    .option("--update", "write the refreshed route baseline");
  baselines.action(async (options) => {
    if (!options.update) baselines.outputHelp();
    else await commandBaselines();
  });

  const sync = program
    .command("sync")
    .summary("Refresh an offline authoring snapshot")
    .description("Refresh a reviewed, checked-in authoring snapshot from an external source.");
  sync.action(() => sync.outputHelp());
  sync.command("box").description("Refresh referenced Box files.").action(syncBox);
  sync.command("zotero").description("Refresh CSL-JSON data from Zotero.").action(syncZotero);

  const assets = program
    .command("assets")
    .summary("Regenerate advanced design assets")
    .description("Regenerate optional design assets that are not needed for everyday publishing.");
  assets.action(() => assets.outputHelp());
  assets
    .command("sprites [source] [destination]")
    .description("Regenerate the lemur sprite assets.")
    .action(commandSprites);
  assets
    .command("fonts")
    .description("Regenerate the optimized heading fonts.")
    .addOption(new Option("--setup", "install font-generation requirements").conflicts("check"))
    .addOption(new Option("--check", "verify the committed fonts without writing").conflicts("setup"))
    .action(commandFonts);

  program.addHelpText(
    "after",
    `
Examples:
  npm run site -- start
  npm run site -- new "Garden field notes"
  npm run site -- check
  npm run site -- build --base-url https://example.com/
  npm run site -- images --check

Run a command with --help for its options.`,
  );
  return program;
}

export async function main(argv = process.argv.slice(2), output = {}) {
  const program = createSiteProgram(output);
  try {
    await program.parseAsync(argv.length ? argv : ["help"], { from: "user" });
  } catch (error) {
    if (String(error.code).startsWith("commander.") && error.exitCode === 0) return;
    throw error;
  }
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    if (String(error.code).startsWith("commander.")) {
      process.exitCode = error.exitCode || 1;
    } else {
      if (process.env.SITE_DEBUG) console.error(error.stack || error);
      else console.error(`Error: ${error.message || error}`);
      process.exitCode = error.exitCode || 1;
    }
  });
}
