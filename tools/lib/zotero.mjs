import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { projectRoot, SiteError } from "./project.mjs";

export function nextLink(header) {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = part.trim().match(/^<([^>]+)>\s*;\s*rel=["']?next["']?$/i);
    if (match) return match[1];
  }
  return null;
}

export function sortCslItems(items) {
  return [...items].sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""), "en"));
}

export async function fetchZoteroItems({ fetcher = fetch, libraryId, apiKey, libraryType = "user", collection } = {}) {
  if (!libraryId || !apiKey) throw new SiteError("Zotero sync requires ZOTERO_LIBRARY_ID and ZOTERO_API_KEY.");
  if (!new Set(["user", "group"]).has(libraryType)) throw new SiteError("ZOTERO_LIBRARY_TYPE must be user or group.");
  const owner = libraryType === "group" ? "groups" : "users";
  const scope = collection ? `/collections/${encodeURIComponent(collection)}` : "";
  let url = `https://api.zotero.org/${owner}/${encodeURIComponent(libraryId)}${scope}/items/top?format=csljson&limit=100`;
  const items = [];
  const seen = new Set();
  while (url) {
    if (seen.has(url)) throw new SiteError("Zotero pagination loop detected.");
    seen.add(url);
    const response = await fetcher(url, { headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" } });
    if (!response.ok) throw new SiteError(`Zotero request failed (${response.status} ${response.statusText}).`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new SiteError("Zotero returned an unexpected CSL-JSON response.");
    items.push(...page);
    url = nextLink(response.headers.get("link"));
  }
  const sorted = sortCslItems(items);
  const ids = new Set();
  for (const item of sorted) {
    if (!item?.id) throw new SiteError("Every Zotero CSL record must have an id.");
    if (ids.has(item.id)) throw new SiteError(`Zotero returned duplicate id ${item.id}.`);
    ids.add(item.id);
  }
  return sorted;
}

export async function syncZotero({ root = projectRoot, fetcher = fetch } = {}) {
  const libraryId = process.env.ZOTERO_LIBRARY_ID;
  const apiKey = process.env.ZOTERO_API_KEY;
  if (!libraryId && !apiKey) throw new SiteError("Zotero sync requires ZOTERO_LIBRARY_ID and ZOTERO_API_KEY.");
  if (!libraryId || !apiKey) throw new SiteError("Set both ZOTERO_LIBRARY_ID and ZOTERO_API_KEY.");
  const items = await fetchZoteroItems({
    fetcher,
    libraryId,
    apiKey,
    libraryType: process.env.ZOTERO_LIBRARY_TYPE || "user",
    collection: process.env.ZOTERO_COLLECTION_KEY,
  });
  const dataDirectory = path.join(root, "data");
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(path.join(dataDirectory, "references.json"), `${JSON.stringify(items, null, 2)}\n`);
  console.log(`Zotero: wrote ${items.length} item(s) to data/references.json.`);
  return items;
}
