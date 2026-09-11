# About
This is a blog site hosted at blog.emilycdecker.com.
Only users mjdiloreto and ecdecker have access. Here, “access” means repository write and administration access; the built site is intentionally public and readable without an account.
mjdiloreto is code-owner of the site and repository, ecdecker is the owner for content. 

Authoring / publishing can only be done by people with access to this repository.

## Documents

| Question | Document |
|---|---|
| What are the rules? | this file |
| What must the site owner do herself? | [SITE-OWNER.md](./SITE-OWNER.md) |
| How is writing published, and who owns which files? | [AUTHORING.md](./AUTHORING.md), and [README.org](../README.org) for the plain guide |
| How do I run, check, and build the project? | [TOOLS.md](./TOOLS.md) |
| How is the domain pointed at the site? | [DNS-SETUP.md](./DNS-SETUP.md) |

Outstanding work is tracked in [TODO.md](./TODO.md).

# Content
Index is a profile page for Emily Decker, a Ph.D student at Duke studying Environmental Economics & Policy. Interested in clean energy transitions, environmental health impacts, climate change resilience, as well as the role of climate finance to address these issues. This describes the intended subject matter rather than the current implementation: the published index is the Folio homepage in English, French, and Malagasy.

This site is [socially engineered](../content/socially-engineered.md).

# Site Policies
The socially engineered blog post describes some of the site's policies:
- There is no JavaScript, advertising, analytics or tracking.
- The stylesheet travels inside the document, so readable text does not wait
  for another request.
- Body copy uses the typeface already installed on the reader's device.
- The serif used for headings is optional. Its fallback is matched to the same
  proportions, which prevents the page from jumping if the font is skipped or
  arrives late.
- Images elsewhere on the site are resized for the screen and supplied as AVIF
  or WebP. Images below the first one load later; an article can keep
  non-essential plates closed until a reader asks for them.
- Links to datasets and papers show the file type and size before the download.
- Pages are built as static files. They require little server work and remain
  straightforward to archive.

Additionally, the creation of the site itself follows these additional policies.

## Policy: simplicity+minimalism
This project intends to remain as simple and minimal as possible, without sacrificing other constraints.

## Policy: transfer-size
- This site maintains strict thresholds in terms of transferred data.
- Every page adheres to strict non-content maximum transfer size, the measurement of which gates deployment.

## Policy: no-js
The site itself serves no javascript whatsoever.
This also gates deployment.
Potential exceptions and their current status are recorded below:

| JS exception instance | Status                    | Link |
|-----------------------|---------------------------|------|
| search                | Unimplemented - postponed |      |
| /admin Pages CMS      | No exception: static handoff to the externally hosted editor | [source](../static/admin/index.html) |
| ProfilePage/Person JSON-LD (homepages only) | Implemented -- a `<script type="application/ld+json">` block never executes; the audit's blanket script ban carries one narrowly-scoped exemption for the minifier's unquoted rendering of exactly this tag | [source](../themes/folio/layouts/home.html), [audit exemption](../tools/lib/site-audit.mjs) |

# Externalities
- The domain name is provided by iwantmyname.com under the mjdiloreto account.
  - The instructions for the site owner to configure DNS records on iwantmyname are recorded at [DNS-SETUP.md](./DNS-SETUP.md)

- Content and citations can be synchronized from Box and Zotero: `npm run sync`  is the retired command spelling; the supported offline authoring commands are `npm run site -- sync box` and `npm run site -- sync zotero`, and they write reviewed, checked-in snapshots.
  - That content is inferred through links and citations in markdown sources.  Box synchronization scans Markdown links, images, reference definitions, and HTML `href`/`src` values below configured mounts; citation shortcodes resolve only IDs present in the checked-in CSL-JSON data.
  
- The site is hosted on GitHub pages.

