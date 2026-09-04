import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { exists, projectRoot, SiteError } from "./project.mjs";

export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;

export async function renderSocialCard({ root = projectRoot } = {}) {
  const source = path.join(root, "assets/images/folio-sketchbooks-stem.png");
  const metadata = await sharp(source).metadata();
  const imageHeight = Math.min(550, metadata.height || 550);
  const imageWidth = Math.min(
    420,
    metadata.width || 420,
    Math.floor(((metadata.width || 420) * imageHeight) / (metadata.height || imageHeight)),
  );
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#efece4"/>
    <rect x="48" y="48" width="1104" height="534" rx="4" fill="#fff" stroke="#d8d3c8"/>
    <path d="M104 206h490M104 256h430M104 306h470" stroke="#1f211f" stroke-width="14" stroke-linecap="round"/>
    <path d="M104 366h286M420 366h76M526 366h68" stroke="#5f625d" stroke-width="6" stroke-linecap="round"/>
    <line x1="104" y1="414" x2="655" y2="414" stroke="#d8d3c8"/>
    <circle cx="104" cy="474" r="8" fill="#1f211f"/><circle cx="140" cy="474" r="8" fill="#d8d3c8"/><circle cx="176" cy="474" r="8" fill="#d8d3c8"/>
  </svg>`);
  const plate = await sharp(source)
    .resize({ width: imageWidth, height: imageHeight, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, chromaSubsampling: "4:4:4", progressive: false, mozjpeg: false })
    .toBuffer();
  const plateMeta = await sharp(plate).metadata();
  return sharp(svg)
    .composite([
      {
        input: plate,
        left: 805 + Math.floor((300 - plateMeta.width) / 2),
        top: 40 + Math.floor((550 - plateMeta.height) / 2),
      },
    ])
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4", progressive: false, mozjpeg: false })
    .toBuffer();
}

export async function prepareSocialCard({ root = projectRoot, check = false } = {}) {
  const destination = path.join(root, "static/social-card.jpg");
  const expected = await renderSocialCard({ root });
  if (check) {
    if (!(await exists(destination)) || !expected.equals(await readFile(destination))) {
      throw new SiteError("static/social-card.jpg is missing or stale; run npm run site -- build.");
    }
  } else {
    await writeFile(destination, expected);
  }
  const metadata = await sharp(expected).metadata();
  if (metadata.width !== SOCIAL_CARD_WIDTH || metadata.height !== SOCIAL_CARD_HEIGHT || metadata.format !== "jpeg") {
    throw new SiteError("The social card must be a 1200×630 JPEG.");
  }
  return { bytes: expected.length, width: metadata.width, height: metadata.height };
}
