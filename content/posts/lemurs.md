---
title: "Lemurs"
description: "A ring-tailed lemur runs left to right along the top edge of this page, on a loop — the one thing on this site that moves without being asked to."
date: 2026-08-27
tags: ["motion"]
lemurs: true
draft: true
---

Watch the top of the page. A lemur runs across it, left to right, full
width, on a loop — gone off the right edge, back from the left a moment
later.

## Why the system allows this

[[hairlines]] is the closest thing this project has to a constitution: one
hairline weight, no shadow, nothing competing with the headline. A running
lemur is the loudest thing that has ever shipped on this site, and it
shipped anyway, because delight was worth spending the one exception on.
It is decoration, not information — `aria-hidden`, and gone entirely under
`prefers-reduced-motion` — so the exception costs a reader nothing they
didn't opt into.

## How it moves

The source is a 6×4 sprite sheet of poses — climbing, hanging, running,
turning — six frames each; only the running row ships here. `npm run site
-- assets sprites` traces each frame to SVG with potrace, and also traces
the whole row as one image, all six frames side by side on an exact
1536×256 grid. That strip is the whole trick: `background-size: 600% 100%`
and a `steps(6)` animation walking `background-position-x` from 0 to minus
six frame widths shows the six frames in turn, the classic CSS spritesheet
run-cycle, borrowed here for vector art instead of a PNG. The stepping is
in frame widths rather than percentages on purpose — `100%` aligns the
strip's right edge with the element's, so it lands on the *last* frame
rather than one past it, and a percentage sweep that assumes otherwise
samples between frames and paints two half-lemurs at once.

A second `@keyframes` block carries the lemur itself: a plain linear sweep
of `left` from off-screen left to off-screen right. The two have to stay
in step. The sprite row is a bounding gallop, so one turn of the run cycle
is one bound, and a bound covers a set distance of ground — traced off the
sheet, about 1.1 frame widths. Let the sweep cover meaningfully more than
that per cycle and the planted feet slide out from under the animal: it
stops reading as a lemur running and starts reading as a lemur skating.
So both durations come off one pair of numbers — the length of a bound and
the number of bounds in a crossing — which makes the crossing an exact
whole number of run cycles and leaves the two no room to drift apart.

## What it costs

Nothing on any other page. The markup, the one sprite strip, and the
`<style>` block that animates them are emitted only when a page's front
matter sets `lemurs: true` — this one does, nothing else does. No
JavaScript anywhere: the whole thing is two CSS animations on one
`position: absolute` element, which is also why it survives a slow
connection or an old browser without a fallback to write. Worst case, a
lemur that doesn't move is still a lemur sitting quietly at the top of the
page.
