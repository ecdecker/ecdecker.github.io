import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

import { hugoPath, projectRoot, spawnManaged } from "./lib/project.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(url, child) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Hugo exited before ${url} became available`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server has not bound its port yet.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function startHugo({ name, port, environment, withLiveReload }) {
  const command = [
    "server",
    "--renderToMemory",
    "--disableFastRender",
    "--bind",
    "127.0.0.1",
    "--port",
    String(port),
    "--cacheDir",
    path.join(os.tmpdir(), `emily-load-state-${name}`),
  ];
  if (!withLiveReload) command.push("--disableLiveReload");
  if (environment) command.push("--environment", environment);

  const child = spawnManaged(hugoPath, command, {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostics = "";
  child.stdout.on("data", (chunk) => {
    diagnostics += chunk;
  });
  child.stderr.on("data", (chunk) => {
    diagnostics += chunk;
  });
  child.on("exit", (code) => {
    if (code && diagnostics) process.stderr.write(diagnostics);
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url, child);
  return { child, url };
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(2_000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function installPageObservers() {
  const startedAt = performance.now();
  const nodeIds = new WeakMap();
  let nextNodeId = 1;
  let lastGeometry = new Map();

  const nodeId = (node) => {
    if (!nodeIds.has(node)) nodeIds.set(node, nextNodeId++);
    return nodeIds.get(node);
  };
  const selector = (node) => {
    if (!(node instanceof Element)) return null;
    if (node.id) return `#${CSS.escape(node.id)}`;
    const bits = [];
    let current = node;
    while (current && bits.length < 4) {
      let bit = current.localName;
      if (!bit) break;
      const parent = current.parentElement;
      if (parent) {
        const peers = [...parent.children].filter((peer) => peer.localName === current.localName);
        if (peers.length > 1) bit += `:nth-of-type(${peers.indexOf(current) + 1})`;
      }
      bits.unshift(bit);
      current = parent;
    }
    return bits.join(">");
  };
  const emit = (type, detail = {}) => {
    window.__captureEvent({
      type,
      atMs: Number((performance.now() - startedAt).toFixed(2)),
      detail,
    });
  };
  const rectJson = (rect) =>
    rect && {
      x: Number(rect.x.toFixed(2)),
      y: Number(rect.y.toFixed(2)),
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
    };

  window.addEventListener("error", (event) => {
    emit("page-error", { message: event.message, source: event.filename });
  });
  for (const eventName of ["DOMContentLoaded", "load", "pageshow"]) {
    window.addEventListener(eventName, () => emit(eventName));
  }
  document.addEventListener("readystatechange", () => {
    emit("ready-state", { value: document.readyState });
  });

  for (const entryType of ["paint", "largest-contentful-paint", "layout-shift", "resource"]) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entryType === "layout-shift") {
            emit("layout-shift", {
              value: entry.value,
              cumulativeValue: Number(
                performance
                  .getEntriesByType("layout-shift")
                  .reduce((total, item) => total + (item.hadRecentInput ? 0 : item.value), 0)
                  .toFixed(6),
              ),
              hadRecentInput: entry.hadRecentInput,
              sources: (entry.sources ?? []).map((source) => ({
                node: selector(source.node),
                previousRect: rectJson(source.previousRect),
                currentRect: rectJson(source.currentRect),
              })),
            });
          } else if (entryType === "resource") {
            emit("resource", {
              name: entry.name,
              initiatorType: entry.initiatorType,
              startTime: Number(entry.startTime.toFixed(2)),
              responseEnd: Number(entry.responseEnd.toFixed(2)),
              transferSize: entry.transferSize,
              decodedBodySize: entry.decodedBodySize,
            });
          } else {
            emit(entryType, {
              name: entry.name,
              startTime: Number(entry.startTime.toFixed(2)),
              renderTime: Number((entry.renderTime || 0).toFixed(2)),
              loadTime: Number((entry.loadTime || 0).toFixed(2)),
              size: entry.size,
              element: selector(entry.element),
            });
          }
        }
      }).observe({ type: entryType, buffered: true });
    } catch {
      // Older browser versions may not expose every observer type.
    }
  }

  for (const eventName of ["loading", "loadingdone", "loadingerror"]) {
    document.fonts.addEventListener(eventName, (event) => {
      emit(`fonts-${eventName}`, {
        faces: [...(event.fontfaces ?? [])].map((face) => ({
          family: face.family,
          style: face.style,
          status: face.status,
        })),
      });
    });
  }
  window.addEventListener(
    "load",
    async () => {
      await document.fonts.ready;
      emit("fonts-ready", {
        status: document.fonts.status,
        faces: [...document.fonts].map((face) => ({
          family: face.family,
          style: face.style,
          status: face.status,
        })),
      });
    },
    { once: true },
  );

  const startDomObservers = () => {
    if (!document.documentElement) {
      requestAnimationFrame(startDomObservers);
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      emit("resize", {
        entries: entries.slice(0, 40).map((entry) => ({
          node: selector(entry.target),
          rect: rectJson(entry.contentRect),
        })),
        omitted: Math.max(0, entries.length - 40),
      });
    });
    const observeTree = (root) => {
      if (root instanceof Element) resizeObserver.observe(root);
      root.querySelectorAll?.("*").forEach((node) => {
        resizeObserver.observe(node);
      });
    };
    observeTree(document.documentElement);

    new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          observeTree(node);
        });
      }
      emit("mutation", {
        count: records.length,
        types: [...new Set(records.map((record) => record.type))],
      });
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  };
  startDomObservers();

  const scanGeometry = () => {
    if (document.documentElement) {
      const current = new Map();
      const changed = [];
      for (const element of document.querySelectorAll("*")) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const value = [
          rect.x.toFixed(2),
          rect.y.toFixed(2),
          rect.width.toFixed(2),
          rect.height.toFixed(2),
          style.display,
          style.visibility,
          style.fontFamily,
          style.fontSize,
          style.lineHeight,
        ].join("|");
        const id = nodeId(element);
        current.set(id, value);
        if (lastGeometry.get(id) !== value) {
          changed.push({
            node: selector(element),
            rect: rectJson(rect),
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
          });
        }
      }
      for (const id of lastGeometry.keys()) {
        if (!current.has(id)) changed.push({ nodeId: id, removed: true });
      }
      if (changed.length) {
        emit("geometry-change", {
          changed: changed.slice(0, 60),
          omitted: Math.max(0, changed.length - 60),
        });
      }
      lastGeometry = current;
    }
    requestAnimationFrame(scanGeometry);
  };
  requestAnimationFrame(scanGeometry);
  emit("observer-installed");
}

