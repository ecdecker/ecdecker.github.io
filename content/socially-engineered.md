---
title: "Socially Engineered"
description: "The cost of opening this site, measured in data, time and demands on the reader."
date: 2026-07-28
---

A website asks every reader to provide some of its infrastructure: a device, a
connection, electricity and, often, a prepaid data balance. Those demands are
minor for some people and decisive for others. They belong in the design.

In 2024, only [19% of people in Madagascar used the
internet](https://data.worldbank.org/country/madagascar). Across low-income
economies, an entry-level mobile broadband plan takes about [22 times as much
of the average income](https://www.itu.int/itu-d/reports/statistics/2025/10/15/ff25-affordability-of-ict-services/)
as it does in high-income economies. [A study spanning 56
cities](https://nchr.elsevierpure.com/en/publications/towards-a-world-wide-web-without-digital-inequality/)
found that web pages could cost orders of magnitude more and load four times
more slowly in disadvantaged places.

This site therefore treats transferred data as an accessibility budget. The aim
is not to offer a diminished version of the web. It is to put the research
ahead of its container.

## This page, measured

> The complete, immediately readable document is **10.8 kB**.
> A first visit that also fetches the serif's roman and italic font files is
> **40.6 kB**.

These are compressed production-build figures, not the size of the source
files. The first number includes every word, the layout and the full
stylesheet. The second adds the two font files a browser may request on a cold
visit.

| Part of the visit | Transfer | What arrives |
| --- | ---: | --- |
| Essential document | 10.8 kB | Text, structure and inline CSS |
| Optional serif type | 29.8 kB | Two cached WOFF2 files |
| First visit with both fonts | 40.6 kB | The complete designed page |
| Later visit with fonts cached | 10.8 kB | The document only |

The [10 KB Club](https://10kbclub.com/) collects noteworthy homepages below a
10 KB compressed-transfer budget. This document narrowly misses that mark, and
the full cold visit is larger because of the optional type. That distinction
matters. A small HTML file that quietly calls several megabytes of scripts and
images is not a small page.

<<todo-can-we-use-a-minimal-font-that-still-looks-similar?>>

For scale, the [2024 HTTP
Archive](https://almanac.httparchive.org/en/2024/sustainability) found that the
median mobile page transferred just under 2 MB. Its 90th-percentile page
reached about 7.2 MB. This page's full first-visit payload is roughly 50 times
smaller than that median.

## What a visit costs

Madagascar has competing mobile brands, not a single mobile monopoly. A [World
Bank assessment](https://documents1.worldbank.org/curated/en/099350005162234945/pdf/P1707240c74c000f40920204d74f8ae1770.pdf)
nonetheless describes a highly concentrated market dominated by Telma—now
Yas—Orange and Airtel. Telma also controls the national fibre backbone.

The prices below are ordinary 30-day prepaid bundles published by Yas and
Airtel. Both cost 15,000 ariary, which makes the difference in data allowances
easy to see. The figures are the portion of an already-purchased bundle used by
one visit; neither company bills a separate fee for opening a page.

| Network and published bundle | Document only | First visit with fonts |
| --- | ---: | ---: |
| Yas · Net Month 15000 · 2.5 GB for 15,000 Ar | 0.062 Ar | 0.241 Ar |
| Airtel · Net Mlay-15000 · 6 GB for 15,000 Ar | 0.026 Ar | 0.100 Ar |

A 2 MB page, close to the present mobile-web median, would use about 12 Ar of
the same Yas bundle or 5 Ar of the Airtel bundle. One page view is still a
small expense. Page after page, the design of the web decides how quickly a
balance is spent.

Orange also sells mobile data in Madagascar, but its public page sends current
prices through a separate purchase service. It is omitted rather than filled
with a figure that cannot be checked openly. Prices here were checked on 28
July 2026 and will change.

## What the site does with its budget

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

Restraint has costs of its own. Static publishing can move technical work from
a large platform onto researchers and maintainers. The digital-humanities
literature calls this out directly: [minimizing computing can maximize
labour](https://www.digitalhumanities.org/dhq/vol/16/2/000594/000594.html).
This site keeps its machinery documented and small enough for another person
to understand, but it does not pretend that maintenance is free.

## What the numbers cannot say

Transferred bytes are measured. Carbon per page view is modelled.

The widely used [Sustainable Web Design
Model](https://sustainablewebdesign.org/estimating-digital-emissions/) starts
with data transfer and estimates a share of energy used by data centres,
networks and devices. Its authors describe bytes as a proxy. The relationship
is not linear in the physical network: routers and mobile towers consume power
while waiting for traffic, and infrastructure is built for peaks rather than
for one page at a time. Research on [data-transfer energy
intensity](https://link.springer.com/article/10.1111/jiec.13513) warns against
claiming that a given reduction in bytes prevents an equal percentage of
emissions.

For that reason, this page does not turn its transfer size into a precise
number of grams of carbon. Smaller pages reduce demand on storage, networks and
devices; they also load sooner, work on older hardware and leave more of a
reader's data allowance intact. Those are useful, verifiable outcomes. They
are not proof that one page is sustainable in isolation.

The broader standard is the draft [W3C Web Sustainability
Guidelines](https://www.w3.org/TR/web-sustainability-guidelines/), which treats
sustainability as a question of people, planet and prosperity. It includes
accessibility, maintainability, hosting, organizational practice and material
waste alongside data transfer. That is the standard this page is trying to
approach.

## Notes and sources

Sizes were measured from the minified production build. The HTML was compressed
with `gzip -9 -n`; `-n` removes the filename and timestamp from the gzip header.
The figures count response bodies and exclude protocol headers, encryption
overhead and a browser's possible request for the site icon. Bundle calculations
treat 1 GB as 1,000,000,000 bytes:

`transferred bytes ÷ bundle bytes × bundle price = share of bundle`

Further reading:

- [The 10 KB Club discussion on Hacker
  News](https://news.ycombinator.com/item?id=33680852), including the limits of
  page weight as a test of speed or quality.
- [Towards a World Wide Web without digital
  inequality](https://nchr.elsevierpure.com/en/publications/towards-a-world-wide-web-without-digital-inequality/),
  a 2023 peer-reviewed study of cost, performance and low-end devices.
- [A Framework for Improving Web Affordability and
  Inclusiveness](https://www.ietf.org/slides/slides-biasws-a-framework-for-improving-web-affordability-and-inclusiveness-00.pdf),
  based on more than 72,000 measured pages.
- [How to Build a Low-tech
  Website](https://solar.lowtechmagazine.com/2018/09/how-to-build-a-low-tech-website/),
  a design precedent that makes infrastructure and compromise visible.
- [The Questions of Minimal
  Computing](https://www.digitalhumanities.org/dhq/vol/16/2/000646/000646.html),
  which asks what a project needs, has, prioritizes and is willing to give up.
- [Platitudes: The Carbon Weight of the Post-Platform Scholarly
  Web](https://journals.publishing.umich.edu/jep/article/7247/galley/5133/download/),
  a recent case study of lightweight scholarly publishing, preservation and
  labour.

Plan sources: [Yas mobile
internet](https://www.yas.mg/particulier/forfaits-mobiles/internet/),
[Airtel data bundles](https://www.airtel.mg/internetservice/databundle) and
[Orange mobile data](https://www.orange.mg/fr/akama-et-be-connect.html).
