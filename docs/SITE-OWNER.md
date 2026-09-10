# Steps for the site owner

This note is for Emily. It collects the things only the site's owner can do —
decisions about her own identity, accounts she has to sign into herself, and
settings that live on GitHub rather than in any file in this repository.

Everything here is a one-time task. Day-to-day writing is a separate guide:
[`README.org`](../README.org) at the top of the repository.

The tasks are ordered so the quick, self-contained ones come first. Items 1–4
are worth doing whoever ends up owning the repository, because they are
ordinary changes to files that travel with it. Items 5, 6 and 7 are the
ownership move itself, and they depend on each other: do them in that order.

Where the work happens differs too. Items 1–3 need nothing but a browser —
GitHub's own file editor is enough. Item 4 needs someone with the project
checked out on a computer. Items 5 and 6 are GitHub settings and item 7 is at
the domain registrar; none of the three involves editing a file.

---

## 1. Confirm your department — open question

The site currently says **Nicholas School of the Environment**, Environmental
Social Systems.

An earlier note in the project's task list said "Sanford School of Public
Policy (apparently?)". Your public Duke Scholars profile
(<https://scholars.duke.edu/person/Emily.Decker>) shows only the Environmental
Social Systems programme in the Nicholas School, with no Sanford affiliation.
The site was left saying Nicholas because that is what the public record shows.

**What we need from you:** confirm Nicholas is right, or say what the correct
affiliation is — including whether there is a secondary one that should also
appear. If it needs to change, it is a small text edit in the three homepage
files (`content/_index.md`, `content/_index.fr.md`, `content/_index.mg.md`),
and the French and Malagasy versions must change too.

**Done looks like:** you have said yes, or given the correct wording.

---

## 2. Fill in your social and scholarly links

This is the single highest-value item on the list for being *found*. The site
already links your Semantic Scholar and Duke profiles from the homepage, but
the footer's social links are empty placeholders, so the footer shows no social
column at all right now.

The links matter beyond looking complete. The footer renders each one with
`rel="me"`, which is the standard way of saying "this profile and this website
are the same person". Search engines and Mastodon both read it. Adding your
ORCID here is the strongest single addition for scholarly discovery: it is the
identifier that ties your name to your publications across every publisher and
index.

### What to edit

The file is `config/_default/params.toml`. In GitHub, open it, select the
pencil icon (**Edit this file**), and find this block:

```toml
[[social]]
  name = 'LinkedIn'
  url = ''

[[social]]
  name = 'Twitter / X'
  url = ''

[[social]]
  name = 'Bluesky'
  url = ''

[[social]]
  name = 'Mastodon'
  url = ''
```

Paste the full `https://…` address of each profile you actually use between the
empty quotes. An entry whose `url` stays empty is skipped — it does not render
a dead link — so simply leave the services you do not use alone. Delete an
entry only if you want it gone permanently.

Add ORCID by appending another entry in the same shape. Nothing in the theme
needs changing to accept a new one:

```toml
[[social]]
  name = 'ORCID'
  url = 'https://orcid.org/0000-0000-0000-0000'
```

Use your real ORCID iD in place of the zeros. If you do not have one, register
free at <https://orcid.org/register>; it takes a few minutes and is worth doing
before anything else on this list. A Google Scholar profile link, if you have
one, belongs in the same block.

Then commit the change. Follow the repository's normal route: commit to a new
branch and open a pull request, rather than committing straight to the
publishing branch.

**Done looks like:** the published site's footer has a column of your profile
links, and each one opens the right profile.

---

## 3. Claim your Semantic Scholar author profile

The site's homepage already links to
<https://www.semanticscholar.org/author/Emily-Decker/2346865864>. That page
exists because Semantic Scholar generated it from indexed papers; claiming it
lets you correct which papers are yours and control the name and affiliation
shown.

1. Sign in or create an account at <https://www.semanticscholar.org/>. Use your
   Duke address (`emily.decker@duke.edu`) — claiming is normally verified
   against an institutional email.
2. Open the author page linked above and look for a claim control on it. It is
   usually near the author name, worded like "Claim Author Page" or "Are you
   this author?". If you cannot find it while signed out, sign in first and
   reload the page.
3. Follow their verification steps and wait for confirmation, which is not
   always instant.
4. Once it is yours, review the publication list and remove anything that is
   not actually yours.

One thing to watch. Claiming sometimes merges duplicate author records, and a
merge can move you to a different profile address. If your claimed profile ends
up at a URL with a different number on the end, that number has to be updated
in `config/_default/menus.en.toml` (and the `.fr` and `.mg` files beside it) or
the homepage button will point at the old, unclaimed page. Send the new URL to
Matthew, or edit the three files the same way as item 2.

**Done looks like:** the Semantic Scholar page shows you as its verified
author, and the homepage button still lands on it.

---

## 4. Put your papers on the Research page

The site has a `/research/` page designed for direct downloads — every link is
the file itself, with its type and size shown before the reader commits to the
download. It currently says "Nothing has been published here yet."

This one is not a browser task. The files are mirrored from Box by a command
that needs the project checked out on a computer, plus `rclone` configured for
your Box account. Expect to do this with Matthew, or to hand him the list.

What has to happen, in order:

1. **Confirm the Box folder name.** The project expects a Box folder literally
   named `Research`. If yours is called something else, the name in
   `package.json` (under `emily.box.mounts`) has to change to match. The
   published web addresses do not change either way.
2. **List the documents.** In `content/research/index.md`, replace the single
   "Nothing has been published here yet." paragraph with one Markdown link per
   document, newest first:

   ```markdown
   - [Working paper title](/box/research/working-paper.pdf)
   ```

   The path always begins `/box/research/` and ends with the file's exact name
   as it appears in Box, including capital letters. The same list goes into
   `index.fr.md` and `index.mg.md` beside it — the documents themselves are not
   translated, so all three pages link to the same files.
3. **Mirror the files** with `BOX_REMOTE=box npm run site -- sync box`, and
   commit what it writes under `imports/box/` along with the page.
4. **Accept the new page weights** with `npm run site -- baselines --update`.

The checks are deliberately strict here: a link to a file that is not in the
mirror fails the build, and so does a mirrored file that nothing links to. That
is intentional — it means the Research page can never quietly offer a broken
download. The mechanics are recorded in [`TOOLS.md`](./TOOLS.md).

**Done looks like:** `/research/` lists your documents, each link downloads the
real file, and each shows its type and size.

---

## 5. Take the repository over

Today the repository is `mjdiloreto/emilycdecker.com` — Matthew's account.
"Deploy this site as your own free GitHub Pages site" means moving it to yours.
GitHub Pages is free, but note that free Pages requires the repository to be
**public**. That is already the intent here: the source is public and the built
site is public.

You need your own GitHub account first: <https://github.com/signup>.

### Choose: transfer or fork

These are genuinely different, and the choice is yours.

**Transfer** moves the one repository — history, issues, settings — to your
account. It no longer lives under Matthew's account, and he keeps access only
if you add him as a collaborator. This is the right choice if the site is
yours from now on.
It is done from the repository's **Settings** page, in the "Danger Zone"
section at the bottom, under transfer ownership. Matthew has to start it and
you have to accept it.

**Fork** makes you a copy while leaving Matthew's original in place. This is
the right choice if you want to experiment without committing to the move. Two
things to know about forks: workflows on a fork are disabled until you enable
them — look on the fork's **Actions** tab for a banner asking you to confirm
before workflows run — and two repositories cannot both claim the same custom
domain, so a fork will not serve `blog.emilycdecker.com` while the original
does.

### After either one, turn Pages on

1. Open your repository's **Settings**, then **Pages** in the left sidebar.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.

That second step is not optional and not the default. This project builds the
site with its own workflow file and hands the result to Pages; the other
setting, "Deploy from a branch", would ignore that workflow entirely and
publish the wrong thing.

### One thing that will not work until it is changed

The publishing workflow builds the site with its address written in:
`https://blog.emilycdecker.com/`. The project's own checks enforce the same
address. That is a good thing — it is what stops a build shipping half-broken
links — but it means a copy published at, say,
`yourname.github.io/emilycdecker.com` will fail its checks rather than publish
with wrong addresses.

So: if you keep the `blog.emilycdecker.com` domain, nothing needs changing. If
you want a different address, that is a code change in several files at once
and Matthew should make it. Do not attempt it by editing one file.

**Done looks like:** the repository is under your account, its Settings → Pages
shows GitHub Actions as the source, and the **Actions** tab shows a green check
for a completed deployment.

---

## 6. One-time repository administration

These settings live on GitHub and cannot be enforced by any file in the
repository. Whoever administers the repository after item 5 has to apply them.
They are what make the publishing rules in
[`CONSTRAINTS.md`](./CONSTRAINTS.md) real rather than aspirational.

1. **Rename the default branch from `master` to `main`.** Update local clones,
   and remove the obsolete remote branch after every open pull request has been
   retargeted. This one is not cosmetic: the publishing workflow only runs on
   `main`, and its deployment step additionally refuses to run unless the
   branch is exactly `main`. Until the rename happens, merged work does not
   reach the live site.
2. **Protect `main`.** Require the site test, check, and build to pass; require
   pull requests and CODEOWNERS review; dismiss stale approvals when new
   commits arrive; and prevent bypass and direct pushes to production.
3. **Enable secret scanning push protection**, and keep the `github-pages`
   environment restricted to the protected `main` branch.

The review rules themselves are already recorded in the repository:
`.github/CODEOWNERS` makes Matthew the default owner and makes your review
required for `content/`, the Box snapshot, and bibliography data. Every pull
request also carries a publication checklist covering rights, attribution,
confidential data, human review of machine translation, and URL stability.

**Done looks like:** a pull request into `main` cannot merge without its checks
and the right approval, and merging one publishes the site automatically.

---

## 7. Point the domain at your site

The registrar steps are written out separately and in full in
[`DNS-SETUP.md`](./DNS-SETUP.md). Follow that document; do not work from
memory or from this page.

Two things belong here rather than there, because they follow from item 5:

- The domain `emilycdecker.com` is registered under **Matthew's**
  iwantmyname account. Taking over the repository does not take over the
  domain. Either he makes the DNS change, or the domain has to be transferred
  to your own registrar account first.
- If the repository moves to your account, the DNS record's target changes with
  it. Where `DNS-SETUP.md` says to point `blog` at `mjdiloreto.github.io`, use
  `<your-github-username>.github.io` instead — your account's Pages hostname,
  with no repository name after it. Everything else in that document is
  unchanged.

**Done looks like:** `https://blog.emilycdecker.com/` loads your site over
HTTPS, with the rest of the verification list at the end of `DNS-SETUP.md`
passing.

---

## Checklist

- [ ] 1. Nicholas School confirmed, or the correct affiliation supplied
- [ ] 2. Social and scholarly links filled in, ORCID included
- [ ] 3. Semantic Scholar author profile claimed
- [ ] 4. Research page lists real documents
- [ ] 5. Repository under your account, Pages source set to GitHub Actions
- [ ] 6. Default branch renamed to `main`, protections and secret scanning on
- [ ] 7. DNS following `DNS-SETUP.md`, HTTPS enforced
