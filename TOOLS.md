# Project tools

The repository has one command surface:

```sh
npm run site -- help
```

Do not install Hugo globally or invoke files under `tools/` directly. The
project installs and pins the versions it needs.

## Setup

Install Node.js 24 LTS, then run this once from the repository root:

```sh
npm install
npm run site -- doctor
```

`npm install` provides the pinned Hugo binary, image processing libraries,
configuration parsers, SVG optimization, and the browser-audit library. The
large Chromium download is optional:

```sh
npm run site -- setup --audit
```

## Everyday commands

```sh
npm run site -- start
npm run site -- new "Article title"
npm run site -- check
npm run site -- build
```

- `start` previews drafts at <http://localhost:1313/> and watches for edits.
- `new` creates `content/posts/<slug>/index.md` with safe draft front matter.
- `check` validates translation parity, reports stale image measurements, and
  performs a complete temporary build including drafts.
- `build` refreshes changed image measurements and writes a clean, minified
  production site to `public/`.

Use `--help` after any command to see its options.

The expensive visual image-comparison laboratory is excluded from the normal
preview. Start it explicitly with `npm run site -- start --image-lab` when it
is needed.

## Image optimization

The production build runs image preparation automatically. To run or inspect
it separately:

```sh
npm run site -- images
npm run site -- images --check
```

Only new or changed source images are measured. Hugo creates the actual AVIF
or WebP candidates, Sharp decodes them, and the project selects the cheapest
quality that meets the configured SSIM floor. Results are cached by source
hash in `data/imagequality.json`.

Generated sprite PNGs and their source sheet are excluded because they are
intermediate design assets, not responsive article images.

## Optional diagnostics

Install the audit browser once, then capture the Instrument Serif and
system-font variants under a controlled slow connection:

```sh
npm run site -- setup --audit
npm run site -- audit
```

Reports are written under `artifacts/load-states/`. See
[`tools/LOAD-STATES.md`](tools/LOAD-STATES.md) for options and interpretation.

## Advanced design assets

These commands are not needed for writing or publishing articles:

```sh
npm run site -- assets sprites --setup
npm run site -- assets sprites

npm run site -- assets fonts --setup
npm run site -- assets fonts --check
npm run site -- assets fonts
```

The setup commands install the extra tools used only by those pipelines.

## Continuous deployment

GitHub Actions uses the same interface as a local checkout:

1. `npm ci`
2. `npm test`
3. `npm run site -- check`
4. `npm run site -- build --base-url https://emilycdecker.com/`

The resulting `public/` directory is deployed to GitHub Pages. Local and
hosted builds therefore use the same pinned Hugo version and command path.
