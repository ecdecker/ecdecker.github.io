#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { chromium } from "playwright";

import { checkTranslations } from "./lib/i18n.mjs";
import { defaultParameters, imageStatus, optimizeImages } from "./lib/images.mjs";
import {
  exists,
  hugo,
  hugoPath,
  projectRoot,
  run,
  SiteError,
  spawnManaged,
} from "./lib/project.mjs";

const help = `
Emily site tools

Usage:
  npm run site -- <command> [options]

Everyday commands:
  start                 Preview the site, including drafts
  new "Article title"   Create a draft article folder
  check                 Check content, translations, images, and the build
  build                 Optimize changed images and make a production build
  images                Optimize new or changed source images
  doctor                Explain whether the project is ready to use
  help                  Show this capability list

Optional and advanced commands:
  setup --audit         Install Chromium for the browser audit
  audit [options]       Capture the site's slow-network loading states
  assets sprites        Regenerate the lemur sprite assets
  assets fonts          Regenerate the optimized heading fonts

Examples:
  npm run site -- start
  npm run site -- new "Garden field notes"
  npm run site -- check
  npm run site -- build --base-url https://example.com/
  npm run site -- images --check

Run a command with --help for its options.
`.trim();

function optionValue(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new SiteError(`${name} needs a value.`);
  return value;
}

