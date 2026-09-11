Every item a subagent. Orchestrate appropriately. Repo must be kept in clean state at all times, changes are atomically merged into master after being validated on worktrees. Items are popped from this list and removed from the document. Follow the principle of minimalism and value terseness. Indent as a plain markdown list to arbitrary depth, but only 1 sentence or sentence fragment per line. Each item gets a subagent set to /plan, subitems are part of that plan.

- Populate /research/ with real Box links, replacing the placeholder page.
  - Setup is now written down in docs/BOX-SETUP.md; follow it rather than improvising.
  - Blocked on `sudo apt install rclone` and one interactive Box authorization, both of which need the owner.
  - Confirm emily.box.mounts[0].source matches her actual Box folder name, which `rclone lsd box:` reveals.

- Do the iwantmyname DNS cutover, following docs/DNS-SETUP.md.
  - Blocked at step 0: emilycdecker.com returns no NS and no SOA, so the domain is not delegated at all.
  - Settle at the registrar whether it is unregistered or merely has no nameservers assigned.
  - Then answer whether their URL forwarding serves HTTPS on the apex, per the step 9 table.

- Host the CC BY 4.0 PLOS manuscript PDF and link it, which is Scholar's own advice for an individual author.
  - Tracked in content as <<todo-plos-pdf>>; no PDF exists in the repo or in the Box snapshot yet.
  - A publisher-formatted PDF is often not redistributable even by its author, an accepted manuscript usually is.
