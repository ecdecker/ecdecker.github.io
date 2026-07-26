---
title: "One ink, no accents"
description: "The palette is a single warm neutral family plus one action color. There is no third thing."
date: 2026-07-24
tags: ["color"]
---

Background is Bone — the only page color in the entire system. Surfaces are Snow,
separated from Bone by nothing but a Mist hairline. Text is Ink for headlines and
Stone for everything quiet.

That is the whole palette. Six tones, one of which is pure white.

## No accent

There is no accent color, no gradient, and no tinted hover state. If a component
needs to assert importance, it does so by becoming more typographic — larger, or
set in the serif — not more colorful.

Hover is a 1px lift on a primary button, or a Whisper infill on a secondary. It
is never a color change.

## The one exception

A single `error` token exists for destructive states, and even there it is used
as a text color rather than a surface fill. An input with a validation error does
not turn its border red; the helper line beneath it changes color instead.
