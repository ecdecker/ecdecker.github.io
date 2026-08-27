# Load-state capture harness

The harness records each distinct frame Chromium's compositor produces while
the page loads, then correlates those images with browser events that explain
layout changes:

- Layout Instability (`layout-shift`) entries, including affected elements and
  their old/new rectangles
- a per-animation-frame geometry scan of every rendered element
- `ResizeObserver` and `MutationObserver` events
- font loading, completion, and `document.fonts.ready`
- paint, largest-contentful-paint, resource, DOM-ready, and load events

It also creates `html-only.png` by deliberately withholding every dependent
asset. This records exactly what the root HTML response can render on its own.
With external CSS it exposes the unstyled DOM state that Chromium may otherwise
keep behind a blank render-blocking paint; with inline CSS it verifies that the
document-only state is already styled.

Chromium's transport-level network emulation throttles the response stream,
including progressive HTML delivery, while DevTools events record every request
and response. Font requests receive an additional controlled delay. This is
intended to expose intermediate UI states; it is a controlled approximation
rather than a packet-accurate 2G simulator.

## Run both typography variants

```sh
npm install
npm run site -- setup --audit
npm run site -- audit
```

That command starts isolated, in-memory Hugo servers for the Instrument Serif
and all-system variants with Hugo's live-reload client disabled, captures both,
and stops the servers afterward.

To include the preview server's live-reload client:

```sh
npm run site -- audit --with-live-reload
```

Artifacts are written to:

```text
artifacts/load-states/
├── index.html
├── instrument/
│   ├── index.html
│   ├── report.json
│   ├── final.png
│   ├── html-only.png
│   └── frames/*.png
└── system/
    └── ...
```

Open each `index.html` for its visual contact sheet. `report.json` contains the
full response and event timelines. Each event records both the frame present
when the event reached the harness and the nearest compositor frame, making
before/after races visible rather than hiding them.

## Useful variations

```sh
# Make the connection more hostile.
npm run site -- audit --latency-ms 700 --download-kbps 80

# Exercise another route and viewport.
npm run site -- audit --path /posts/ --width 390 --height 844

# Capture an already-running URL.
npm run site -- audit --url http://localhost:1313/ --name local
```

The frame sequence is exhaustive for one recorded browser run, not for every
possible browser/network schedule. Use a small matrix of routes, viewports,
cache states, and delay settings to cover the states that matter.
