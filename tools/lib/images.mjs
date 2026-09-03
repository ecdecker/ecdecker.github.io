import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { hugoPath, projectRoot, run, SiteError } from "./project.mjs";

const qualities = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];
const extensions = new Set([".png", ".jpg", ".jpeg", ".tif", ".tiff"]);
const defaultParameters = { target: 0.92, width: 800, format: "avif", qualities };
const outputFile = path.join(projectRoot, "data/imagequality.json");
const c1 = (0.01 * 255) ** 2;
const c2 = (0.03 * 255) ** 2;

function excludedSource(file) {
  const relative = path.relative(projectRoot, file).split(path.sep).join("/");
  // profile.jpeg is favicon.mjs's source, never rendered through
  // partial "image.html" — measuring it here would just be wasted work.
  return relative.startsWith("assets/images/lemur-sprites/png/") || /-sprite-sheet\.[^.]+$/i.test(relative) || relative === "assets/images/profile.jpeg";
}

async function walk(directory, found = []) {
  if (!(await stat(directory).catch(() => null))) return found;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target, found);
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()) && !excludedSource(target)) found.push(target);
  }
  return found;
}

export async function discoverImages() {
  const found = new Map();
  for (const rootName of ["assets", "content"]) {
    const base = path.join(projectRoot, rootName);
    for (const file of await walk(base)) {
      const key = path.relative(base, file).split(path.sep).join("/");
      if (found.has(key)) throw new SiteError(`Duplicate image key ${key} exists under both assets/ and content/.`);
      found.set(key, file);
    }
  }
  return new Map([...found.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function digest(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function readData() {
  try {
    return JSON.parse(await readFile(outputFile, "utf8"));
  } catch {
    return {};
  }
}

function parametersChanged(data, parameters) {
  return Object.entries(parameters).some(([key, value]) => JSON.stringify(data[key]) !== JSON.stringify(value));
}

export async function imageStatus(parameters = defaultParameters) {
  const images = await discoverImages();
  const data = await readData();
  const staleParameters = parametersChanged(data, parameters);
  const stale = [];
  const cached = [];
  for (const [key, file] of images) {
    const hash = await digest(file);
    const previous = data.images?.[key];
    if (!staleParameters && previous?.hash === hash && Number.isInteger(previous?.quality)) cached.push(key);
    else stale.push(key);
  }
  const dropped = Object.keys(data.images || {}).filter((key) => !images.has(key)).sort();
  return { images, data, stale, cached, dropped, staleParameters, parameters };
}

async function decodeLuma(file) {
  const { data, info } = await sharp(file)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

export function structuralSimilarity(reference, candidate) {
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new SiteError(
      `Image dimensions differ: ${reference.width}x${reference.height} and ${candidate.width}x${candidate.height}.`,
    );
  }
  const { width, height } = reference;
  let total = 0;
  let blocks = 0;
  for (let blockY = 0; blockY <= height - 8; blockY += 8) {
    for (let blockX = 0; blockX <= width - 8; blockX += 8) {
      let sumA = 0;
      let sumB = 0;
      let squareA = 0;
      let squareB = 0;
      let product = 0;
      for (let y = blockY; y < blockY + 8; y += 1) {
        const offset = y * width + blockX;
        for (let x = 0; x < 8; x += 1) {
          const a = reference.data[offset + x];
          const b = candidate.data[offset + x];
          sumA += a;
          sumB += b;
          squareA += a * a;
          squareB += b * b;
          product += a * b;
        }
      }
      const meanA = sumA / 64;
      const meanB = sumB / 64;
      const varianceA = squareA / 64 - meanA * meanA;
      const varianceB = squareB / 64 - meanB * meanB;
      const covariance = product / 64 - meanA * meanB;
      total += (
        (2 * meanA * meanB + c1) * (2 * covariance + c2)
      ) / (
        (meanA * meanA + meanB * meanB + c1) * (varianceA + varianceB + c2)
      );
      blocks += 1;
    }
  }
  return blocks ? total / blocks : Number.NaN;
}

class ImageLab {
  constructor(width) {
    this.width = width;
    this.directory = null;
    this.flat = new Map();
    this.references = new Map();
  }

  async open() {
    this.directory = await mkdtemp(path.join(os.tmpdir(), "emily-images-"));
    await mkdir(path.join(this.directory, "assets/images"), { recursive: true });
    await mkdir(path.join(this.directory, "layouts"), { recursive: true });
    await writeFile(path.join(this.directory, "hugo.toml"), "baseURL='http://example.invalid/'\ntitle='measurement'\n");
    return this;
  }

  async close() {
    if (this.directory) await rm(this.directory, { recursive: true, force: true });
  }

  async stage(key, source) {
    if (!this.flat.has(key)) {
      const flat = `image-${String(this.flat.size).padStart(4, "0")}${path.extname(source).toLowerCase()}`;
      await copyFile(source, path.join(this.directory, "assets/images", flat));
      this.flat.set(key, flat);
    }
    return this.flat.get(key);
  }

  async render(flat, requests) {
    const variantLines = [...new Set(requests.map(([format, quality]) => `${format}:${quality}`))]
      .sort()
      .map((request) => {
        const [format, quality] = request.split(":");
        return `{{- $v := $delivery.Resize (printf "%dx ${format} q${quality}" $width) -}}\n${format.toUpperCase()}|${quality}|{{ $v.RelPermalink }}|{{ len $v.Content }}|\n`;
      })
      .join("");
    const template = `{{- with resources.Get "images/${flat}" -}}
{{- $width := ${this.width} -}}{{- if lt .Width $width }}{{ $width = .Width }}{{ end -}}
{{- $delivery := .Resize (printf "%dx" $width) -}}
{{- $reference := $delivery.Resize (printf "%dx png" $width) -}}
REF|{{ $reference.RelPermalink }}|{{ len $reference.Content }}|
${variantLines}{{- end -}}
`;
    await writeFile(path.join(this.directory, "layouts/home.html"), template);
    await run(hugoPath, ["--logLevel", "error"], { cwd: this.directory, capture: true });
    const manifest = await readFile(path.join(this.directory, "public/index.html"), "utf8");
    const referenceMatch = manifest.match(/REF\|([^|]+)\|(\d+)\|/);
    if (!referenceMatch) throw new SiteError("Image measurement produced no reference image.");
    const referencePath = path.join(this.directory, "public", referenceMatch[1].replace(/^\//, ""));
    const variants = new Map();
    for (const match of manifest.matchAll(/(AVIF|WEBP)\|(\d+)\|([^|]+)\|(\d+)\|/g)) {
      variants.set(
        `${match[1].toLowerCase()}:${match[2]}`,
        {
          file: path.join(this.directory, "public", match[3].replace(/^\//, "")),
          bytes: Number(match[4]),
        },
      );
    }
    return { referencePath, variants };
  }

  async score(referencePath, candidatePath) {
    if (!this.references.has(referencePath)) {
      const reference = await decodeLuma(referencePath);
      // A broken SSIM kernel does not fail, it silently picks the wrong
      // quality for every image. Identity is the one value that is knowable
      // without a second implementation, and the reference is already decoded
      // and in memory here, so checking it costs one pass and no extra decode.
      if (structuralSimilarity(reference, reference) !== 1) {
        throw new SiteError("SSIM does not score a reference against itself as 1.");
      }
      this.references.set(referencePath, reference);
    }
    return structuralSimilarity(this.references.get(referencePath), await decodeLuma(candidatePath));
  }
}

async function cheapestQuality(lab, flat, formats, target) {
  const low = Object.fromEntries(formats.map((format) => [format, 0]));
  const high = Object.fromEntries(formats.map((format) => [format, qualities.length - 1]));
  const best = {};
  const seen = new Map();

  while (true) {
    const probes = formats
      .filter((format) => low[format] <= high[format])
      .map((format) => [format, qualities[Math.floor((low[format] + high[format]) / 2)]]);
    if (!probes.length) break;
    const wanted = probes.filter(([format, quality]) => !seen.has(`${format}:${quality}`));
    if (wanted.length) {
      const { referencePath, variants } = await lab.render(flat, wanted);
      for (const [format, quality] of wanted) {
        const variant = variants.get(`${format}:${quality}`);
        if (!variant) throw new SiteError(`Hugo did not create ${format} q${quality}.`);
        seen.set(`${format}:${quality}`, {
          score: await lab.score(referencePath, variant.file),
          bytes: variant.bytes,
        });
      }
    }
    for (const [format, quality] of probes) {
      const result = seen.get(`${format}:${quality}`);
      const middle = Math.floor((low[format] + high[format]) / 2);
      console.log(`    ${format.padEnd(4)} q${String(quality).padEnd(3)} ssim ${result.score.toFixed(5)} ${String(result.bytes).padStart(8)} B`);
      if (result.score >= target) {
        best[format] = { quality, ...result, reached: true };
        high[format] = middle - 1;
      } else {
        low[format] = middle + 1;
      }
    }
  }

  for (const format of formats) {
    if (best[format]) continue;
    const quality = qualities.at(-1);
    if (!seen.has(`${format}:${quality}`)) {
      const { referencePath, variants } = await lab.render(flat, [[format, quality]]);
      const variant = variants.get(`${format}:${quality}`);
      seen.set(`${format}:${quality}`, {
        score: await lab.score(referencePath, variant.file),
        bytes: variant.bytes,
      });
    }
    best[format] = { quality, ...seen.get(`${format}:${quality}`), reached: false };
  }
  return best;
}

export async function optimizeImages({ force = false, format = "avif", target = 0.92, width = 800 } = {}) {
  if (!["avif", "webp", "both"].includes(format)) throw new SiteError(`Unknown image format: ${format}`);
  const parameters = { target, width, format, qualities };
  const status = await imageStatus(parameters);
  const entries = {};
  const todo = [];
  for (const [key, file] of status.images) {
    const hash = await digest(file);
    const previous = status.data.images?.[key];
    if (!force && !status.staleParameters && previous?.hash === hash && Number.isInteger(previous?.quality)) {
      entries[key] = previous;
    } else {
      todo.push({ key, file, hash });
    }
  }
  console.log(
    `${status.images.size} image(s): ${Object.keys(entries).length} cached, ${todo.length} to measure` +
    (status.dropped.length ? `; dropping ${status.dropped.length} stale entr${status.dropped.length === 1 ? "y" : "ies"}` : ""),
  );

  if (todo.length) {
    const lab = await new ImageLab(width).open();
    try {
      const formats = format === "both" ? ["avif", "webp"] : [format];
      for (const [index, item] of todo.entries()) {
        console.log(`[${index + 1}/${todo.length}] ${item.key}`);
        const flat = await lab.stage(item.key, item.file);
        const results = await cheapestQuality(lab, flat, formats, target);
        const quality = Math.max(...formats.map((name) => results[name].quality));
        const score = Math.min(...formats.map((name) => results[name].score));
        const bytes = Math.max(...formats.map((name) => results[name].bytes));
        entries[item.key] = {
          quality,
          hash: item.hash,
          ssim: Number(score.toFixed(5)),
          bytes,
          ...(!formats.every((name) => results[name].reached) ? { below_target: true } : {}),
        };
        console.log(`    -> q${quality} (ssim ${score.toFixed(5)}, ${bytes} B)`);
      }
    } finally {
      await lab.close();
    }
  }

  const orderedEntries = Object.fromEntries(
    Object.entries(entries)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, {
        bytes: entry.bytes,
        hash: entry.hash,
        quality: entry.quality,
        ssim: entry.ssim,
        ...(entry.below_target ? { below_target: true } : {}),
      }]),
  );
  const document = {
    _generated_by: "npm run site -- images",
    format,
    images: orderedEntries,
    qualities,
    target,
    width,
  };
  await writeFile(outputFile, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Wrote ${path.relative(projectRoot, outputFile)}.`);
  return document;
}

export { defaultParameters };
