# Box Setup: connecting `npm run site -- sync box`

Box holds the papers, data, and reports that `/research/` links to. This
document is how the connection gets made, once, on one machine.

Read this alongside [AUTHORING.md](./AUTHORING.md), which covers what to
write; this covers only how the files arrive.

## What the connection actually is

There is no Box integration in the site. There is one command that shells
out to [rclone](https://rclone.org/), a file-copying tool, and asks it for
specific files by name:

    rclone copyto box:Research/paper.pdf imports/box/box/research/paper.pdf

`sync box` never browses Box and never mirrors a folder. It reads the
Markdown under `content/`, collects every `/box/...` link it finds, and
fetches exactly those files — nothing else. A file nobody links to is not
downloaded, and (see step 7) is rejected if it somehow appears anyway.

Three consequences worth holding on to:

- **The link comes first, the file second.** You write the link, then run
  the sync. Not the other way around.
- **Credentials live on your machine only.** rclone stores its token in
  its own config file in your home directory, never in this repository.
  `docs/CONSTRAINTS.md` ("Policy: privacy+isolation") requires that builds
  and deployments never receive them, and they never do — the checked-in
  snapshot under `imports/box` is what gets built.
- **The snapshot is reviewed and committed.** What ships is the copy in
  `imports/box`, in git, that a human looked at.

## 1. Install rclone

    sudo apt install rclone

Ubuntu 24.04 packages rclone 1.60.1, which is old but has supported Box
for years and is sufficient here. If you would rather have current
upstream, `https://rclone.org/install/` documents the official installer;
either works, and nothing in this project pins an rclone version.

Confirm it is on your PATH:

    rclone version

If you install rclone somewhere that is not on your PATH, set
`RCLONE_BIN` to its full path when running the sync. That environment
variable is the only supported way to point at a non-default binary.

## 2. Check that Duke allows it before you spend time on it

Duke's Box is an enterprise tenant, and Box lets an enterprise admin
restrict which third-party applications may connect to it. rclone connects
as a third-party application. This is the single most likely thing to
block you, and it is better to find out now than after step 4.

If step 4's authorization page refuses with wording about the application
not being authorized for your enterprise, this is what happened. Two ways
forward:

- ask Duke OIT to allowlist rclone's application for your account, or
- create your own Box application (Box Developer Console → "Create New
  App" → "Custom App" → "User Authentication (OAuth 2.0)") and give
  rclone its Client ID and Client Secret at step 3, instead of leaving
  those blank.

The second route does not need an admin, which is usually why people take
it.

## 3. Create the remote

    rclone config

Then:

    n                      (new remote)
    name> box
    Storage> box
    client_id>             (blank for rclone's own, or yours from step 2)
    client_secret>         (same)
    box_sub_type> user     (choose "enterprise" only for a service account)

Accept the defaults for anything else it asks.

**The name matters.** Whatever you type at `name>` is what `BOX_REMOTE`
must be set to later. This document assumes `box` throughout. If you name
it something else, substitute that everywhere below.

## 4. Authorize

rclone offers to open a browser ("Use auto config?"). Say yes if you are
sitting at a desktop machine; it starts a one-time local listener, sends
you to Box, and catches the response.

Say no if you are on a headless or remote machine. rclone then prints a
command to run on a machine that does have a browser, and waits for you
to paste the resulting token back.

Log in as Emily's Duke account — not a personal Box account. The sync can
only see what that account can see.

Finish with `q` to quit the config tool.

## 5. Confirm the remote works, and learn the real folder name

    rclone lsd box:

That lists the top-level folders of the Box account. You are looking for
the one holding the research documents.

**Write down its exact name.** `package.json` declares it under
`emily.box.mounts`:

```json
{ "source": "Research", "target": "/box/research/" }
```

`source` is a path relative to the root of the Box account and must match
the real folder name exactly, including capitalization and any spaces. If
the folder is actually called `Research Documents`, or sits inside
another folder as `Papers/Research`, change `source` to that.

`target` is the public URL prefix and should not change. That separation
is deliberate: renaming the folder in Box edits one line of `source` and
moves no published URL.

Check a file is reachable before going further:

    rclone ls box:Research

## 6. Write the links

In `content/research/index.md`, replace the placeholder paragraph with one
Markdown link per document, newest first:

    - [Title of the document](/box/research/file-name.pdf)

The same list goes in `index.fr.md` and `index.mg.md` — the documents
themselves are not translated, so all three pages link to the same files.

Four things make such a link build:

1. **The path begins with `/box/research/`**, the mount target. A `/box/…`
   path outside a configured mount is a hard error, not a dead link, so a
   mistyped prefix fails `npm run site -- check` instead of shipping. That
   is the typo guard, and the reason the prefix is worth spelling exactly.
2. **The file name matches Box exactly.** The sync asks for one precise
   path; it does not search.
3. **The link is a real link.** The scanner reads raw Markdown with
   regular expressions and does not skip HTML comments, so an example link
   inside a `<!-- -->` note still demands a real file. The editorial
   comment already in `content/research/index.md` writes `] (` with a
   space for exactly this reason — keep that break if you edit around it.
4. **Nothing is left over.** Step 7 rejects a snapshot file that no page
   links to, so deleting a link means re-running the sync, not just
   deleting the line.

## 7. Sync

    BOX_REMOTE=box npm run site -- sync box

`BOX_REMOTE` is the remote's name from step 3, not a path and not a URL.
Without it the command refuses to run rather than guessing.

The command rebuilds `imports/box` from scratch each time: it fetches
every referenced file into a temporary directory and swaps it into place
only once all of them succeed. A failed sync leaves the previous snapshot
untouched.

Then confirm the snapshot and the links agree:

    npm run site -- check

That fails loudly in both directions — a linked file missing from the
snapshot, and a snapshot file nothing links to.

## 8. Update the baselines and commit

New documents change page weight, so refresh the route ceilings:

    npm run site -- baselines --update

Commit the snapshot together with the page that links to it:

    git add content/research imports/box tools/site-baselines.json
    git commit

The snapshot belongs in git. It is the reviewed copy that gets built and
deployed, and it is the reason the build never talks to Box.

## 9. Verify

- `/research/` lists the documents, newest first, in all three languages.
- Each link shows its file type and size before the download.
- `npm run site -- check` passes.
- `npm run site -- build` passes, and no file exceeds the 1,048,576-byte
  limit without a recorded exception in `tools/site-baselines.json`.

## Known sharp edges

**A large PDF can blow the file-size cap.** No emitted file may exceed
1,048,576 bytes unless `tools/site-baselines.json` records both a reason
and a reviewer for an explicit exception. Scanned reports cross that line
easily. Either compress the PDF or record the exception deliberately.

**Rights before publishing.** `docs/CONSTRAINTS.md` ("Policy:
controlled-publishing+content-safety") requires every publication to be
reviewed for rights, attribution, and confidential data. A file being in
Box is not permission to publish it. Publisher-formatted PDFs in
particular are frequently not redistributable even by their own author;
an accepted manuscript usually is.

**The development build needs the mount too.** `config/development/hugo.toml`
must repeat the `imports/box` static mount, because declaring any
`module.mounts` entry replaces the inherited array wholesale. The exercise
pass inside `npm run site -- check` builds with `--environment development`,
so omitting it reports every Box link as broken even though the production
artifact is correct.

**Both mounts, in the default config.** `config/_default/hugo.toml` mounts
`imports/box` into `static` *and* into `assets`. Static delivers the file
at its public path; assets is what the theme's `_markup/render-link.html`
hook resolves against to annotate the link with its file type and size.
Drop the assets mount and links still work but lose their annotation.

**Tokens expire.** Box refresh tokens go stale if unused for long enough.
A sync that suddenly fails to authorize is fixed by re-running
`rclone config`, reconnecting the existing remote, and authorizing again.

## Where the Box configuration lives

| Location | What it sets |
|---|---|
| `package.json` (`emily.box.mounts`) | which Box folder maps to which site path |
| `BOX_REMOTE` environment variable | which rclone remote to fetch from |
| `RCLONE_BIN` environment variable | a non-default rclone binary path |
| rclone's own config file, in your home directory | the Box credentials — never in this repository |
| `imports/box` | the reviewed, committed snapshot that actually ships |
