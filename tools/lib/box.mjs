import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { exists, projectRoot, run, SiteError } from "./project.mjs";

function posix(value) {
  return value.split(path.sep).join("/");
}

export function validateBoxMounts(mounts) {
  if (!Array.isArray(mounts)) throw new SiteError("emily.box.mounts must be an array.");
  const normalized = mounts.map((mount, index) => {
    if (!mount || typeof mount !== "object") throw new SiteError(`Box mount ${index + 1} must be an object.`);
    const source = String(mount.source || "").replace(/\\/g, "/").replace(/\/+$/, "");
    let target = String(mount.target || "").replace(/\\/g, "/");
    if (!source || source.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(source) || source.split("/").includes("..")) {
      throw new SiteError(`Box mount ${index + 1} source must be a relative Box path without traversal.`);
    }
    if (!target.startsWith("/") || target.includes("?") || target.includes("#") || target.split("/").includes("..")) {
      throw new SiteError(`Box mount ${index + 1} target must be an absolute site path without traversal.`);
    }
    target = `/${target.split("/").filter(Boolean).join("/")}/`;
    return { source, target };
  });
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i];
      const b = normalized[j];
      if (a.target.startsWith(b.target) || b.target.startsWith(a.target)) throw new SiteError(`Box targets overlap: ${a.target} and ${b.target}`);
      if (`${a.source}/`.startsWith(`${b.source}/`) || `${b.source}/`.startsWith(`${a.source}/`)) throw new SiteError(`Box sources overlap: ${a.source} and ${b.source}`);
    }
  }
  return normalized;
}

function markdownDestinations(markdown) {
  const found = [];
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g)) found.push(match[1] || match[2]);
  for (const match of markdown.matchAll(/^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm)) found.push(match[1] || match[2]);
  for (const match of markdown.matchAll(/<(?:a|img|source)\b[^>]*\b(?:href|src)\s*=\s*["']([^"']+)["'][^>]*>/gi)) found.push(match[1]);
  return found;
}

export function extractBoxReferences(markdown, mounts, { file = "Markdown" } = {}) {
  const valid = validateBoxMounts(mounts);
  const references = [];
  for (const raw of markdownDestinations(markdown)) {
    let url;
    try { url = new URL(raw, "https://emilycdecker.com/"); } catch { continue; }
    if (url.origin !== "https://emilycdecker.com") continue;
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { throw new SiteError(`${file}: malformed encoded URL ${raw}`); }
    const mount = valid.find((candidate) => pathname.startsWith(candidate.target));
    if (!mount) {
      if (pathname.startsWith("/box/")) throw new SiteError(`${file}: unconfigured Box path ${raw}`);
      continue;
    }
    const relative = pathname.slice(mount.target.length);
    if (!relative || relative.startsWith("/") || relative.split("/").includes("..")) throw new SiteError(`${file}: invalid Box file path ${raw}`);
    references.push({ mount, relative, sitePath: `${mount.target}${relative}` });
  }
  return references;
}

async function walkMarkdown(directory) {
  if (!(await exists(directory))) return [];
  const { readdir } = await import("node:fs/promises");
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkMarkdown(item));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(item);
  }
  return files;
}

export async function configuredBoxMounts(root = projectRoot) {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  return validateBoxMounts(pkg.emily?.box?.mounts || []);
}

export async function scanBoxReferences({ root = projectRoot, mounts } = {}) {
  const configured = mounts || await configuredBoxMounts(root);
  const unique = new Map();
  for (const file of await walkMarkdown(path.join(root, "content"))) {
    const markdown = await readFile(file, "utf8");
    for (const reference of extractBoxReferences(markdown, configured, { file: posix(path.relative(root, file)) })) {
      unique.set(reference.sitePath, reference);
    }
  }
  return [...unique.values()].sort((a, b) => a.sitePath.localeCompare(b.sitePath));
}

async function walkSnapshot(directory) {
  if (!(await exists(directory))) return [];
  const { readdir } = await import("node:fs/promises");
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkSnapshot(item));
    else if (entry.isFile() && entry.name !== ".gitkeep") files.push(item);
  }
  return files;
}

export async function auditBoxSnapshot({ root = projectRoot } = {}) {
  const references = await scanBoxReferences({ root });
  const expected = new Set(references.map((item) => item.sitePath.replace(/^\/+/, "")));
  const snapshot = path.join(root, "imports/box");
  const actual = new Set((await walkSnapshot(snapshot)).map((file) => posix(path.relative(snapshot, file))));
  const missing = [...expected].filter((file) => !actual.has(file));
  const extra = [...actual].filter((file) => !expected.has(file));
  if (missing.length || extra.length) {
    throw new SiteError(`Box snapshot does not match referenced files:\n${missing.map((file) => `- missing ${file}`).concat(extra.map((file) => `- unreferenced ${file}`)).join("\n")}`);
  }
  return { files: actual.size };
}

export async function syncBox({ root = projectRoot, runner = run } = {}) {
  const mounts = await configuredBoxMounts(root);
  const references = await scanBoxReferences({ root, mounts });
  if (!mounts.length) {
    console.log("Box: no emily.box.mounts are configured; using the checked-in imports/box snapshot.");
    return { fetched: 0 };
  }
  const remote = process.env.BOX_REMOTE;
  if (!remote) throw new SiteError("BOX_REMOTE is required for site sync box (for example: box).");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "emily-box-"));
  const snapshot = path.join(root, "imports/box");
  try {
    for (const reference of references) {
      const source = `${remote}:${reference.mount.source}/${reference.relative}`;
      const destination = path.join(temporary, reference.sitePath.replace(/^\/+/, ""));
      const relative = path.relative(temporary, destination);
      if (relative.startsWith("..") || path.isAbsolute(relative)) throw new SiteError(`Box path traverses the snapshot: ${reference.sitePath}`);
      await mkdir(path.dirname(destination), { recursive: true });
      await runner(process.env.RCLONE_BIN || "rclone", ["copyto", source, destination, "--checksum"]);
    }
    await rm(snapshot, { recursive: true, force: true });
    await mkdir(path.dirname(snapshot), { recursive: true });
    await rename(temporary, snapshot);
    await mkdir(snapshot, { recursive: true });
    if (!references.length) await writeFile(path.join(snapshot, ".gitkeep"), "");
    console.log(`Box: wrote ${references.length} referenced file(s) to imports/box.`);
    return { fetched: references.length };
  } finally {
    if (await exists(temporary)) await rm(temporary, { recursive: true, force: true });
  }
}
