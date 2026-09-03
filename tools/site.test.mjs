import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";

import { extractBoxReferences, validateBoxMounts } from "./lib/box.mjs";
import { structuralSimilarity } from "./lib/images.mjs";
import { projectRoot } from "./lib/project.mjs";
import {
  auditMarkdownImages,
  auditOutput,
  ceilingFor,
  deterministicGzip,
  routeForHtml,
  updateBaselines,
} from "./lib/site-audit.mjs";
import { FAVICON_SIZES, prepareFavicon } from "./lib/favicon.mjs";
import { SOCIAL_CARD_HEIGHT, SOCIAL_CARD_WIDTH, prepareSocialCard } from "./lib/social-card.mjs";
import { fetchZoteroItems, nextLink, sortCslItems } from "./lib/zotero.mjs";
import { createArticle, localDate, main, slugify } from "./site.mjs";

function socialMeta({ type = "website" } = {}) {
  return `<meta property="og:title" content="Test"><meta property="og:description" content="Description"><meta property="og:url" content="https://emilycdecker.com/"><meta property="og:type" content="${type}"><meta property="og:image" content="https://emilycdecker.com/social-card.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Test"><meta name="twitter:description" content="Description"><meta name="twitter:image" content="https://emilycdecker.com/social-card.jpg">`;
}

function page(body = "", options = {}) {
  return `<!doctype html><html lang="en"><head>${socialMeta(options)}</head><body>${body}</body></html>`;
}

async function artifactFixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "emily-audit-root-"));
  const output = path.join(root, "public");
  await mkdir(output, { recursive: true });
  await writeFile(path.join(root, "package.json"), "{}");
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(output, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return { root, output, baseline: path.join(root, "baselines.json") };
}

