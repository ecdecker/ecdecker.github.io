# About
This is a blog site hosted at emilycdecker.com.
Only users mjdiloreto and ecdecker have access.
mjdiloreto is code-owner of the site and repository, ecdecker is the owner for content. 

Authoring / publishing can only be done by people with access to this repository.

# Content
Index is a profile page for Emily Decker, and Ph.D student at Duke studying Environmental Economics & Policy. Interested in clean energy transitions, environmental health impacts, climate change resilience, as well as the role of climate finance to address these issues.

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

# Externalities
- The domain name is provided by iwantmyname.com under the mjdiloreto account.
  - The instructions for the site owner to configure DNS records on iwantmyname are recorded at [DNS-SETUP.md](../DNS-SETUP.md)

- Content and citations can be synchronized from Box and Zotero: `npm run sync` <<todo-adopt-from-quarto-branch>>
  - That content is inferred through links and citations in markdown sources. <<todo-adopt-from-quarto-branch>>
  
- The site is hosted on GitHub pages.

# Technology
- The site uses hugo as its underlying Static Site Generator (SSG), and leverages built-in solutions wherever possible.
- The site maintains a 100 perfect Lighthouse score: measured manually, see [LIGHTHOUSE.md](../tools/LIGHTHOUSE.md).
- Loading states under a throttled connection are captured by `npm run site -- audit`.
- The site configures proper social media previews. <<todo-correct-meta-tags>>
- package.json scripts are the only valid entrypoint for user/developer actions on a checked-out repo.
  - tools are node scripts under /tools
  
## Theme
This site uses a custom theme called Folio, which is documented in the development-only (draft) post which exercises all of its features.
<<todo-reduce-existing-development-only-pages-to-one-all-encompassing-post>>

See the entire design system on one page by running `npm run site -- theme`.

## Scripts
`site` is the only npm script. Every action is a subcommand of it.

```sh
npm run site -- help                  # list every command
npm run site -- start                 # preview the site, including drafts
npm run site -- new "Article title"   # create a draft article folder
npm run site -- check                 # translations, images, and a full draft build
npm run site -- build                 # production build into public/
npm run site -- images                # optimize new or changed source images
npm run site -- doctor                # report whether the checkout is ready to use
```

Optional and advanced:

```sh
npm run site -- setup --audit         # install Chromium for the audit
npm run site -- audit                 # capture slow-network loading states
npm run site -- assets sprites        # regenerate the lemur sprite assets
npm run site -- assets fonts          # regenerate the optimized heading fonts
```

Run any command with `--help` for its options.

## AI Agents
- Most of the non-framework code that runs this site is AI-generated.
- Agents are informed how to behave in this repository via [AGENTS.md](../AGENTS.md)
- Agents are advised not to edit content in any way, but it is ultimately the responsibility of the site owners to verify and understand all output.