function numberOption(args, name, fallback) {
  const raw = optionValue(args, name, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new SiteError(`${name} must be a positive number.`);
  return value;
}

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

async function commandStart(args) {
  if (args.includes("--help")) {
    console.log("Usage: npm run site -- start [--port 1313] [--published-only] [--no-live-reload] [--image-lab] [--environment NAME] [--base-url URL]");
    return;
  }
  const port = numberOption(args, "--port", 1313);
  const command = [
    "server",
    "--bind", "127.0.0.1",
    "--port", String(port),
    "--disableFastRender",
  ];
  if (!args.includes("--published-only")) command.push("--buildDrafts", "--buildFuture");
  if (args.includes("--no-live-reload")) command.push("--disableLiveReload");
  const environment = args.includes("--image-lab") ? "image-quality" : optionValue(args, "--environment");
  const baseUrl = optionValue(args, "--base-url");
  if (environment) command.push("--environment", environment);
  if (baseUrl) command.push("--baseURL", baseUrl);
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Starting the site at ${url}`);
  console.log("Press Ctrl+C to stop.\n");
  const child = spawnManaged(hugoPath, command);
  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.once("SIGINT", () => forward("SIGINT"));
  process.once("SIGTERM", () => forward("SIGTERM"));
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolve();
      else reject(new SiteError(`Preview stopped unexpectedly (exit ${code ?? signal}).`));
    });
  });
}

async function commandNew(args) {
  if (args.includes("--help")) {
    console.log('Usage: npm run site -- new "Article title" [--slug article-name] [--date YYYY-MM-DD]');
    return;
  }
  const title = args.find((argument, index) => !argument.startsWith("--") && args[index - 1] !== "--slug" && args[index - 1] !== "--date");
  if (!title) throw new SiteError('Give the article a title, for example: npm run site -- new "Garden field notes"');
  const slug = optionValue(args, "--slug", slugify(title));
  if (!slug || slug !== slugify(slug)) throw new SiteError("The slug must contain lowercase words separated by hyphens.");
  const date = optionValue(args, "--date", localDate());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new SiteError("The date must use YYYY-MM-DD.");
  const file = await createArticle({ title, slug, date });
  console.log(`Created ${path.relative(projectRoot, file).split(path.sep).join("/")}`);
  console.log("It is a draft and will not appear on the public site until draft: true is removed.");
}

export async function createArticle({ title, slug = slugify(title), date = localDate(), root = projectRoot }) {
  if (!title) throw new SiteError("An article title is required.");
  if (!slug || slug !== slugify(slug)) throw new SiteError("The slug must contain lowercase words separated by hyphens.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new SiteError("The date must use YYYY-MM-DD.");
  const directory = path.join(root, "content/posts", slug);
  const file = path.join(directory, "index.md");
  if (await exists(file)) throw new SiteError(`An article already exists at content/posts/${slug}/index.md.`);
  await mkdir(directory, { recursive: true });
  const safeTitle = title.replaceAll('"', '\\"');
  await writeFile(file, `---
title: "${safeTitle}"
description: "Add a one- or two-sentence summary."
date: ${date}
draft: true
tags: []
---

Write the opening paragraph here.

## First section

Continue the article here.
`);
  return file;
}

async function commandImages(args) {
  if (args.includes("--help")) {
    console.log("Usage: npm run site -- images [--check] [--force] [--format avif|webp|both] [--target 0.92] [--width 800]");
    return;
  }
  const options = {
    force: args.includes("--force"),
    format: optionValue(args, "--format", "avif"),
    target: numberOption(args, "--target", 0.92),
    width: numberOption(args, "--width", 800),
  };
  if (args.includes("--check")) {
    const status = await imageStatus({
      target: options.target,
      width: options.width,
      format: options.format,
      qualities: defaultParameters.qualities,
    });
    console.log(`${status.images.size} source image(s): ${status.cached.length} ready, ${status.stale.length} need optimization.`);
    status.stale.forEach((image) => console.log(`  needs optimization: ${image}`));
    status.dropped.forEach((image) => console.log(`  no longer present: ${image}`));
    if (status.stale.length || status.dropped.length || status.staleParameters) {
      throw new SiteError("Image data needs to be refreshed with: npm run site -- images");
    }
    return;
  }
  await optimizeImages(options);
}

async function buildTo(destination, { drafts = false, baseUrl, production = false } = {}) {
  const command = ["--destination", destination, "--cleanDestinationDir", "--printPathWarnings", "--printI18nWarnings"];
  if (drafts) command.push("--buildDrafts", "--buildFuture");
  if (production) command.push("--gc", "--minify", "--environment", "production");
  if (baseUrl) command.push("--baseURL", baseUrl);
  await hugo(command);
}

async function commandCheck(args) {
  if (args.includes("--help")) {
    console.log("Usage: npm run site -- check [--strict-images]");
    return;
  }
  console.log("Checking translations...");
  await checkTranslations({ quiet: true });
  console.log("Translations are complete.");
  const imageState = await imageStatus();
  if (imageState.stale.length || imageState.dropped.length || imageState.staleParameters) {
    const message = `${imageState.stale.length} image(s) need optimization${imageState.dropped.length ? ` and ${imageState.dropped.length} old entry/entries can be removed` : ""}.`;
    if (args.includes("--strict-images")) throw new SiteError(`${message} Run: npm run site -- images`);
    console.warn(`Note: ${message} The production build will refresh them automatically.`);
  } else {
    console.log(`Images are ready (${imageState.cached.length} cached measurements).`);
  }
  const destination = await mkdtemp(path.join(os.tmpdir(), "emily-check-"));
  try {
    console.log("Checking a complete build, including drafts...");
    await buildTo(destination, { drafts: true });
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
  console.log("All checks passed.");
}

async function commandBuild(args) {
  if (args.includes("--help")) {
    console.log("Usage: npm run site -- build [--base-url URL] [--skip-images]");
    return;
  }
  if (!args.includes("--skip-images")) {
    console.log("Preparing images...");
    await optimizeImages();
  }
  console.log("Building the production site...");
  await buildTo(path.join(projectRoot, "public"), {
    baseUrl: optionValue(args, "--base-url"),
    production: true,
  });
  console.log("Production site written to public/.");
}

async function commandDoctor() {
  const checks = [];
  const major = Number(process.versions.node.split(".")[0]);
  checks.push([major >= 24 && major < 27, "Node", process.version, "Install Node 24 LTS."]);
  try {
    const result = await hugo(["version"], { capture: true });
    checks.push([result.stdout.includes("v0.165.0"), "Hugo", result.stdout.trim(), "Run npm install again."]);
  } catch (error) {
    checks.push([false, "Hugo", error.message, "Run npm install again."]);
  }
  checks.push([Boolean(sharp.versions?.vips), "Image tools", `Sharp/libvips ${sharp.versions?.vips || "missing"}`, "Run npm install again."]);
  const browserPath = chromium.executablePath();
  checks.push([await exists(browserPath), "Browser audit", (await exists(browserPath)) ? "Chromium installed" : "optional; not installed", "Run npm run site -- setup --audit."]);

  let failures = 0;
  for (const [ready, name, detail, remedy] of checks) {
    console.log(`${ready ? "✓" : name === "Browser audit" ? "○" : "✗"} ${name}: ${detail}`);
    if (!ready && name !== "Browser audit") {
      failures += 1;
      console.log(`  ${remedy}`);
    }
  }
  console.log(failures ? "\nThe core setup needs attention." : "\nThe project is ready. Start it with: npm run site -- start");
  if (failures) throw new SiteError(`${failures} required setup check(s) failed.`);
}

async function commandSetup(args) {
  if (args.includes("--help") || !args.includes("--audit")) {
    console.log("Usage: npm run site -- setup --audit\n\nCore setup is completed by npm install. --audit installs the optional Chromium browser.");
    return;
  }
  console.log("Installing Chromium for browser audits...");
  const executable = process.platform === "win32" ? "playwright.cmd" : "playwright";
  await run(path.join(projectRoot, "node_modules/.bin", executable), ["install", "chromium"]);
  console.log("Browser audit support is ready.");
}

async function commandAudit(args) {
  if (!(await exists(chromium.executablePath()))) {
    throw new SiteError("The audit browser is not installed. Run: npm run site -- setup --audit");
  }
  await run(process.execPath, [path.join(projectRoot, "tools/capture-load-states.mjs"), ...args]);
}

async function commandAssets(args) {
  const [kind, ...rest] = args;
  if (!kind || kind === "--help") {
    console.log("Usage: npm run site -- assets sprites [--setup]\n       npm run site -- assets fonts [--setup|--check]");
    return;
  }
  if (kind === "sprites") {
    if (rest.includes("--setup")) {
      console.log("Installing the optional sprite-generation requirements...");
      await run("bash", [path.join(projectRoot, "tools/install-lemur-sprite-deps.sh")]);
      return;
    }
    console.log("Sprite generation is an advanced task and requires ImageMagick and potrace.");
    const spriteArgs = rest.length ? rest : [
      path.join(projectRoot, "assets/images/lemur-sprite-sheet.png"),
      path.join(projectRoot, "assets/images/lemur-sprites"),
    ];
    await run("bash", [path.join(projectRoot, "tools/generate-lemur-sprites.sh"), ...spriteArgs]);
    return;
  }
  if (kind === "fonts") {
    const virtualPython = path.join(
      projectRoot,
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
    if (rest.includes("--setup")) {
      console.log("Installing the optional font-generation requirements...");
      await run("python3", ["-m", "venv", path.join(projectRoot, ".venv")]);
      await run(virtualPython, ["-m", "pip", "install", "fonttools", "brotli"]);
      return;
    }
    if (!(await exists(virtualPython))) {
      throw new SiteError("Font tools are not installed. Run: npm run site -- assets fonts --setup");
    }
    console.log("Regenerating the optimized heading fonts...");
    await run(virtualPython, [path.join(projectRoot, "tools/subset-fonts.py"), ...rest]);
    return;
  }
  throw new SiteError(`Unknown asset type: ${kind}`);
}

export async function main(argv = process.argv.slice(2)) {
  const [command = "help", ...args] = argv;
  switch (command) {
    case "help":
    case "--help":
    case "-h": console.log(help); break;
    case "start": await commandStart(args); break;
    case "new": await commandNew(args); break;
    case "check": await commandCheck(args); break;
    case "build": await commandBuild(args); break;
    case "images": await commandImages(args); break;
    case "doctor": await commandDoctor(args); break;
    case "setup": await commandSetup(args); break;
    case "audit": await commandAudit(args); break;
    case "assets": await commandAssets(args); break;
    default: throw new SiteError(`Unknown command: ${command}\n\n${help}`);
  }
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    if (process.env.SITE_DEBUG) console.error(error.stack || error);
    else console.error(`Error: ${error.message || error}`);
    process.exitCode = error.exitCode || 1;
  });
}
