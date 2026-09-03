import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { exists, projectRoot, SiteError } from "./project.mjs";

// 16 and 32 cover browser tabs, bookmarks, and taskbar pins — the sizes
// every mainstream browser actually requests from favicon.ico. Both ship in
// one .ico so each surface picks its native size instead of scaling a single
// bitmap; a 48px frame was dropped because on a photographic source it more
// than doubled the file for a size only legacy Windows shortcuts ever use,
// which every route's byte budget pays for on every load.
export const FAVICON_SIZES = [16, 32];

function circleMask(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
}

async function renderPlate(source, size) {
  const square = await sharp(source).resize(size, size, { fit: "cover" }).ensureAlpha().toBuffer();
  // The source is a square portrait crop, not actually round — this clips it
  // to a circle (transparent corners) so the favicon reads as a round avatar
  // against a tab bar instead of a hard-edged square.
  const round = await sharp(square).composite([{ input: circleMask(size), blend: "dest-in" }]).png().toBuffer();
  // Palette-quantized PNG: at 16-32px a photographic source has no gradient
  // detail left for truecolor to preserve, so a reduced palette is free
  // savings rather than a visible quality trade. The uniform transparent
  // corners the circle mask adds compress away to almost nothing either way.
  return sharp(round).png({ compressionLevel: 9, palette: true, colors: 64 }).toBuffer();
}

// Hand-rolled ICO container: a 6-byte ICONDIR, one 16-byte ICONDIRENTRY per
// image, then the image data back to back. Storing PNG-compressed frames
// (rather than legacy BMP DIBs) is valid ICO since Windows Vista and is what
// every modern favicon tool does — it avoids a second image codec for a
// container format only used to bundle a few small rasters together.
function packIco(frames) {
  const headerSize = 6 + 16 * frames.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = headerSize;
  frames.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map((frame) => frame.png)]);
}

export async function renderFavicon({ root = projectRoot } = {}) {
  const source = path.join(root, "assets/images/profile.jpeg");
  const frames = await Promise.all(
    FAVICON_SIZES.map(async (size) => ({ size, png: await renderPlate(source, size) })),
  );
  return packIco(frames);
}

export async function prepareFavicon({ root = projectRoot, check = false } = {}) {
  const destination = path.join(root, "static/favicon.ico");
  const expected = await renderFavicon({ root });
  if (check) {
    if (!(await exists(destination)) || !expected.equals(await readFile(destination))) {
      throw new SiteError("static/favicon.ico is missing or stale; run npm run site -- build.");
    }
  } else {
    await writeFile(destination, expected);
  }
  return { bytes: expected.length, sizes: FAVICON_SIZES };
}
