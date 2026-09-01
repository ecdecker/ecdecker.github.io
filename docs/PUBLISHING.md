# Publishing controls

The production workflow builds on `main` only and the deploy job independently
checks that its ref is exactly `refs/heads/main`. The build job has read-only
repository access. Only the deploy job receives Pages and OIDC permissions.
Box and Zotero are offline authoring inputs: synchronization is always a local,
explicit command and deployment consumes only reviewed, checked-in snapshots.

## One-time repository administration

An administrator must complete these settings on GitHub; files in a checkout
cannot enforce them:

1. Rename the default branch from `master` to `main`, update local clones, and
   remove the obsolete remote branch after every open pull request is retargeted.
2. Protect `main` with required status checks for the site test, check, and build;
   require pull requests and CODEOWNERS review; dismiss stale approvals when new
   commits arrive; and prevent bypass/direct pushes to production.
3. Enable secret scanning push protection and keep the `github-pages`
   environment restricted to the protected `main` branch.

Every publication must also complete the repository pull-request checklist.
