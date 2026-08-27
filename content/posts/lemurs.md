---
title: "Lemurs"
description: "A ring-tailed lemur climbs this card's left border, crosses the top, hangs and swings from it, then jumps off screen — the one thing on this site that moves without being asked to."
date: 2026-08-27
tags: ["motion"]
lemurs: true
---

Watch the left edge of this card. A lemur climbs it, hand over hand, turns
the corner, crosses the top border, hangs from it, swings twice, lets go,
and jumps off screen — gone until the loop brings it back.

## Why the system allows this

[[hairlines]] is the closest thing this project has to a constitution: one
hairline weight, no shadow, nothing competing with the headline. A climbing,
swinging lemur is the loudest thing that has ever shipped on this site, and
it shipped anyway, because delight was worth spending the one exception on.
It is decoration, not information — `aria-hidden`, and gone entirely under
`prefers-reduced-motion` — so the exception costs a reader nothing they
didn't opt into.

## How it moves

The source is a 6×4 sprite sheet: climbing, hanging, jumping, and turning,
six frames each. The site's `assets sprites` capability traces every frame to
SVG with potrace, and — new in this pass — also traces each row as one
image, all six frames side by side on an exact 1536×256 grid. That strip is
the whole trick: `background-size: 600% 100%` and a `steps(5)` animation
stepping `background-position-x` from 0% to 100% walks through the six
frames on a loop, the classic CSS spritesheet run-cycle, borrowed here for
vector art instead of a PNG.

A second, slower `@keyframes` block carries the lemur itself: `left` and
`top` trace the card's border, `transform: rotate()` handles the pendulum
swing, and `background-image` switches which strip is showing at each
stage. The two animations run independently and were never meant to stay in
step — like a looped GIF, the walk cycle only has to keep reading as motion,
not land on a particular frame at a particular instant.

## What it costs

Nothing on any other page. The markup, the four sprite strips, and the
`<style>` block that animates them are emitted only when a page's front
matter sets `lemurs: true` — this one does, nothing else does. No
JavaScript anywhere: the whole thing is two CSS animations on one
`position: absolute` element, which is also why it survives a slow
connection or an old browser without a fallback to write. Worst case, a
lemur that doesn't move is still a lemur sitting quietly in the corner.