test("slug and date helpers are stable", () => {
  assert.equal(slugify("  Déjà Vu  "), "deja-vu");
  assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test("new articles are safe draft page bundles", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "emily-new-"));
  try {
    const file = await createArticle({ title: "Garden notes", date: "2026-08-27", root });
    assert.equal(path.relative(root, file), "content/posts/garden-notes/index.md");
    assert.match(await readFile(file, "utf8"), /draft: true/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("budget math and route normalization are exact", () => {
  assert.equal(ceilingFor(100), 110);
  assert.equal(routeForHtml("index.html"), "/");
  assert.equal(routeForHtml("fr/posts/index.html"), "/fr/posts/");
});

test("gzip output is deterministic", () => {
  const first = deterministicGzip(Buffer.from("paper thin ".repeat(50)));
  const second = deterministicGzip(Buffer.from("paper thin ".repeat(50)));
  assert.deepEqual(first, second);
  assert.equal(first[4], 0);
  assert.equal(first[5], 0);
  assert.equal(first[6], 0);
  assert.equal(first[7], 0);
});

test("Box mappings reject traversal and overlap", () => {
  assert.throws(() => validateBoxMounts([{ source: "../secret", target: "/box/research/" }]), /without traversal/);
  assert.throws(() => validateBoxMounts([
    { source: "Research", target: "/box/research/" },
    { source: "Other", target: "/box/research/data/" },
  ]), /overlap/);
});

test("Box link extraction covers Markdown, definitions, and HTML", () => {
  const mounts = [{ source: "Research", target: "/box/research/" }];
  const markdown = `[paper](/box/research/paper.pdf)\n![plate](/box/research/plate.png)\n[notes]: /box/research/notes.csv\n<a href="/box/research/data.tsv">data</a>`;
  assert.deepEqual(
    extractBoxReferences(markdown, mounts).map((item) => item.relative),
    ["paper.pdf", "plate.png", "notes.csv", "data.tsv"],
  );
  assert.throws(() => extractBoxReferences("[bad](/box/unconfigured/file.pdf)", mounts), /unconfigured/);
});

test("Zotero pagination and sorting are deterministic", async () => {
  const responses = [
    { items: [{ id: "z" }], link: '<https://api.zotero.org/page-2>; rel="next"' },
    { items: [{ id: "a" }], link: null },
  ];
  const items = await fetchZoteroItems({
    libraryId: "1", apiKey: "key",
    fetcher: async () => {
      const response = responses.shift();
      return { ok: true, status: 200, statusText: "OK", json: async () => response.items, headers: { get: () => response.link } };
    },
  });
  assert.deepEqual(items.map((item) => item.id), ["a", "z"]);
  assert.equal(nextLink('<https://example.test/2>; rel="next"'), "https://example.test/2");
  assert.deepEqual(sortCslItems([{ id: "b" }, { id: "a" }]).map((item) => item.id), ["a", "b"]);
});

test("Markdown images must be local and resolvable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "emily-markdown-"));
  try {
    await mkdir(path.join(root, "content"));
    await writeFile(path.join(root, "content/post.md"), "![remote](https://tracker.test/pixel.png)");
    await assert.rejects(auditMarkdownImages({ root }), /remote image/);
    await writeFile(path.join(root, "content/post.md"), "![missing](missing.png)");
    await assert.rejects(auditMarkdownImages({ root }), /unresolved image/);
    await writeFile(path.join(root, "content/local.png"), "local");
    await writeFile(path.join(root, "content/post.md"), "![local](local.png)");
    await auditMarkdownImages({ root });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("artifact audit rejects scripts, remote resources, and malformed images", async () => {
  const fixture = await artifactFixture({
    "index.html": page('<script src="bad.js"></script><img src="https://tracker.test/pixel.png" alt="">'),
    "bad.js": "alert(1)",
  });
  try {
    await assert.rejects(
      auditOutput({ output: fixture.output, root: fixture.root, baselineFile: fixture.baseline, requireBaseline: false }),
      /JavaScript is forbidden|remote page-load subresource|image lacks width/,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("artifact audit rejects broken links and development routes", async () => {
  const fixture = await artifactFixture({
    "index.html": page('<a href="/missing/">missing</a>'),
    "exercises/index.html": page("", { type: "article" }),
  });
  try {
    await assert.rejects(
      auditOutput({ output: fixture.output, root: fixture.root, baselineFile: fixture.baseline, requireBaseline: false }),
      /broken internal link|development route/,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("artifact audit rejects remote fonts and tracking pixels", async () => {
  const fixture = await artifactFixture({
    "index.html": page('<link rel="stylesheet" href="/style.css"><img src="/pixel.webp" alt="" width="1" height="1">'),
    "style.css": "@font-face{font-family:x;src:url(https://fonts.test/x.woff2)}",
    "pixel.webp": "pixel",
  });
  try {
    await assert.rejects(
      auditOutput({ output: fixture.output, root: fixture.root, baselineFile: fixture.baseline, requireBaseline: false }),
      /remote CSS subresource|tracking-pixel-sized/,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("artifact audit rejects leaked originals and oversized files", async () => {
  const source = Buffer.from("source-image-bytes");
  const fixture = await artifactFixture({
    "index.html": page(""),
    "leaked.png": source,
    "large.bin": Buffer.alloc(1_048_577),
  });
  try {
    await mkdir(path.join(fixture.root, "assets"), { recursive: true });
    await writeFile(path.join(fixture.root, "assets/source.png"), source);
    await assert.rejects(
      auditOutput({ output: fixture.output, root: fixture.root, baselineFile: fixture.baseline, requireBaseline: false }),
      /original source image escaped|maximum file size/,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("artifact audit rejects draft and future source routes", async () => {
  const fixture = await artifactFixture({
    "index.html": page('<a href="/posts/draft/">draft</a><a href="/posts/future/">future</a>'),
    "posts/draft/index.html": page("", { type: "article" }),
    "posts/future/index.html": page("", { type: "article" }),
  });
  try {
    await mkdir(path.join(fixture.root, "content/posts"), { recursive: true });
    await writeFile(path.join(fixture.root, "content/posts/draft.md"), "---\ndraft: true\n---\n");
    await writeFile(path.join(fixture.root, "content/posts/future.md"), "---\ndate: 2999-01-01\n---\n");
    await assert.rejects(
      auditOutput({ output: fixture.output, root: fixture.root, baselineFile: fixture.baseline, requireBaseline: false }),
      /draft or future content escaped/,
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("all four per-route budget categories are independently enforced", async () => {
  const fixture = await artifactFixture({ "index.html": page("route budget") });
  try {
    const accepted = await updateBaselines({ output: fixture.output, file: fixture.baseline, root: fixture.root });
    const actual = await auditOutput({ output: fixture.output, root: fixture.root, baselineFile: fixture.baseline });
    for (const [mode, measure] of [["cold", "bytes"], ["cold", "gzip"], ["cached", "bytes"], ["cached", "gzip"]]) {
      const changed = structuredClone(accepted);
      changed.routes["/"][mode][measure] = actual.routes["/"][mode][measure] - 1;
      await writeFile(fixture.baseline, `${JSON.stringify(changed)}\n`);
      await assert.rejects(
        auditOutput({ output: fixture.output, root: fixture.root, baselineFile: fixture.baseline }),
        new RegExp(`${mode} ${measure}`),
      );
    }
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("preservation baseline updates never remove routes", async () => {
  const fixture = await artifactFixture({
    "index.html": page('<a href="/kept/">kept</a>'),
    "kept/index.html": page('<a href="/">home</a>', { type: "article" }),
  });
  try {
    const baseline = await updateBaselines({ output: fixture.output, file: fixture.baseline, root: fixture.root });
    assert.deepEqual(Object.keys(baseline.routes), ["/", "/kept/"]);
    await rm(path.join(fixture.output, "kept"), { recursive: true });
    await writeFile(path.join(fixture.output, "index.html"), page(""));
    await assert.rejects(updateBaselines({ output: fixture.output, file: fixture.baseline, root: fixture.root }), /preserved route was removed|cannot remove/);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("baseline update can refresh a route ceiling without weakening global caps", async () => {
  const fixture = await artifactFixture({ "index.html": page("small") });
  try {
    const first = await updateBaselines({ output: fixture.output, file: fixture.baseline, root: fixture.root });
    await writeFile(path.join(fixture.output, "index.html"), page("larger ".repeat(200)));
    const second = await updateBaselines({ output: fixture.output, file: fixture.baseline, root: fixture.root });
    assert.ok(second.routes["/"].cached.bytes > first.routes["/"].cached.bytes);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("social card is fresh and exactly 1200 by 630", async () => {
  const metadata = await prepareSocialCard({ check: true });
  assert.equal(metadata.width, SOCIAL_CARD_WIDTH);
  assert.equal(metadata.height, SOCIAL_CARD_HEIGHT);
});

test("favicon is fresh and carries every configured size", async () => {
  const metadata = await prepareFavicon({ check: true });
  assert.deepEqual(metadata.sizes, FAVICON_SIZES);
});

test("SSIM is one for identical data", () => {
  const data = Buffer.from({ length: 64 }, (_, index) => index * 4);
  const image = { width: 8, height: 8, data };
  assert.equal(structuralSimilarity(image, image), 1);
});

test("CLI exposes test, theme, baselines, and sync routing", async () => {
  const messages = [];
  const original = console.log;
  console.log = (...parts) => messages.push(parts.join(" "));
  try {
    await main(["help"]);
    for (const command of ["test", "theme", "baselines", "sync"]) assert.match(messages.join("\n"), new RegExp(`\\b${command}\\b`));
    await assert.rejects(main(["unknown"]), /Unknown command/);
    messages.length = 0;
    await main(["sync", "box"]);
    assert.match(messages.join("\n"), /checked-in imports\/box snapshot/);
  } finally {
    console.log = original;
  }
});
