---
title: "Links"
description: "Every destination shape the markdown link render hook has to handle, including the two that shipped broken."
date: 2026-07-26
---

A research note usually travels with its material. This page is a bundle
holding a survey extract and a methodology document alongside the prose,
referenced from plain markdown with no shortcode syntax.

[Download the dataset](survey-2026.csv) — 120 responses on connection type and
monthly data allowance, one row per respondent.

[Read the methodology](methodology.pdf) covers the sampling frame and the
weighting applied before any of the figures above are quoted.

Both links were written as `[text](file.csv)`. The hook resolves each one
against the bundle, which is also what causes the file to be published at all,
and appends the format and weight for readers deciding whether a download is
worth the megabytes.

Resolution falls through to the shared assets directory when the bundle has no
match, so [a swatch](fixtures/swatch.png) resolves too even though it is not a
sibling of this page.

That fallback carries a hazard worth stating. Resolving a link publishes the
file **as-is** — no resizing, no re-encoding — because the hook calls
`.RelPermalink` on the resource it finds. Pointing a link at one of the source
plates in `assets/images/` therefore ships a multi-megabyte original to the
reader, which is the exact outcome `build.publishResources = false` was
introduced to stop. The size annotation is the only guard, and it is advisory:
it tells a reader the download costs 9.6 MB, it does not stop the author
writing the link. Link to a derivative, or accept the weight knowingly. The
1 MB ceiling in `tools/check-exercises.py` is what makes an accident loud.

## Query strings and fragments

A destination is still a bundle file when it carries a suffix. Asking for
[the methodology, page 3](methodology.pdf#page=3) keeps the anchor, and
[the dataset, second revision](survey-2026.csv?v=2) keeps the cache-buster,
while both still resolve against the bundle and publish the file.

This shipped broken. The whole destination was handed to `GetMatch`, so
`survey-2026.csv?v=2` matched nothing; with `build.publishResources = false`
that meant the file was never published and the link 404'd. The suffix is now
split off before the lookup and reattached to the resolved URL. The size
annotation reads its extension from the permalink rather than the href, so the
suffixed links above report `(PDF, …)` and not `(PDF#PAGE=3, …)`.

## Contact schemes

[The field line](tel:+261201234567) and [the same number by
message](sms:+261201234567) stay dialable.

This shipped broken too. Go's `html/template` URL filter allowlists only
`http`, `https` and `mailto`, and rewrites every other scheme to a dead
`#ZgotmplZ` href — so a phone number, the plausible contact route for a
fieldwork contributor with no reliable mail, silently became a broken link.
Both schemes are now re-admitted by name.

The bypass is deliberately narrow. `http`, `https` and `mailto` stay on the
normal path so they keep their URL normalization, and every other scheme —
`javascript:` above all — still hits the filter and is still neutered. That
filter is what enforces the no-JavaScript invariant in the template engine
rather than by convention, so it is left doing its job.

## Everything else is left alone

Ordinary links keep behaving exactly as they did. An internal page reference
such as [one ink only](/posts/one-ink/) or a relative one such as
[the image exercises](../images/) resolves normally, an anchor like
[the section above](#contact-schemes) stays a fragment, an external link such as
[the Hugo documentation](https://gohugo.io/render-hooks/links/) is emitted
unchanged with no target and no icon, and [a mailbox](mailto:notes@example.org)
is still a mailbox.
