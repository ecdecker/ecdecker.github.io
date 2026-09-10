Every item a subagent. Orchestrate appropriately. Repo must be kept in clean state at all times, changes are atomically merged into master after being validated on worktrees. Items are popped from this list and removed from the document. Follow the principle of minimalism and value terseness. Indent as a plain markdown list to arbitrary depth, but only 1 sentence or sentence fragment per line. Each item gets a subagent set to /plan, subitems are part of that plan.

- Steps for Emily:
  - Deploy this site as your own free Github pages site
  - Claim your semantic scholar profile
  - [ ] Fill in social media variables in config/_default/params.toml
  
  - Subsequent docs consolidation.

- SEO
  - Add a layouts/robots.txt carrying a Sitemap: line, which costs zero page bytes.
  - Give /posts/, /tags/ and /categories/ their own description front matter in all three languages.
  - Add ORCID, and rel="me" on the Semantic Scholar and Duke Scholars homepage buttons.
  - Write real alt text for the homepage portrait, currently passed as "alt" "" in home.html.
  - Drop the HTML hreflang links and keep the sitemap's, which Google calls equivalent, returning ~200 bytes per page.
  - Add x-default to whichever hreflang set survives, pointing at /.
  - Add og:site_name, og:locale and og:locale:alternate, at 202 bytes per page.
  - Add article:published_time, article:modified_time and meta author on articles, at 197 bytes.
  - Noindex the empty /categories/ routes until a category is published.
  - Emit og:type=website on section and taxonomy lists, and relax the audit that currently demands article.
  - Ship a lean ProfilePage/Person JSON-LD block on the three homepages only, at ~450 bytes.
    - Needs a no-js exception row and an audit exemption for the minifier's unquoted script type=application/ld+json.
  - Do not add Highwire citation_* tags, since the posts summarize papers published elsewhere and Scholar excludes summaries.
  - Host the CC BY 4.0 PLOS manuscript PDF and link it, which is Scholar's own advice for an individual author.

- Confirm Emily's school with her.
  - The Duke Scholars profile shows only Environmental Social Systems and the Nicholas School, never Sanford.
  - The site was left saying Nicholas.

- Populate /research/ with real Box links, replacing the placeholder page.
  - Confirm emily.box.mounts[0].source matches her actual Box folder name.
  - BOX_REMOTE=box npm run site -- sync box needs rclone, then baselines --update.

- Do the iwantmyname DNS cutover, following docs/DNS-SETUP.md.
  - Verify whether their URL forwarding serves HTTPS on the apex, or old https:// links warn before redirecting.

- footer.html calls T "colophon" but the key is commented out in all three i18n files.
  - Emits an empty span and a MISSING_TRANSLATION warning on every page.

- Externalize folio-lemur-mark to cut 5,488 bytes from every page.
  - use href="external.svg#id" is unsupported in Chrome and Safari, so mask-image with currentColor is the no-JS route.

- Rename the default branch to main, which CONSTRAINTS and PUBLISHING both already require for publishing.
