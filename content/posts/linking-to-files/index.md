---
title: "Linking to files in the bundle"
description: "A page bundle carrying a dataset and a methodology PDF, to exercise the markdown link render hook."
date: 2026-07-26
tags: ["method"]
---

A research note usually travels with its material. This post is a page bundle
holding a survey extract and a short methodology document alongside the prose,
referenced from plain markdown with no shortcode syntax.

[Download the dataset](survey-2026.csv) — 120 responses on connection type and
monthly data allowance, one row per respondent.

[Read the methodology](methodology.pdf) covers the sampling frame and the
weighting applied before any of the figures above are quoted.

Both links were written as `[text](file.csv)`. The hook resolves each one
against the bundle, which is also what causes the file to be published at all,
and appends the format and weight for readers deciding whether a download is
worth the megabytes.

## Query strings and fragments

A destination is still a bundle file when it carries a suffix. Asking for
[the methodology, page 3](methodology.pdf#page=3) keeps the anchor, and
[the dataset, second revision](survey-2026.csv?v=2) keeps the cache-buster,
while both still resolve against the bundle and publish the file. The suffix is
split off before the lookup and reattached to the resolved URL; without that the
lookup misses, the file is never published, and the link 404s.

## Everything else is left alone

Ordinary links keep behaving exactly as they did. An internal page reference
such as [one ink only](/posts/one-ink/) or a relative one such as
[field notes](../field-notes/) resolves normally, an anchor like
[the section above](#linking-to-files-in-the-bundle) stays a fragment, an
external link such as [the Hugo documentation](https://gohugo.io/render-hooks/links/)
is emitted unchanged with no target and no icon, and
[a mailbox](mailto:notes@example.org) is still a mailbox.

Contact schemes survive too: [the field line](tel:+261201234567) and
[the same number by message](sms:+261201234567) stay dialable rather than being
rewritten to a dead `#ZgotmplZ` href. Schemes that are not on that list — most
of all `javascript:` — are still stripped by Go's URL filter, which is what
keeps the no-JavaScript invariant enforced by the template engine and not by
convention.