async function captureVariant(browser, variant, args) {
  const captureStartedAt = Date.now();
  const directory = path.resolve(args.output, variant.name);
  const framesDirectory = path.join(directory, "frames");
  await rm(directory, { recursive: true, force: true });
  await mkdir(framesDirectory, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const timeline = [];
  const responses = [];
  const requests = new Map();
  const frames = [];
  const frameHashes = new Set();
  const pendingWrites = [];
  let lastFrame = null;
  let frameSequence = 0;

  const record = (event) => {
    timeline.push({
      ...event,
      receivedAtMs: Date.now() - captureStartedAt,
      frameAtReceipt: lastFrame,
    });
  };
  await page.exposeBinding("__captureEvent", (_source, event) => record(event));
  await page.addInitScript(installPageObservers);

  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: args.latencyMs,
    downloadThroughput: args.downloadKbps > 0 ? (args.downloadKbps * 1000) / 8 : -1,
    uploadThroughput: args.downloadKbps > 0 ? (Math.max(32, args.downloadKbps / 4) * 1000) / 8 : -1,
    connectionType: "cellular2g",
  });
  cdp.on("Network.requestWillBeSent", ({ requestId, request, type, timestamp }) => {
    requests.set(requestId, {
      requestId,
      url: request.url,
      method: request.method,
      kind: type?.toLowerCase() ?? "other",
      requestedAtMs: Date.now() - captureStartedAt,
      requestTimestamp: timestamp,
    });
  });
  cdp.on("Network.responseReceived", ({ requestId, response, type, timestamp }) => {
    const request = requests.get(requestId) ?? {
      requestId,
      url: response.url,
      method: "GET",
      requestedAtMs: null,
      requestTimestamp: null,
    };
    const item = {
      ...request,
      kind: type?.toLowerCase() ?? request.kind ?? "other",
      status: response.status,
      mimeType: response.mimeType,
      protocol: response.protocol,
      fromDiskCache: response.fromDiskCache,
      fromServiceWorker: response.fromServiceWorker,
      responseAtMs: Date.now() - captureStartedAt,
      responseTimestamp: timestamp,
      encodedBytes: null,
      finishedAtMs: null,
    };
    requests.set(requestId, item);
    responses.push(item);
    record({
      type: "response-received",
      detail: {
        url: item.url,
        kind: item.kind,
        status: item.status,
        mimeType: item.mimeType,
      },
    });
  });
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength, timestamp }) => {
    const item = requests.get(requestId);
    if (!item) return;
    item.encodedBytes = encodedDataLength;
    item.finishedAtMs = Date.now() - captureStartedAt;
    item.finishedTimestamp = timestamp;
    record({
      type: "response-finished",
      detail: {
        url: item.url,
        kind: item.kind,
        encodedBytes: encodedDataLength,
      },
    });
  });
  cdp.on("Network.loadingFailed", ({ requestId, errorText, canceled }) => {
    const item = requests.get(requestId);
    record({
      type: "response-error",
      detail: {
        url: item?.url ?? null,
        kind: item?.kind ?? null,
        message: errorText,
        canceled,
      },
    });
  });
  if (args.fontDelayMs > 0) {
    await cdp.send("Fetch.enable", {
      patterns: [{ resourceType: "Font", requestStage: "Request" }],
    });
    cdp.on("Fetch.requestPaused", ({ requestId, request }) => {
      record({
        type: "font-request-delayed",
        detail: { url: request.url, delayMs: args.fontDelayMs },
      });
      setTimeout(() => {
        cdp.send("Fetch.continueRequest", { requestId }).catch(() => {});
      }, args.fontDelayMs);
    });
  }
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    await cdp.send("Page.screencastFrameAck", { sessionId });
    const buffer = Buffer.from(data, "base64");
    const hash = createHash("sha256").update(buffer).digest("hex");
    if (frameHashes.has(hash)) return;
    frameHashes.add(hash);
    frameSequence += 1;
    const filename = `${String(frameSequence).padStart(4, "0")}.png`;
    lastFrame = filename;
    frames.push({
      filename,
      capturedAtMs: Date.now() - captureStartedAt,
      pageScaleFactor: metadata.pageScaleFactor,
      offsetTop: metadata.offsetTop,
      scrollOffsetX: metadata.scrollOffsetX,
      scrollOffsetY: metadata.scrollOffsetY,
      timestamp: metadata.timestamp,
    });
    pendingWrites.push(writeFile(path.join(framesDirectory, filename), buffer));
  });
  await cdp.send("Page.startScreencast", {
    format: "png",
    everyNthFrame: 1,
    maxWidth: args.width,
    maxHeight: args.height,
  });

  record({ type: "navigation-start", detail: { url: variant.url } });
  const response = await page.goto(variant.url, {
    waitUntil: "load",
    timeout: 60_000,
  });
  record({
    type: "navigation-load-resolved",
    detail: { status: response?.status() ?? null },
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(args.settleMs);
  await page.screenshot({ path: path.join(directory, "final.png") });
  await cdp.send("Page.stopScreencast");
  await Promise.all(pendingWrites);
  for (const event of timeline) {
    const nearest = frames.reduce((best, frame) => {
      const distance = Math.abs(frame.capturedAtMs - event.receivedAtMs);
      return !best || distance < best.distance ? { frame, distance } : best;
    }, null);
    event.nearestFrame = nearest?.frame.filename ?? null;
    event.frameDeltaMs = nearest ? nearest.frame.capturedAtMs - event.receivedAtMs : null;
  }

  const cls = timeline
    .filter((event) => event.type === "layout-shift" && !event.detail.hadRecentInput)
    .reduce((total, event) => total + event.detail.value, 0);
  const report = {
    variant: variant.name,
    url: variant.url,
    settings: {
      latencyMs: args.latencyMs,
      downloadKbps: args.downloadKbps,
      fontDelayMs: args.fontDelayMs,
      settleMs: args.settleMs,
      viewport: { width: args.width, height: args.height },
    },
    summary: {
      distinctPaintedFrames: frames.length,
      geometryChanges: timeline.filter((event) => event.type === "geometry-change").length,
      layoutShiftEntries: timeline.filter((event) => event.type === "layout-shift").length,
      cumulativeLayoutShift: Number(cls.toFixed(6)),
      observedResponses: responses.length,
      encodedResponseBytes: Math.round(responses.reduce((total, item) => total + (item.encodedBytes ?? 0), 0)),
    },
    frames,
    responses,
    timeline,
  };
  await writeFile(path.join(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(directory, "index.html"), contactSheet(report));
  await context.close();
  await captureHtmlOnlyState(browser, variant, args, directory);
  return report;
}

async function captureHtmlOnlyState(browser, variant, args, directory) {
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.route("**/*", async (route, request) => {
    if (request.resourceType() === "document") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.goto(variant.url, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(directory, "html-only.png") });
  await context.close();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function contactSheet(report) {
  const eventSummary = report.timeline
    .filter((event) =>
      [
        "layout-shift",
        "geometry-change",
        "fonts-loading",
        "fonts-loadingdone",
        "fonts-ready",
        "DOMContentLoaded",
        "load",
      ].includes(event.type),
    )
    .map(
      (event) => `
      <tr>
        <td>${escapeHtml(event.receivedAtMs)}</td>
        <td>${escapeHtml(event.type)}</td>
        <td>${escapeHtml(event.nearestFrame ?? "—")}</td>
        <td><code>${escapeHtml(JSON.stringify(event.detail ?? {}))}</code></td>
      </tr>`,
    )
    .join("");
  const cards = report.frames
    .map(
      (frame) => `
      <figure id="${frame.filename}">
        <a href="frames/${frame.filename}"><img src="frames/${frame.filename}" loading="lazy"></a>
        <figcaption>${frame.filename} · ${frame.capturedAtMs} ms</figcaption>
      </figure>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${escapeHtml(report.variant)} load states</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 2rem; }
    header { max-width: 80rem; margin: auto; }
    .summary { display: flex; flex-wrap: wrap; gap: .75rem; padding: 0; }
    .summary li { list-style: none; border: 1px solid #8888; padding: .5rem .75rem; }
    .frames { display: grid; grid-template-columns: repeat(auto-fit, minmax(28rem, 1fr)); gap: 1rem; }
    figure { margin: 0; }
    img { display: block; width: 100%; border: 1px solid #8888; }
    figcaption { padding-block: .4rem; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin-block: 2rem; font-size: .8rem; }
    td, th { border-bottom: 1px solid #8888; padding: .4rem; text-align: left; vertical-align: top; }
    td:last-child { max-width: 55rem; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(report.variant)} load states</h1>
    <ul class="summary">
      ${Object.entries(report.summary)
        .map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(value)}</li>`)
        .join("")}
    </ul>
    <p>Every distinct compositor frame is below. The event table correlates geometry, font, and Layout Instability events with the most recently captured frame. Full data is in <a href="report.json">report.json</a>.</p>
    <h2>Dependency-cut state: HTML only</h2>
    <p>This state deliberately withholds every stylesheet, image, font, and script. Some browsers keep it behind a blank render-blocking paint; others expose it transiently.</p>
    <p><a href="html-only.png"><img src="html-only.png" alt="Root HTML rendered without any dependent assets"></a></p>
    <table>
      <thead><tr><th>ms</th><th>event</th><th>frame</th><th>detail</th></tr></thead>
      <tbody>${eventSummary}</tbody>
    </table>
  </header>
  <main class="frames">${cards}</main>
</body>
</html>
`;
}

function comparisonIndex(reports) {
  const cards = reports
    .map(
      (report) => `
    <section>
      <h2>${escapeHtml(report.variant)}</h2>
      <p>
        ${report.summary.distinctPaintedFrames} painted states ·
        ${report.summary.geometryChanges} geometry changes ·
        CLS ${report.summary.cumulativeLayoutShift}
      </p>
      <a href="${encodeURIComponent(report.variant)}/index.html">
        <img src="${encodeURIComponent(report.variant)}/final.png" alt="${escapeHtml(report.variant)} final state">
      </a>
      <p><a href="${encodeURIComponent(report.variant)}/index.html">Open every captured state</a></p>
    </section>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Load-state comparison</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 2rem; }
    header, main { max-width: 120rem; margin: auto; }
    main { display: grid; grid-template-columns: repeat(auto-fit, minmax(28rem, 1fr)); gap: 2rem; }
    section { min-width: 0; }
    img { display: block; width: 100%; border: 1px solid #8888; }
  </style>
</head>
<body>
  <header>
    <h1>Load-state comparison</h1>
    <p>Choose a variant to inspect its compositor frames and correlated browser events.</p>
  </header>
  <main>${cards}</main>
</body>
</html>
`;
}

export async function captureLoadStates(args) {
  const managedServers = [];
  let browser;
  const reports = [];
  try {
    let variants;
    if (args.url) {
      variants = [{ name: args.name || "custom", url: args.url }];
    } else {
      const instrument = await startHugo({
        name: "instrument",
        port: 1413,
        withLiveReload: args.withLiveReload,
      });
      managedServers.push(instrument.child);
      const system = await startHugo({
        name: "system",
        port: 1414,
        environment: "system",
        withLiveReload: args.withLiveReload,
      });
      managedServers.push(system.child);
      variants = [
        { name: "instrument", url: `${instrument.url}${args.path}` },
        { name: "system", url: `${system.url}${args.path}` },
      ];
    }

    browser = await chromium.launch({ headless: true });
    for (const variant of variants) {
      console.log(`Capturing ${variant.name}: ${variant.url}`);
      const report = await captureVariant(browser, variant, args);
      reports.push(report);
      console.log(
        `  ${report.summary.distinctPaintedFrames} frames, ` +
          `${report.summary.geometryChanges} geometry changes, ` +
          `CLS ${report.summary.cumulativeLayoutShift}`,
      );
    }
  } finally {
    await browser?.close();
    await Promise.all(managedServers.map(stopChild));
  }
  await mkdir(path.resolve(args.output), { recursive: true });
  await writeFile(path.resolve(args.output, "index.html"), comparisonIndex(reports));
  console.log(`Reports: ${path.resolve(args.output)}`);
}
