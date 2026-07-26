---
title: "Field notes, with plates"
description: "A page bundle carrying its own images, to exercise the markdown render hook."
date: 2026-07-26
tags: ["method"]
---

This post is a page bundle: its images sit alongside the text as ordinary
sibling files. The markdown below references them by filename, with no
shortcode syntax and no template calls.

![A workspace, overhead](workspace.png "Plate I — the working surface")

Prose continues between plates. That interleaving is the normal shape of this
material, so the image handling has to disappear into plain markdown rather
than demand special authoring.

## A second plate

The render hook resolves each reference against the bundle first, then against
the shared asset directory, so a post can mix its own images with ones used
across the site.

![Folded paper, raking light](curves.png "Plate II — raking light")

Both plates above were written as `![alt](file.png "caption")`. Everything
else — the format negotiation, the width ladder, the lazy loading — is
handled by the theme.
