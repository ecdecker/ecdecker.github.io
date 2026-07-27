---
title: "Exercises"
description: "Pages that drive every component and every capability of the site, so regressions surface here instead of in production."
---

These pages exist to be broken. Each one drives some capability of the theme
hard enough that a regression shows up as a visible defect or a failing
assertion, rather than reaching a reader.

They are mounted into the content tree only when `environment` is
`development`, which is the default for `hugo server` and never the case for a
deployed build. Nothing here is reachable on the public site — not unlisted,
absent. Run `python3 tools/check-exercises.py` to assert the invariants these
pages are designed to expose.
