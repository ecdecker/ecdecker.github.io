import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { parse as parseYaml } from "yaml";

import { exists, projectRoot, SiteError } from "./project.mjs";

export const GLOBAL_BUDGETS = Object.freeze({
  cold: Object.freeze({ bytes: 150_000, gzip: 100_000 }),
  cached: Object.freeze({ bytes: 45_000, gzip: 15_000 }),
  maximumFileBytes: 1_048_576,
});

export const baselinePath = path.join(projectRoot, "tools/site-baselines.json");
// The canonical origin the production artifact is built for. Every tool that
// needs it imports this constant; the other copies live outside JavaScript
// (config/_default/hugo.toml, static/CNAME, and the deploy workflow).
export const SITE_ORIGIN = "https://blog.emilycdecker.com";
export const SITE_BASE_URL = `${SITE_ORIGIN}/`;
const SOURCE_IMAGE_EXTENSIONS = new Set([".jpeg", ".jpg", ".png", ".tif", ".tiff"]);
const DISALLOWED_ARTIFACTS = /(?:^|\/)(?:\.DS_Store|Thumbs\.db)$|\.(?:js|mjs|cjs|map|ts|tsx)$/i;
const TRACKING =
  /google-analytics|googletagmanager|gtag\s*\(|\bfbq\s*\(|facebook\.net\/tr|hotjar|segment\.com\/analytics|mixpanel|doubleclick|document\.cookie|localStorage|sessionStorage|sendBeacon/i;

export function routeForHtml(relative) {
  const posix = relative.split(path.sep).join("/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) return `/${posix.slice(0, -"index.html".length)}`;
  return `/${posix}`;
}

export function ceilingFor(bytes) {
  return Math.floor((bytes * 11 + 9) / 10);
}

export function deterministicGzip(input) {
  return gzipSync(input, { level: 9, mtime: 0 });
}

async function walk(directory) {
  if (!(await exists(directory))) return [];
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(item)));
    else if (entry.isFile()) found.push(item);
  }
  return found;
}

function stripSuffix(value) {
  return value.split("#", 1)[0].split("?", 1)[0];
}

