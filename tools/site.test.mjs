import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";

import { structuralSimilarity } from "./lib/images.mjs";
import { projectRoot } from "./lib/project.mjs";
import { createArticle, localDate, slugify } from "./site.mjs";

function runCli(args) {
  return new Promise((resolve, reject) => {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...env } = process.env;
    const child = spawn(process.execPath, [path.join(projectRoot, "tools/site.mjs"), ...args], {
      cwd: projectRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

test("slugify creates stable article paths", () => {
  assert.equal(slugify("Garden Field Notes"), "garden-field-notes");
  assert.equal(slugify("Terms, since they’re terse"), "terms-since-they-re-terse");
  assert.equal(slugify("  Déjà vu  "), "deja-vu");
});

test("localDate uses the front-matter date format", () => {
  assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test("SSIM is one for identical grayscale data", () => {
  const data = Buffer.from({ length: 64 }, (_, index) => index * 4);
  const image = { width: 8, height: 8, data };
  assert.equal(structuralSimilarity(image, image), 1);
});

test("new articles are safe draft page bundles", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "emily-new-test-"));
  try {
    const file = await createArticle({
      title: "Garden field notes",
      date: "2026-08-27",
      root,
    });
    assert.equal(path.relative(root, file), "content/posts/garden-field-notes/index.md");
    const content = await readFile(file, "utf8");
    assert.match(content, /title: "Garden field notes"/);
    assert.match(content, /draft: true/);
    assert.match(content, /## First section/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("help exposes the single command surface", async () => {
  const result = await runCli(["help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Everyday commands:/);
  assert.match(result.stdout, /npm run site -- start/);
});

test("unknown commands fail with an actionable message", async () => {
  const result = await runCli(["unknown"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown command: unknown/);
});

test("start serves a draft-capable local preview", { timeout: 30_000 }, async (context) => {
  const port = 13_000 + Math.floor(Math.random() * 1_000);
  const { NODE_TEST_CONTEXT: _nodeTestContext, ...env } = process.env;
  const child = spawn(
    process.execPath,
    [path.join(projectRoot, "tools/site.mjs"), "start", "--port", String(port), "--no-live-reload"],
    { cwd: projectRoot, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let diagnostics = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { diagnostics += chunk; });
  child.stderr.on("data", (chunk) => { diagnostics += chunk; });
  context.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });

  let response;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) break;
    } catch {
      // The preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(response?.ok, `Preview did not become ready.\n${diagnostics}`);
  assert.match(await response.text(), /<html/);
  child.kill("SIGINT");
  await new Promise((resolve) => child.once("exit", resolve));
});
