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
npm run site -- theme
npm run site -- test
npm run site -- format
npm run site -- new "Article title"
npm run site -- check
npm run site -- build
```

- `start` previews drafts at <http://localhost:1313/> and watches for edits.
- `theme` serves the single development-only Folio exercise at
  <http://localhost:1313/exercises/> through the same local server.
- `test` checks JavaScript formatting and lint rules, then runs the CLI,
  budget, URL, synchronization, and artifact-policy tests.
- `format` formats the JavaScript tools, organizes their imports, and applies
  safe lint fixes.
- `new` creates `content/posts/<slug>/index.md` with safe draft front matter.
- `check` validates translation parity and research-map coordinates, reports
  stale image measurements, and performs a complete temporary build including
  drafts.
- `build` refreshes changed image measurements and writes a clean, minified
  production site to `public/`.

Use `--help` after any command to see its options.

## Offline authoring inputs and route baselines

```sh
npm run site -- sync box
npm run site -- sync zotero
npm run site -- baselines --update
```

Connecting Box for the first time — installing rclone, creating the remote,
and finding the real folder name — is documented step by step in
[BOX-SETUP.md](./BOX-SETUP.md).

Box mounts are configured in `package.json` under `emily.box.mounts`. Syncing
copies only files referenced beneath those site paths into the checked-in
`imports/box` snapshot. Zotero follows API pagination and writes sorted CSL-JSON
to `data/references.json`. Neither command runs during a build or deployment.

Use `{{< cite "ITEM_ID" >}}` in prose and place `{{< references >}}` where the
page's collected bibliography should appear. Missing item IDs fail the build.

### Box mounts and their sharp edges

- **Target convention.** Each mount maps one Box folder onto a site path of the
  form `/box/<name>/`, and links are written with that absolute prefix. The
  target is deliberately independent of the Box folder's own name, so renaming
  the folder in Box changes `source` and moves no published URL.
- **An unmounted `/box/…` path is a hard error, not a dead link.** The scanner
  refuses a `/box/…` reference that falls outside a configured mount rather
  than treating it as a missing file, so a mistyped prefix fails
  `npm run site -- check` instead of shipping. That is the typo guard; it is
  the reason the prefix is worth spelling exactly.
- **The scanner reads raw Markdown, including HTML comments.** It walks every
  `.md` file under `content/` and matches destinations with regular
  expressions rather than parsing the document, so an example link written
  inside an editorial `<!-- -->` comment still demands a real file in the
  snapshot. Break such an example —
  `content/research/index.md` writes `] (` with a space for exactly this
  reason — or the comment fails the build.
- **The snapshot needs both mounts, in both configurations.** In
  `config/_default/hugo.toml`, `imports/box` is mounted into `static` *and*
  into `assets`: static delivers the file at its public path, while assets is
  what the theme's `_markup/render-link.html` hook resolves against to
  annotate the link with its file type and size. Drop the assets mount and links still work but
  lose their annotation. Separately, `config/development/hugo.toml` must repeat
  the static mount, because declaring any `module.mounts` entry replaces the
  inherited array wholesale — Hugo re-supplies an implicit `static/` default
  but nothing for the Box snapshot. The exercise pass inside
  `npm run site -- check` builds with `--environment development`, so omitting
  it there reports every Box link as broken even though the production artifact
  is correct.

### Route baselines

The baseline update command accepts new HTML routes and refreshes their byte
ceilings. It cannot remove a preserved URL or weaken the absolute global caps.

Known cosmetic quirk: `auditOutput` reports every budget failure twice for any
route that has a baseline. It walks the baseline routes and then the measured
weights, and both loops call `budgetFailures` on a route present in both, so
the reported failure count is double the number of real problems. Harmless, but
confusing the first time a budget fails.

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
[`tools/LOAD-STATES.md`](../tools/LOAD-STATES.md) for options and interpretation.

## Advanced design assets

These commands are not needed for writing or publishing articles:

```sh
npm run site -- assets map
npm run site -- assets sprites

npm run site -- assets fonts --setup
npm run site -- assets fonts --check
npm run site -- assets fonts
```

Map downloads the pinned, one-bit world land mask and verifies its checksum
and dimensions. Normal builds are offline and use the checked-in copy.

Sprites installs what it needs (ImageMagick, potrace, svgo) automatically on
first run. Fonts' separate setup command installs the extra tools used only
by that pipeline.

## Continuous deployment

GitHub Actions uses the same interface as a local checkout:

1. `npm ci`
2. `npm run site -- test`
3. `npm run site -- check`
4. `npm run site -- build --base-url https://blog.emilycdecker.com/`

The resulting `public/` directory is deployed to GitHub Pages. Local and
hosted builds therefore use the same pinned Hugo version and command path.
