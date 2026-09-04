import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

import { exists, projectRoot, SiteError } from "./project.mjs";

const configDir = path.join(projectRoot, "config/_default");
const i18nDir = path.join(projectRoot, "themes/folio/i18n");
const contentDir = path.join(projectRoot, "content");
const ignoredPaths = new Set(["title"]);

function flatten(value, prefix = "", found = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flatten(item, `${prefix}[${index}]`, found);
    });
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      flatten(item, prefix ? `${prefix}.${key}` : key, found);
    }
  } else if (prefix) {
    found.add(prefix);
  }
  return found;
}

async function readToml(file) {
  if (!(await exists(file))) return null;
  return parseToml(await readFile(file, "utf8"));
}

async function readFrontMatter(file) {
  if (!(await exists(file))) return null;
  const text = await readFile(file, "utf8");
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  return end < 0 ? {} : parseYaml(text.slice(3, end)) || {};
}

async function readCopyBlocks(file) {
  if (!(await exists(file))) return null;
  const text = await readFile(file, "utf8");
  const paths = {};
  const order = [];
  const blocks = text.matchAll(/\{\{<\s*(copy|principle)\s+([^>]*?)\s*>\}\}/g);
  for (const [, name, args] of blocks) {
    const named = Object.fromEntries([...args.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
    if (name === "copy") {
      const key = args.match(/^"([^"]*)"/)?.[1] || named.key;
      if (key) paths[`copy.${key}`] = "";
      continue;
    }
    const key = named.key;
    if (!key) continue;
    paths[`principle.${key}`] = "";
    order.push(key);
    if (Object.hasOwn(named, "meta")) paths[`principle.${key}.meta`] = named.meta;
  }
  return { paths, order };
}

function compare(label, reference, defaultLanguage, others, problems, quiet) {
  const expected = flatten(reference);
  for (const ignored of ignoredPaths) expected.delete(ignored);
  if (!quiet) {
    console.log(`\n== ${label} ==`);
    console.log(`  ${defaultLanguage.padEnd(4)} ${expected.size} keys (reference)`);
  }
  for (const [language, data] of others) {
    if (data === null) {
      if (!quiet) console.log(`  ${language.padEnd(4)} FILE MISSING`);
      problems.push(`${label}: no file for ${language}`);
      continue;
    }
    const have = flatten(data);
    for (const ignored of ignoredPaths) have.delete(ignored);
    const missing = [...expected].filter((key) => !have.has(key)).sort();
    const extra = [...have].filter((key) => !expected.has(key)).sort();
    if (!quiet) {
      if (!missing.length && !extra.length) {
        console.log(`  ${language.padEnd(4)} OK (${have.size} keys)`);
      } else {
        console.log(`  ${language.padEnd(4)} ${have.size} keys`);
        missing.forEach((key) => {
          console.log(`         MISSING  ${key}`);
        });
        extra.forEach((key) => {
          console.log(`         extra    ${key}`);
        });
      }
    }
    missing.forEach((key) => {
      problems.push(`${label}: ${language} missing ${key}`);
    });
  }
}

function compareOrder(label, reference, defaultLanguage, others, problems, quiet) {
  if (!quiet) {
    console.log(`\n== ${label} ==`);
    console.log(`  ${defaultLanguage.padEnd(4)} ${reference.join(" -> ") || "(none)"}`);
  }
  for (const [language, order] of others) {
    if (order === null) continue;
    if (JSON.stringify(order) === JSON.stringify(reference)) {
      if (!quiet) console.log(`  ${language.padEnd(4)} OK`);
      continue;
    }
    if (!quiet) console.log(`  ${language.padEnd(4)} ${order.join(" -> ") || "(none)"}`);
    if ([...order].sort().join("\0") === [...reference].sort().join("\0")) {
      if (!quiet) console.log("         REORDERED");
      problems.push(`${label}: ${language} orders blocks differently`);
    }
  }
}

export async function checkTranslations({ quiet = false } = {}) {
  const languagesConfig = (await readToml(path.join(configDir, "languages.toml"))) || {};
  const siteConfig = (await readToml(path.join(configDir, "hugo.toml"))) || {};
  const defaultLanguage = siteConfig.defaultContentLanguage || "en";
  const languages = Object.keys(languagesConfig).sort(
    (a, b) => (languagesConfig[a].weight || 99) - (languagesConfig[b].weight || 99),
  );
  const others = languages.filter((language) => language !== defaultLanguage);
  const problems = [];
  if (!quiet) console.log(`languages: ${JSON.stringify(languages)}  (default: ${defaultLanguage})`);

  const comparisons = [
    ["template strings (i18n)", i18nDir, (language) => `${language}.toml`, readToml],
    ["site params", configDir, (language) => `params.${language}.toml`, readToml],
    ["menus", configDir, (language) => `menus.${language}.toml`, readToml],
  ];
  for (const [label, directory, filename, reader] of comparisons) {
    compare(
      label,
      (await reader(path.join(directory, filename(defaultLanguage)))) || {},
      defaultLanguage,
      await Promise.all(
        others.map(async (language) => [language, await reader(path.join(directory, filename(language)))]),
      ),
      problems,
      quiet,
    );
  }

  const homeFile = (language) =>
    path.join(contentDir, language === defaultLanguage ? "_index.md" : `_index.${language}.md`);
  compare(
    "homepage front matter",
    (await readFrontMatter(homeFile(defaultLanguage))) || {},
    defaultLanguage,
    await Promise.all(others.map(async (language) => [language, await readFrontMatter(homeFile(language))])),
    problems,
    quiet,
  );

  const referenceBlocks = (await readCopyBlocks(homeFile(defaultLanguage))) || { paths: {}, order: [] };
  const otherBlocks = await Promise.all(
    others.map(async (language) => [language, await readCopyBlocks(homeFile(language))]),
  );
  compare(
    "homepage copy blocks",
    referenceBlocks.paths,
    defaultLanguage,
    otherBlocks.map(([language, block]) => [language, block?.paths ?? null]),
    problems,
    quiet,
  );
  compareOrder(
    "homepage block order",
    referenceBlocks.order,
    defaultLanguage,
    otherBlocks.map(([language, block]) => [language, block?.order ?? null]),
    problems,
    quiet,
  );

  if (problems.length) {
    if (quiet) {
      problems.forEach((problem) => {
        console.error(`- ${problem}`);
      });
    }
    throw new SiteError(`${problems.length} translation problem(s) found.`);
  }
  if (!quiet) console.log("\nRESULT: all languages complete");
  return { languages, defaultLanguage };
}
