---
title: {{ getenv "HUGO_NEW_TITLE" | default (replace .File.ContentBaseName "-" " " | title) | jsonify }}
description: "Add a one- or two-sentence summary."
date: {{ getenv "HUGO_NEW_DATE" | default (.Date | time.Format "2006-01-02") }}
draft: true
tags: []
locations: []
---

Write the opening paragraph here.

## First section

Continue the article here.
