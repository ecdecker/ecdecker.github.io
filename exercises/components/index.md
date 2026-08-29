---
title: "Components"
description: "Every component in the system, with a coverage report that measures the specimens rather than trusting a list."
date: 2026-07-27
layout: exercise-components
---

The coverage figure below is derived, not asserted. The specimens are rendered
first, then the classes they actually emit are diffed against every class
declared in `components.css` and `utilities.css`. Adding a component to the
stylesheet makes this page report it missing until a specimen exists.
