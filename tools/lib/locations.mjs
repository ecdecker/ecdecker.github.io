import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import { projectRoot, SiteError } from "./project.mjs";

function validateCoordinate(location, key, minimum, maximum, label, index, failures) {
  const value = location[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    failures.push(`${label}: locations[${index}].${key} must be a number from ${minimum} to ${maximum}`);
  }
}

export function locationFailures(locations, label = "post") {
  if (locations === undefined || locations === null) return [];
  if (!Array.isArray(locations)) return [`${label}: locations must be a list`];
  const failures = [];
  for (const [index, location] of locations.entries()) {
    if (!location || typeof location !== "object" || Array.isArray(location)) {
      failures.push(`${label}: locations[${index}] must be an object`);
      continue;
    }
    if (typeof location.name !== "string" || !location.name.trim()) {
      failures.push(`${label}: locations[${index}].name must be a non-empty string`);
    }
    validateCoordinate(location, "latitude", -90, 90, label, index, failures);
    validateCoordinate(location, "longitude", -180, 180, label, index, failures);
  }
  return failures;
}

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(item)));
    else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_index.")) files.push(item);
  }
  return files;
}

export async function auditResearchLocations({ root = projectRoot } = {}) {
  const failures = [];
  for (const file of await markdownFiles(path.join(root, "content/posts"))) {
    const markdown = await readFile(file, "utf8");
    if (!markdown.startsWith("---\n")) continue;
    const end = markdown.indexOf("\n---", 4);
    if (end < 0) continue;
    const frontMatter = parseYaml(markdown.slice(4, end)) || {};
    const label = path.relative(root, file).split(path.sep).join("/");
    failures.push(...locationFailures(frontMatter.locations, label));
  }
  if (failures.length) throw new SiteError(`Research location check failed:\n- ${failures.join("\n- ")}`);
  return true;
}