function localUrl(value) {
  return value && !value.startsWith("#") && !value.startsWith("//") && !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

function urlsFromMarkdown(markdown) {
  // Code examples often demonstrate image syntax. They are prose, not page
  // resources, and must not be mistaken for network requests.
  markdown = markdown
    .replace(/^(?: {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm, "")
    .replace(/`+[^`\n]*`+/g, "");
  const definitions = new Map();
  for (const match of markdown.matchAll(/^\s*\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm)) {
    definitions.set(match[1].trim().toLowerCase(), match[2] || match[3]);
  }
  const images = [];
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g)) {
    images.push(match[1] || match[2]);
  }
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\[([^\]]*)\]/g)) {
    const key = (match[2] || match[1] || "").trim().toLowerCase();
    if (definitions.has(key)) images.push(definitions.get(key));
  }
  for (const match of markdown.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) images.push(match[1]);
  return images;
}

async function resolvesMarkdownImage(file, destination, root) {
  let decoded;
  try {
    decoded = decodeURIComponent(stripSuffix(destination));
  } catch {
    return false;
  }
  if (!decoded || decoded.includes("\0")) return false;
  const candidates = decoded.startsWith("/")
    ? [path.join(root, "static", decoded), path.join(root, "assets", decoded)]
    : [path.resolve(path.dirname(file), decoded), path.resolve(root, "assets", decoded)];
  return (
    await Promise.all(
      candidates.map(async (candidate) => {
        const relative = path.relative(root, candidate);
        return !relative.startsWith("..") && !path.isAbsolute(relative) && (await exists(candidate));
      }),
    )
  ).some(Boolean);
}

export async function auditMarkdownImages({ root = projectRoot } = {}) {
  const failures = [];
  for (const file of await walk(path.join(root, "content"))) {
    if (!/\.md$/i.test(file)) continue;
    const markdown = await readFile(file, "utf8");
    for (const destination of urlsFromMarkdown(markdown)) {
      const label = path.relative(root, file).split(path.sep).join("/");
      if (!localUrl(destination)) {
        failures.push(`${label}: remote image ${destination}`);
      } else if (!(await resolvesMarkdownImage(file, destination, root))) {
        failures.push(`${label}: unresolved image ${destination}`);
      }
    }
  }
  if (failures.length)
    throw new SiteError(`Markdown image audit failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  return true;
}

function attributes(tag) {
  const result = new Map();
  for (const match of tag.matchAll(/\b([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function resolveOutputUrl(value, pageRelative, output) {
  if (!value || value.startsWith("#") || /^(?:mailto|tel|data):/i.test(value)) return null;
  let url;
  try {
    const pageUrl = new URL(routeForHtml(pageRelative), `${SITE_ORIGIN}/`);
    url = new URL(value, pageUrl);
  } catch {
    return { invalid: true, value };
  }
  if (url.origin !== SITE_ORIGIN) return { remote: true, value, url };
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return { invalid: true, value };
  }
  if (pathname.includes("\0") || pathname.split("/").includes("..")) return { invalid: true, value };
  let target = path.join(output, pathname.replace(/^\/+/, ""));
  if (pathname.endsWith("/")) target = path.join(target, "index.html");
  return { target, hash: url.hash, pathname, value, url };
}

async function targetExists(result) {
  if (!result?.target) return true;
  if (await exists(result.target)) {
    const info = await stat(result.target);
    return info.isDirectory() ? exists(path.join(result.target, "index.html")) : true;
  }
  return exists(path.join(result.target, "index.html"));
}

function resourceCandidates(html) {
  const urls = [];
  for (const match of html.matchAll(/<(img|source|link|video|audio)\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = attributes(tag);
    const name = match[1].toLowerCase();
    if (name === "link" && !/(?:icon|preload|stylesheet)/i.test(attrs.get("rel") || "")) continue;
    for (const key of ["src", "href", "poster"]) if (attrs.get(key)) urls.push(attrs.get(key));
    if (attrs.get("srcset")) {
      for (const candidate of attrs.get("srcset").split(",")) urls.push(candidate.trim().split(/\s+/, 1)[0]);
    }
  }
  for (const match of html.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) urls.push(match[1]);
  return urls;
}

async function sourceImageHashes(root) {
  const hashes = new Set();
  for (const base of ["assets", "content"]) {
    for (const file of await walk(path.join(root, base))) {
      if (!SOURCE_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
      hashes.add(
        createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
      );
    }
  }
  return hashes;
}

function getIds(html) {
  return new Set([...html.matchAll(/\b(?:id|name)="([^"]+)"/g)].map((match) => match[1]));
}

function htmlLinks(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}

function sizesForUrlList(urls, pageRelative, output) {
  return urls
    .map((url) => resolveOutputUrl(url, pageRelative, output))
    .filter((item) => item?.target)
    .map((item) => item.target);
}

async function readSize(target) {
  try {
    return (await stat(target)).isFile() ? (await stat(target)).size : 0;
  } catch {
    return 0;
  }
}

export async function routeWeight(page, html, output) {
  const htmlBytes = Buffer.byteLength(html);
  const eager = new Set();

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (/(?:icon|preload|stylesheet)/i.test(attrs.get("rel") || "") && attrs.get("href")) eager.add(attrs.get("href"));
  }
  for (const match of html.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) eager.add(match[1]);

  for (const match of html.matchAll(/<(?:picture|img)\b[\s\S]*?(?:<\/picture>|(?=<\/|$))/gi)) {
    const block = match[0];
    const img =
      block.match(/<img\b[^>]*>/i)?.[0] || (block.startsWith("<img") ? block.match(/<img\b[^>]*>/i)?.[0] : null);
    if (!img) continue;
    const imageAttrs = attributes(img);
    if ((imageAttrs.get("loading") || "eager").toLowerCase() === "lazy") continue;
    const candidates = [];
    for (const tag of block.matchAll(/<(?:source|img)\b[^>]*>/gi)) {
      const attrs = attributes(tag[0]);
      if (attrs.get("src")) candidates.push({ url: attrs.get("src"), width: Number(attrs.get("width") || 0) });
      for (const item of (attrs.get("srcset") || "").split(",")) {
        const found = item.trim().match(/^(\S+)(?:\s+(\d+)w)?/);
        if (found) candidates.push({ url: found[1], width: Number(found[2] || 0) });
      }
    }
    const widest = Math.max(0, ...candidates.map((item) => item.width));
    const atWidth = candidates.filter((item) => item.width === widest || (!widest && item.width === 0));
    let worst = null;
    for (const item of atWidth) {
      const target = sizesForUrlList([item.url], page, output)[0];
      const size = target ? await readSize(target) : 0;
      if (!worst || size > worst.size) worst = { target, size };
    }
    if (worst?.target) eager.add(path.relative(output, worst.target).split(path.sep).join("/"));
  }

  let coldBytes = htmlBytes;
  const seenTargets = new Set();
  for (const target of sizesForUrlList([...eager], page, output)) {
    if (seenTargets.has(target)) continue;
    seenTargets.add(target);
    coldBytes += await readSize(target);
  }
  const htmlBuffer = Buffer.from(html);
  let coldGzip = deterministicGzip(htmlBuffer).length;
  for (const target of seenTargets) {
    try {
      coldGzip += deterministicGzip(await readFile(target)).length;
    } catch {
      /* reported elsewhere */
    }
  }
  return {
    cold: { bytes: coldBytes, gzip: coldGzip },
    cached: { bytes: htmlBytes, gzip: deterministicGzip(htmlBuffer).length },
  };
}

async function readBaseline(file = baselinePath) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, global: GLOBAL_BUDGETS, fileExceptions: {}, routes: {} };
    throw new SiteError(`Cannot read ${path.relative(projectRoot, file)}: ${error.message}`);
  }
}

function contentRoute(relative, frontMatter = {}, language = "en") {
  const normalized = relative.split(path.sep).join("/").replace(/\.md$/i, "");
  const languageSuffix = normalized.match(/\.([a-z]{2})$/i)?.[1];
  const lang = languageSuffix || language;
  let clean = languageSuffix ? normalized.slice(0, -(languageSuffix.length + 1)) : normalized;
  if (clean.endsWith("/_index")) clean = clean.slice(0, -"/_index".length);
  else if (clean.endsWith("/index")) clean = clean.slice(0, -"/index".length);
  if (frontMatter.slug) {
    const parts = clean.split("/");
    parts[parts.length - 1] = String(frontMatter.slug);
    clean = parts.join("/");
  }
  const prefix = lang === "en" ? "" : `/${lang}`;
  return `${prefix}/${clean.replace(/^\/+|\/+$/g, "")}${clean ? "/" : ""}`.replace(/\/+/g, "/");
}

async function contentRoutePolicy(root) {
  const forbidden = new Set();
  const translations = new Map();
  const files = (await walk(path.join(root, "content"))).filter((file) => /\.md$/i.test(file));
  for (const file of files) {
    const relative = path.relative(path.join(root, "content"), file);
    const markdown = await readFile(file, "utf8");
    let frontMatter = {};
    if (markdown.startsWith("---\n")) {
      const end = markdown.indexOf("\n---", 4);
      if (end >= 0) frontMatter = parseYaml(markdown.slice(4, end)) || {};
    }
    const route = contentRoute(relative, frontMatter);
    const date = frontMatter.date instanceof Date ? frontMatter.date : new Date(frontMatter.date || 0);
    if (frontMatter.draft === true || (Number.isFinite(date.getTime()) && date.getTime() > Date.now())) {
      forbidden.add(route);
      for (const alias of frontMatter.aliases || []) forbidden.add(String(alias));
    }
    if (relative.split(path.sep)[0] === "posts" && !path.basename(relative).startsWith("_index.")) {
      const key = relative.replace(/\.([a-z]{2})(\.md)$/i, "$2");
      if (!translations.has(key)) translations.set(key, new Set());
      const suffix = relative.match(/\.([a-z]{2})\.md$/i)?.[1] || "en";
      translations.get(key).add(suffix);
    }
  }
  const fallback = new Set();
  for (const [relative, languages] of translations) {
    if (!languages.has("en")) continue;
    const markdown = await readFile(path.join(root, "content", relative), "utf8");
    let frontMatter = {};
    if (markdown.startsWith("---\n")) {
      const end = markdown.indexOf("\n---", 4);
      if (end >= 0) frontMatter = parseYaml(markdown.slice(4, end)) || {};
    }
    for (const language of ["fr", "mg"])
      if (!languages.has(language)) fallback.add(contentRoute(relative, frontMatter, language));
  }
  return { forbidden, fallback };
}

function budgetFailures(route, actual, ceiling, failures) {
  for (const mode of ["cold", "cached"]) {
    for (const measure of ["bytes", "gzip"]) {
      const global = GLOBAL_BUDGETS[mode][measure];
      if (actual[mode][measure] > global)
        failures.push(`${route}: ${mode} ${measure} ${actual[mode][measure]} exceeds global cap ${global}`);
      if (ceiling && actual[mode][measure] > ceiling[mode]?.[measure])
        failures.push(
          `${route}: ${mode} ${measure} ${actual[mode][measure]} exceeds route ceiling ${ceiling[mode]?.[measure]}`,
        );
    }
  }
}

function socialFailures(relative, html, failures) {
  if (relative === "admin/index.html" || /http-equiv=(?:["']?refresh["']?)/i.test(html)) return;
  const metadata = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = attrs.get("property") || attrs.get("name");
    if (key && attrs.has("content")) metadata.set(key, attrs.get("content"));
  }
  const required = [
    "og:title",
    "og:description",
    "og:url",
    "og:type",
    "og:image",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
  ];
  for (const name of required) {
    const value = metadata.get(name);
    if (!value) failures.push(`${relative}: missing ${name} metadata`);
    else if ((name.endsWith("url") || name.endsWith("image")) && !value.startsWith(`${SITE_ORIGIN}/`))
      failures.push(`${relative}: ${name} must be an absolute same-origin URL`);
  }
  const image = metadata.get("og:image");
  if (image !== `${SITE_ORIGIN}/social-card.jpg`)
    failures.push(`${relative}: unexpected social card ${image || "(missing)"}`);
  const type = metadata.get("og:type");
  const expected = relative === "index.html" || /^(?:fr|mg)\/index\.html$/.test(relative) ? "website" : "article";
  if (type !== expected) failures.push(`${relative}: og:type is ${type || "missing"}, expected ${expected}`);
}

export async function auditOutput({
  output,
  root = projectRoot,
  baselineFile = baselinePath,
  requireBaseline = true,
  enforceRouteBudgets = true,
} = {}) {
  const failures = [];
  const files = await walk(output);
  const baseline = await readBaseline(baselineFile);
  const exceptionMap = baseline.fileExceptions || {};
  const sourceHashes = await sourceImageHashes(root);
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const htmlByPath = new Map();
  const weights = {};

  for (const file of files) {
    const relative = path.relative(output, file).split(path.sep).join("/");
    const info = await stat(file);
    if (DISALLOWED_ARTIFACTS.test(relative))
      failures.push(`${relative}: JavaScript or development artifact is forbidden`);
    if (info.size > GLOBAL_BUDGETS.maximumFileBytes) {
      const exception = exceptionMap[relative];
      if (
        !exception ||
        typeof exception.reason !== "string" ||
        !exception.reason.trim() ||
        typeof exception.reviewedBy !== "string" ||
        !exception.reviewedBy.trim()
      )
        failures.push(`${relative}: ${info.size} bytes exceeds maximum file size without a reviewed exception`);
    }
    if (SOURCE_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()) && relative !== "social-card.jpg") {
      const hash = createHash("sha256")
        .update(await readFile(file))
        .digest("hex");
      if (sourceHashes.has(hash)) failures.push(`${relative}: original source image escaped into the build`);
    }
    if (/\.css$/i.test(file)) {
      const css = await readFile(file, "utf8");
      if (TRACKING.test(css)) failures.push(`${relative}: tracking construct`);
      if (/url\(\s*["']?(?:https?:)?\/\//i.test(css) || /@import\s+["']?(?:https?:)?\/\//i.test(css))
        failures.push(`${relative}: remote CSS subresource`);
    }
  }

  for (const file of htmlFiles) {
    const relative = path.relative(output, file).split(path.sep).join("/");
    const html = await readFile(file, "utf8");
    htmlByPath.set(relative, html);
    if (/<script\b/i.test(html) || /javascript\s*:/i.test(html)) failures.push(`${relative}: JavaScript is forbidden`);
    if (TRACKING.test(html)) failures.push(`${relative}: tracking construct`);
    if (/(?:^|\/)exercises(?:\/|$)/.test(routeForHtml(relative)))
      failures.push(`${relative}: development route escaped into production`);

    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      const attrs = attributes(match[0]);
      for (const name of ["src", "alt", "width", "height"])
        if (!attrs.has(name)) failures.push(`${relative}: image lacks ${name}`);
      if (attrs.get("width") === "1" && attrs.get("height") === "1")
        failures.push(`${relative}: tracking-pixel-sized image`);
    }
    for (const url of resourceCandidates(html)) {
      const resolved = resolveOutputUrl(url, relative, output);
      if (resolved?.remote) failures.push(`${relative}: remote page-load subresource ${url}`);
      else if (resolved?.invalid) failures.push(`${relative}: invalid subresource URL ${url}`);
      else if (resolved?.target && !(await targetExists(resolved)))
        failures.push(`${relative}: missing subresource ${url}`);
    }
    socialFailures(relative, html, failures);
    weights[routeForHtml(relative)] = await routeWeight(relative, html, output);
  }

  for (const [relative, html] of htmlByPath) {
    for (const href of htmlLinks(html)) {
      const resolved = resolveOutputUrl(href, relative, output);
      if (!resolved || resolved.remote) continue;
      if (resolved.invalid || !(await targetExists(resolved)))
        failures.push(`${relative}: broken internal link ${href}`);
      else if (resolved.hash) {
        let target = resolved.target;
        try {
          if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
        } catch {
          /* failure already recorded */
        }
        const targetRelative = path.relative(output, target).split(path.sep).join("/");
        const targetHtml = htmlByPath.get(targetRelative);
        let id;
        try {
          id = decodeURIComponent(resolved.hash.slice(1));
        } catch {
          id = null;
        }
        if (targetHtml && id && !getIds(targetHtml).has(id)) failures.push(`${relative}: broken fragment ${href}`);
      }
    }
  }

  const routePolicy = await contentRoutePolicy(root);
  for (const route of routePolicy.forbidden)
    if (weights[route]) failures.push(`${route}: draft or future content escaped into production`);
  for (const route of routePolicy.fallback)
    if (weights[route]) failures.push(`${route}: untranslated article fallback route is forbidden`);

  for (const [route, ceiling] of Object.entries(baseline.routes || {})) {
    if (!weights[route])
      failures.push(`${route}: preserved route was removed; retain a page, redirect, or deliberate tombstone`);
    else budgetFailures(route, weights[route], enforceRouteBudgets ? ceiling : null, failures);
  }
  for (const [route, actual] of Object.entries(weights)) {
    if (requireBaseline && !baseline.routes?.[route])
      failures.push(`${route}: new route needs explicit baseline acceptance with npm run site -- baselines --update`);
    budgetFailures(route, actual, enforceRouteBudgets ? baseline.routes?.[route] : null, failures);
  }

  if (failures.length)
    throw new SiteError(
      `Production artifact audit failed (${failures.length}):\n${failures.map((item) => `- ${item}`).join("\n")}`,
    );
  return { routes: weights, files: files.length };
}

export async function updateBaselines({ output, file = baselinePath, root = projectRoot } = {}) {
  const previous = await readBaseline(file);
  const result = await auditOutput({
    output,
    root,
    baselineFile: file,
    requireBaseline: false,
    enforceRouteBudgets: false,
  });
  const missing = Object.keys(previous.routes || {}).filter((route) => !result.routes[route]);
  if (missing.length)
    throw new SiteError(
      `Baseline update cannot remove preserved routes:\n${missing.map((route) => `- ${route}`).join("\n")}`,
    );
  const routes = {};
  for (const [route, actual] of Object.entries(result.routes).sort(([a], [b]) => a.localeCompare(b))) {
    routes[route] = {
      cold: { bytes: ceilingFor(actual.cold.bytes), gzip: ceilingFor(actual.cold.gzip) },
      cached: { bytes: ceilingFor(actual.cached.bytes), gzip: ceilingFor(actual.cached.gzip) },
    };
  }
  const next = { version: 1, global: GLOBAL_BUDGETS, fileExceptions: previous.fileExceptions || {}, routes };
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
