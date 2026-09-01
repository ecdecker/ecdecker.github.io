# About
This is a blog site hosted at emilycdecker.com.
Only users mjdiloreto and ecdecker have access.
mjdiloreto is code-owner of the site and repository, ecdecker is the owner for content. 

Authoring / publishing can only be done by people with access to this repository.

# Content
Index is a profile page for Emily Decker, and Ph.D student at Duke studying Environmental Economics & Policy. Interested in clean energy transitions, environmental health impacts, climate change resilience, as well as the role of climate finance to address these issues.

This site is socially engineered. <<todo-insert-link-to-that-post>>

# Site Policies

## Policy: simplicity+minimalism
This project intends to remain as simple and minimal as possible, without sacrificing other constraints.

## Policy: transfer-size
- This site maintains strict thresholds in terms of transferred data.
- All images are optimized for the web. 
- Every page adheres to strict non-content maximum transfer size, the measurement of which gates deployment.

## Policy: no-js
The site itself serves no javascript whatsoever.
<<todo-search>> How to integrate search (quarto-style)? Is search needed? Postpone.

# Externalities
- The domain name is provided by iwantmyname.com under the mjdiloreto account.
  - The instructions for the site owner to configure DNS records on iwantmyname are recorded at [DNS-SETUP.md](../DNS-SETUP.md)

- Content and citations can be synchronized from Box and Zotero: `npm run sync` <<todo-adopt-from-quarto-branch>>
  - That content is inferred through links and citations in markdown sources. <<todo-adopt-from-quarto-branch>>
  
- The site is hosted on GitHub pages.

# Technology
- The site uses hugo as its underlying Static Site Generator (SSG), and leverages built-in solutions wherever possible.
- The site maintains a 100 perfect Lighthouse score: `npm run site -- audit`.
- The site configures proper social media previews. <<todo-correct-meta-tags>>
- package.json scripts are the only valid entrypoint for user/developer actions on a checked-out repo.
  - tools are node scripts under /tools
  
## Theme
This site uses a custom theme called Folio, which is documented in the development-only (draft) post which exercises all of its features.
<<todo-reduce-existing-development-only-pages-to-one-all-encompassing-post>>

See the entire design system on one page by running `npm run site -- theme`.

## Scripts
The npm scripts this site uses are listed below:
<<todo-list-any-npm-commands

## AI Agents
- Most of the non-framework code that runs this site is AI-generated.
- Agents are informed how to behave in this repository via [AGENTS.md](../AGENTS.md)
- Agents are advised not to edit content in any way, but it is ultimately the responsibility of the site owners to verify and understand all output.