# Technology
- The site uses hugo as its underlying Static Site Generator (SSG), and leverages built-in solutions wherever possible.
- The site maintains a 100 perfect Lighthouse score: measured manually, see [LIGHTHOUSE.md](../tools/LIGHTHOUSE.md). The recorded score is a point-in-time baseline, not a permanent guarantee: Lighthouse results vary with its version, browser, machine, and network. The site aspires to WCAG 2.2 AA, but accessibility is not newly automated or release-gated by this policy.
- Loading states under a throttled connection are captured by `npm run site -- audit`.
- The site configures proper social media previews.  Every rendered page carries absolute, same-origin Open Graph and Twitter metadata for a deterministic 1200×630 local JPEG; homepages use the website card type and other pages use the article card type.
- package.json scripts are the only valid entrypoint for user/developer actions on a checked-out repo.
  - tools are node scripts under /tools
  
## Theme
This site uses a custom theme called Folio, documented by a development-only
exercise that covers all of its features.
The theme has one all-encompassing development-only exercise at `/exercises/`.
It is mounted only in development and image-laboratory environments, never in
the production content tree.

See the entire design system on one page by running `npm run site -- theme`.

## Scripts
`site` is the only npm script. Every action is a subcommand of it, and
`package.json` scripts are the only supported entrypoint for a checked-out
repository.

```sh
npm run site -- help                  # list every command
```

The full command surface, including setup, the offline Box and Zotero inputs,
route baselines, and the design-asset pipelines, is documented once in
[TOOLS.md](./TOOLS.md). Run any command with `--help` for its options.

## AI Agents
- Most of the non-framework code that runs this site is AI-generated.
- Agents are informed how to behave in this repository via [AGENTS.md](../AGENTS.md)
- Agents are advised not to edit content in any way, but it is ultimately the responsibility of the site owners to verify and understand all output.

## Policy: privacy+isolation
- A production artifact contains no JavaScript, remote page-load subresources, advertising, analytics, tracking pixels, cookie access, or browser-storage tracking. External destinations are allowed only as reader-initiated navigation. Verification is artifact-only rather than a live cookie or request-origin monitor.
- Box and Zotero are offline authoring inputs. Synchronization is explicit, fetches only referenced material, and writes reviewed snapshots under `imports/box` and Hugo's data tree. Builds and deployments never access either service or receive their credentials.
- A missing or remote Markdown image is a fatal build error. The production audit also rejects remote fonts and media, broken internal links and fragments, missing image alternatives or dimensions, scripts and JavaScript artifacts, tracking constructs, development routes, draft or future routes, untranslated article fallback routes, escaped source images, build artifacts, and oversized files.

## Policy: localization+preservation
- English remains the default language. French and Malagasy must maintain translated chrome and homepage structural parity. An untranslated article does not acquire a fallback URL under either translated language.
- Every emitted HTML route is recorded in `tools/site-baselines.json`. A recorded public URL must remain a page, redirect, or deliberate tombstone. `npm run site -- baselines --update` may accept new routes and refresh their ceilings, but cannot delete preserved routes or weaken the absolute caps.

## Policy: production-budgets
- Budgets count response bodies only and measure both uncompressed bytes and deterministic level-9, nameless gzip bytes. A cold load includes HTML, both referenced fonts, the favicon, other eager resources, and the largest-byte encoding among the widest candidates for each eager image. A cached load includes HTML. Lazy media and reader-initiated downloads are excluded.
- Absolute cold-load caps are 150,000 uncompressed bytes and 100,000 gzip bytes. Absolute cached-load caps are 45,000 uncompressed bytes and 15,000 gzip bytes.
- Every route also has four ceilings initialized to `ceil(current bytes × 1.10)`. No emitted file may exceed 1,048,576 bytes unless `tools/site-baselines.json` records both the reason and reviewer for an explicit exception.

## Policy: controlled-publishing+content-safety
- Publishing occurs only from the exact `refs/heads/main` ref. The build job has read-only contents access; only the deploy job receives Pages and OIDC permissions. Node, Hugo, npm dependencies, and GitHub Actions are immutably pinned.
- Global code ownership belongs to `mjdiloreto`; `ecdecker` additionally owns `content/`, Box snapshots, and bibliography data. Every publication is reviewed for rights, attribution, confidential data, human review of machine translation, stable URLs, and the correct owner approval.
- Repository administrators must rename the default branch to `main`, require the site checks and CODEOWNERS review, dismiss stale reviews, enable secret-scanning push protection, and prohibit direct production pushes, as recorded in [SITE-OWNER.md](./SITE-OWNER.md).
