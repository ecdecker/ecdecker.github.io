---
title: "Tokens"
description: "Every custom property in tokens.css, rendered as a live specimen rather than a transcription."
date: 2026-07-27
layout: exercise-tokens
---

Nothing on this page is hand-written. The gallery parses
`assets/css/tokens.css` at build time and renders `var(--name)` for each
property it finds, so the specimens show the values actually in effect. Add a
token and it appears here; delete one and it disappears. A transcribed gallery
would drift and then quietly report coverage it no longer has.
