---
title: "Research"
description: "Papers, data, and reports, published here as direct downloads."
---

Papers, data, and reports are published here as direct downloads: every link is
the file itself.

<!--
<<todo-research-documents>> Replace the single paragraph below this comment
with the list of documents, newest first, one Markdown link per document:

    - [Title of the document] (/box/research/file-name.pdf)

Write that link with no space between ] and (. The space is here only because
`npm run site -- sync box` scans this file as raw Markdown and does not skip
comments, so a literal link inside this note would demand a real file before
the site would build.

Three things make such a link build:

1. The path is absolute and begins with /box/research/. That prefix is the Box
   mount declared in package.json under emily.box.mounts, which maps the Box
   folder named "Research" onto it. A /box/... path that falls outside a
   configured mount is a hard error rather than a dead link, so a mistyped
   prefix fails `npm run site -- check` instead of shipping.
2. The file sits in that Box folder under exactly the file name written here.
   <<todo-box-source-folder>> If Emily's Box folder is not literally named
   "Research", change emily.box.mounts[0].source in package.json to its real
   relative path; the target stays /box/research/ so published URLs do not move.
3. `npm run site -- sync box` has been run (it needs rclone and BOX_REMOTE) and
   the files it wrote under imports/box are committed alongside this page. The
   check fails while a linked file is missing from that snapshot, and fails
   again if the snapshot holds a file that nothing links to.

The same list belongs in index.fr.md and index.mg.md: the documents themselves
are not translated, so all three pages link to the same /box/research/ files.

Two known gaps sit outside this page and both need a two-mount edit to
config/development/hugo.toml and config/_default/hugo.toml, because declaring
any module mount replaces the inherited array wholesale:

  - the development build does not publish imports/box, so the exercise check
    inside `npm run site -- check` calls every Box link broken even though the
    production artifact is correct;
  - a Box link carries no file type and size after it, because the link render
    hook annotates only what it can resolve in the assets tree.

Both were reproduced and fixed in a scratch copy when this page was added; the
fix moves no URL.
-->

Nothing has been published here yet.
