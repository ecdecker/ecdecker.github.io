---
title: "Folio development exercise"
description: "One deliberately adversarial page covering the theme, authoring hooks, media pipeline, citations, and design system."
date: 2026-09-01
layout: exercise
lemurs: true
images:
  onDemand: true
---

This is the site's sole development-only page. It is mounted only in a
development build, so it can be awkward, exhaustive, and expensive without
creating a public route. Every specimen below corresponds to an automated
check or a feature that needs visual inspection.

## Prose and publication structure

The publication layout has to survive long-form prose rather than a tidy demo.
It carries headings, quotations, tables, lists, code, native footnotes, and
collected citations in the same document.

> The research involves developing nations, and it would be rude to consume
> their bandwidth for site inefficiencies.

| Connection | Respondents | Median allowance | Plates opened |
| --- | ---: | ---: | ---: |
| 2G | 19 | 500 MB | 3 |
| 3G | 21 | 1,000 MB | 6 |
| 4G | 22 | 1,500 MB | 9 |
| Fixed wireless | 18 | 2,000 MB | 11 |

1. Ordered lists keep their own rhythm.
2. The marker remains legible.
3. Nesting holds:
   - an unordered child,
   - and a second one.

Inline code such as `--space-2xl` stays on the baseline, while fenced code
scrolls rather than wrapping:

```go-html-template
{{- $usable := slice -}}
{{- range $widths }}
  {{- if le . $img.Width }}{{ $usable = $usable | append . }}{{ end }}
{{- end }}
```

Native footnotes retain their return links and acquire the localized Sources
heading.[^footnote] Institutions matter {{< cite "ostrom1990" >}}, image
measurement matters {{< cite "wang2004" >}}, and a repeated citation remains
one reference {{< cite "ostrom1990" >}}.

[^footnote]: This note verifies Goldmark's generated footnote structure.

{{< references >}}

## Responsive images

The first plate is eager and high-priority. Every later plate is lazy and,
because this page enables `images.onDemand`, enclosed in a closed disclosure.
Together the fixtures cover extreme aspect ratios, grayscale, undersized
sources, portrait orientation, transparency, shared assets, captions, alt
text, intrinsic dimensions, AVIF/WebP ladders, and the no-upscale rule.

![A soft vertical gradient, wider than it is tall](images/panorama.png "Plate I — Panorama, 1600×400")

![A grayscale gradient from white to ink](images/grayscale.png "Plate II — Grayscale")

![A small square gradient](images/narrow.png "Plate III — narrower than the smallest configured width")

![A tall swirled gradient](images/portrait.png "Plate IV — Portrait")

![Two overlapping circles on a transparent ground](images/alpha.png "Plate V — Transparency")

![A soft curve of paper against a plain ground](images/paper-curves.png "Plate VI — shared asset fallback")

![A workspace shot with tools laid flat](images/editorial-workspace.png "Plate VII — large source optimization")

![A fine-grained parchment texture](images/parchment-texture.png "Plate VIII — per-image quality lookup")

## Downloads and link destinations

Bundle files publish only when the Markdown link hook resolves them. These
links cover ordinary files, query and fragment suffixes, `./` prefixes,
percent-encoded Unicode, shared assets, directories, internal destinations,
external destinations, mail, telephone, and SMS schemes.

- [Download the dataset](links/survey-2026.csv)
- [Read the methodology](links/methodology.pdf)
- [Open page 3](links/methodology.pdf#page=3)
- [Open the second revision](links/survey-2026.csv?v=2)
- [Open a revision at row 5](links/survey-2026.csv?v=2#row=5)
- [Read the fieldwork log](./links/fieldwork-log.csv)
- [Read l'enquête](links/enqu%C3%AAte.csv)
- [Read the allowance data](prose/allowances.csv)
- [Open the shared swatch](fixtures/swatch.png)
- [Open this bundle](./)
- [Open the post index](/posts/)
- [Read the Hugo link-hook documentation](https://gohugo.io/render-hooks/links/)
- [Email the field team](MailTo:notes@example.org)
- [Call the field line](tel:+261201234567)
- [Message the field line](sms:+261201234567)

## Motion

The running lemur at the top exercises the CSS-only sprite animation. It is
decorative, absent from the accessibility tree, and removed under
`prefers-reduced-motion`. The page deliberately opts in through front matter so
ordinary pages pay no transfer cost.

## Live design-system specimens

The remaining sections are generated from the actual theme assets. Component
coverage is computed from the rendered specimens and stylesheet selectors;
the token gallery is parsed from `tokens.css`; and the optional image-quality
laboratory is enabled only by `npm run site -- start --image-lab`.
