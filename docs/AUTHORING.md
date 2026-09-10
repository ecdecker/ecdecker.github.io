# Authoring

How writing becomes a published page: the browser editor, who owns which
files, and the front-matter contract behind the homepage research map.

For the plain, step-by-step version of the same ground, see
[`README.org`](../README.org) at the repository root. This note records the
boundaries and the reasoning that guide is deliberately quiet about.

## Pages CMS

Pages CMS is an optional browser editor over the same Git repository used by
GitHub's file editor and local checkouts. It does not replace Hugo, GitHub
Actions, GitHub's editor, local Markdown tools, Box, or Zotero. Every Pages CMS
save is an ordinary Git commit. Saves merged to the publishing branch (`main`) pass
through the existing build and deployment workflow.

### Try the branch

1. Open <https://app.pagescms.org/> and sign in with GitHub.
2. Install the Pages CMS GitHub App for `mjdiloreto/emilycdecker.com` only.
   Do not grant it access to every repository.
3. Open the repository and select the `pagescms` branch. Pages CMS reads
   `.pages.yml` separately on each branch.
4. Create a note, leave **Draft** enabled, and save it. The expected path is
   `content/posts/<slug>/index.md`.
5. Inspect the commit on GitHub and run `npm run site -- check` in a checkout,
   or manually dispatch the Pages workflow against the `pagescms` branch.
6. Disable **Draft** only after the note is ready to publish.

The static `/admin/` page is merely a convenient handoff to the hosted editor.
It contains no JavaScript and is not an authentication boundary. Only the two
repository owners should be authorized in GitHub/Pages CMS.

## Ownership boundaries

Each article must have one authoring authority:

- Pages CMS, GitHub, and local editors may edit ordinary source notes under
  `content/posts/**` because all three write the same Git-controlled files.
- Box owns its one-way imported snapshot, refreshed only with
  `npm run site -- sync box` (reserved path: `imports/box/**`). Do not expose or manually edit
  that snapshot in Pages CMS.
- Zotero owns the generated bibliography, refreshed only with
  `npm run site -- sync zotero` (reserved path: `data/references.json`). Do not expose or manually
  edit it in Pages CMS.

Pages CMS deliberately configures only `content/posts`; neither synchronized
path is a CMS collection. `settings.content.merge: true` preserves front matter
outside the form schema, including aliases, bibliography/citation metadata,
execution settings, and image options.

This means the explicit sync commands can refresh Box and Zotero without
making Pages CMS the only way to work in the repository. Conversely, never
author the same article independently in Box and `content/posts`, because a
one-way snapshot cannot safely reconcile two authorities.

## Markdown and media

The visual editor handles ordinary Markdown. Switch to **Source** mode before
editing Hugo shortcodes, footnotes, citation syntax such as
`[@citation-key]`, or other constructs the visual editor may not understand.
The homepage is intentionally not exposed because its body is structured with
Hugo shortcodes.

Pages CMS uploads go to `assets/uploads/`. The existing Hugo render hooks and
image pipeline resolve `/uploads/<filename>` from that shared asset directory.
Article-local page bundles remain supported and are preferable when using a
local checkout, GitHub, or Box: keep those files beside the article and link
them by filename.

Renaming and deleting notes are disabled in Pages CMS because either can break
published URLs. Hide a note with `draft: true`; use Git directly for a reviewed
rename or deletion.

## Concurrency and recovery

Pages CMS does not lock files against other Git clients. Before local work,
pull the latest branch; before saving a long browser edit, check that no sync or
person changed the same note. Git history remains the recovery mechanism for
all authoring surfaces.

The hosted app and its GitHub App must be authorized manually, so an offline
repository test cannot prove a remote save. Before merging this branch, verify
a draft save on `pagescms` and manually dispatch its Pages workflow. After
merging `.pages.yml` to `main`, verify a draft save there and confirm the
normal push workflow. Test publishing by disabling **Draft** only with content
that is genuinely ready for the live site.

## The homepage research map

The homepage research map is a progressively enhanced list of links drawn on a
geographically faithful world land mask. A post joins the map by declaring one or more
`locations` in front matter; Hugo projects those coordinates and writes normal
links into the SVG at build time.

### Content contract

```yaml
locations:
  - name: "Saint Paul, Minnesota, United States"
    latitude: 44.9537
    longitude: -93.09
```

`locations` is optional and repeatable. Presence alone opts the post into the
map, avoiding a second tag or checkbox that could disagree with the coordinate
data. The build rejects missing names, non-numeric values, latitudes outside
-90…90, and longitudes outside -180…180.

In Pages CMS the same contract appears as the **Research locations** field, a
repeatable group of place name, latitude, and longitude. South and west are
negative. Pages CMS applies the same numeric bounds in its authoring controls,
and `npm run site -- check` rejects an incomplete place or an out-of-range
coordinate before publication.

Only pages available in the current language are mapped. Drafts remain visible
in the normal preview but cannot leak into a production map, and an
untranslated English note does not appear as fallback content on translated
homepages.

### Performance plan

The component has three firm constraints:

- no JavaScript, tile service, remote subresource, or browser-side data fetch;
- the land image uses native lazy loading and remains a local resource;
- map-only CSS must not inflate article or taxonomy responses.

The land source is COBE's 256×128, one-bit equirectangular mask, derived from
Wikimedia's public-domain `World_map_blank_without_borders.svg`. The local
image uses `loading="lazy"`; its dimensions reserve the complete map area while
the immediately available SVG overlay provides linked markers. Each pixel
represents 1.40625 degrees in both axes. This is accurate at the component's
display scale, though it is deliberately not a political-boundary or survey
map.

`npm run site -- assets map` can reproduce the checked-in mask from a pinned
COBE revision. The command and every build verify its SHA-256 checksum and
256×128 dimensions. A detailed GeoJSON outline or mapping library would spend
substantially more bytes without improving location selection at this scale.

The shared inline-CSS partial compiles both the global bundle and the separate
homepage map bundle. The map-specific CSS is 1,306 bytes (533 bytes with
deterministic gzip), and the lazy land image is 1,108 bytes. The 2026-09-04
production measurement is 91,600 bytes cold / 63,371 bytes gzip and 39,282
bytes cached / 11,022 bytes gzip. Run `npm run site -- build` to print the
current measurement after future changes.
