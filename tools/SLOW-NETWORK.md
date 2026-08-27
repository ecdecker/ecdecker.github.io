# Slow-network findings

The homepage load states were recorded on 2026-07-27 with the Playwright
harness in [`capture-load-states.mjs`](capture-load-states.mjs). The run used
the harness defaults:

- 300 ms of response latency
- 250 Kbps of download throughput
- an additional 250 ms delay for font requests
- a 1440 × 1000 viewport
- reduced motion, blocked service workers, and no Hugo live-reload client

This is a controlled way to expose intermediate browser states, not a
packet-accurate reproduction of a specific cellular network.

## Verified result

| Measurement | Instrument Serif | System fonts |
| --- | ---: | ---: |
| Distinct compositor frames | 6 | 6 |
| First Contentful Paint | 1.20 s | 1.13 s |
| DOM ready | 1.39 s | 1.32 s |
| Load complete | 4.56 s | 3.48 s |
| Final image/LCP | 4.60 s | 3.52 s |
| Layout shift entries | 0 | 1 |
| Cumulative Layout Shift | 0 | 0.000039 |
| Responses | 4 | 2 |
| Encoded response bytes | 124,589 | 92,805 |

The timing values are relative to the start of each capture and are rounded to
two decimal places.

## Findings

The root HTML response is independently presentable. The harness blocks every
dependent stylesheet, image, font, and script for `html-only.png`; both
typography variants still render the complete layout with the intended colors,
spacing, borders, and hierarchy. Only the deliberately blocked image is
missing.

The progressive response produced blank and background-only frames before
content arrived, but it never exposed unstyled content. Once the header and
main card became visible, their styles were already applied.

Useful text arrived well before the hero image. First Contentful Paint occurred
at roughly 1.1–1.2 seconds, while the deferred AVIF completed at roughly
3.5–4.6 seconds and became the final Largest Contentful Paint candidate. The
page remained readable and interactive while that image was in flight.

The Instrument Serif variant requested two WOFF2 files. Both completed around
3.5 seconds without producing a layout-shift entry. The system-font variant
made no font requests. It recorded one 0.000039 shift while a small metadata
span widened during progressive parsing; the shift is visually negligible and
was not caused by a downloaded font.

The comparison also confirms the intended dependency reduction: the custom
typography path made four responses—HTML, image, and two fonts—while the
system-font path needed only HTML and the image. Neither path loaded
JavaScript.

## Reproduction

Install the local dependencies and browser once:

```sh
npm install
npm run site -- setup --audit
```

Run the default comparison:

```sh
npm run site -- audit
```

To make the network more hostile:

```sh
npm run site -- audit --latency-ms 700 --download-kbps 80
```

The ignored artifacts are written to `artifacts/load-states/`. Open its
`index.html` to compare the final states, then open each variant's
`index.html` for the full compositor sequence and event timeline. The
corresponding `report.json` contains the measurements summarized above.

See [`LOAD-STATES.md`](LOAD-STATES.md) for all options, artifact structure, and
guidance on interpreting the reports.

Measurements vary between runs and machines. A single capture is exhaustive
for that browser run, not for every possible network schedule; test a small
matrix of routes, viewports, cache states, and delay settings before treating a
state as covered.
