# Pages CMS authoring

Pages CMS is an optional browser editor over the same Git repository used by
GitHub's file editor and local checkouts. It does not replace Hugo, GitHub
Actions, GitHub's editor, local Markdown tools, Box, or Zotero. Every Pages CMS
save is an ordinary Git commit. Saves merged to the publishing branch (`main`) pass
through the existing build and deployment workflow.

## Try the branch

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
