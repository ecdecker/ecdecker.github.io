# DNS Setup: blog.emilycdecker.com → GitHub Pages

Registrar: iwantmyname.com
Repo: git@github.com:mjdiloreto/emilycdecker.com.git
Canonical origin: https://blog.emilycdecker.com/

The site is served from the `blog` subdomain, not the apex. The apex
`emilycdecker.com` is deliberately left free for a different, primary
site later; for now it only forwards to the blog.

A subdomain also needs one `CNAME` record, where an apex needs four `A`
records pointing at GitHub's IP addresses that have to be re-checked
whenever GitHub changes them. That is the other reason for this shape.

## 1. Claim the domain in GitHub first

Do this *before* pointing any DNS at GitHub. A hostname that resolves
to GitHub Pages but is not claimed by a repository can be claimed by
someone else's repository — GitHub's docs call this out as a subdomain
takeover risk.

GitHub repo → Settings → Pages → "Custom domain": enter

    blog.emilycdecker.com

and save. GitHub will run a DNS check and report it as failing until
step 3 has propagated. That is expected at this point.

Note: this repo publishes with a custom GitHub Actions workflow
(`.github/workflows/gh-pages.yml`), and GitHub's docs are explicit that
for that publishing source "no `CNAME` file is created, and any existing
`CNAME` file is ignored and is not required". The repo still ships
`static/CNAME` so the built artifact names its own origin, but that file
does **not** configure the custom domain. The Settings → Pages field is
the only thing that does. Keep the two in sync anyway, so the setting is
recoverable from the repo.

## 2. Log in to iwantmyname.com

Open the domain emilycdecker.com from your domain list, then find its
DNS management page (may be labeled "DNS", "DNS Zone Records", or
"Manage DNS").

## 3. Add the blog record

    Type:  CNAME
    Host:  blog
    Value: mjdiloreto.github.io

(If the value field errors without a trailing dot, enter
`mjdiloreto.github.io.` instead. If the host field wants the full name
rather than the label, enter `blog.emilycdecker.com.`)

Two things to get right:

- The target is `mjdiloreto.github.io`, with **no repository name**. It
  is GitHub's fixed Pages hostname, not a per-repo address. GitHub
  routes by matching the request's `Host` header against whichever repo
  has `blog.emilycdecker.com` set as its custom domain (step 1), so as
  long as no other repo on the account also claims that name, this repo
  serves it.
- Do **not** point `blog` at `emilycdecker.com`. GitHub's docs warn that
  a custom subdomain aimed at the apex breaks HTTPS enforcement and may
  fail to reach the Pages site at all. The apex forward in step 5 is a
  separate, one-directional thing.

## 4. Remove the old apex and www records

These were for the previous apex configuration and must go, or they
keep sending traffic to GitHub for hostnames that no repo claims:

- The four apex/blank/"@" `A` records
  (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153).
  Step 5 replaces them.
- The `www` CNAME to `mjdiloreto.github.io`.

`www` deserves a decision rather than a default. GitHub redirects
automatically between an apex and its `www` only when one of the two is
the Pages custom domain. Neither is any more, so that redirect is gone.
Leaving the old `www` CNAME in place would point a hostname at GitHub
Pages that no repository claims — a 404 for readers, and the same
takeover exposure as step 1. Either:

- **remove `www` entirely** (it stops resolving), or
- **forward `www` to https://blog.emilycdecker.com/** using the same
  registrar URL forwarding as the apex in step 5.

Removing it is simpler, and is what this setup assumes.

## 5. Forward the apex to the blog

At iwantmyname this is a *URL forward* (also called web forwarding or
domain forwarding): a service on their side, not a record type you add
to the zone. iwantmyname manages whatever apex records the forward needs.

    Forward: emilycdecker.com  →  https://blog.emilycdecker.com/
    Type:    301 / permanent
    Masking / frame forwarding: OFF
    Include path / forward subpaths: ON, if offered

Masking (serving the blog inside a hidden frame at the apex) must stay
off. It would leave every page's visible URL on the apex while the
document's own canonical, Open Graph, and asset URLs point at the blog,
and it breaks HTTPS expectations.

Do not point the apex at GitHub Pages as well. The apex belongs either
to GitHub or to the forwarder, not both.

### Known limitation: HTTPS on the apex

Registrar URL forwarders answer on plain HTTP by default. Whether
`https://emilycdecker.com/` forwards cleanly depends on iwantmyname
provisioning a TLS certificate for the forward. If it does not, an old
`https://emilycdecker.com/` link shows a certificate warning before it
ever reaches the redirect. Check this explicitly in step 9. If HTTPS
forwarding turns out to be unavailable and old HTTPS links matter more
than freeing the apex, the fallback is to keep the apex pointed at
GitHub Pages until the apex is actually needed for something else.

## 6. Save

Apply/save the DNS zone changes in iwantmyname.

## 7. Wait for propagation

GitHub's docs say DNS changes can take up to 24 hours to propagate.
Usually it resolves within an hour. Confirm the record itself with:

    dig blog.emilycdecker.com +nostats +nocomments +nocmd

The answer should be a `CNAME` to `mjdiloreto.github.io.`, followed by
that name's `A` records.

Then return to Settings → Pages and confirm GitHub now reports the DNS
check as successful.

## 8. Enforce HTTPS

Once GitHub issues the certificate, check "Enforce HTTPS" on the same
Pages settings page. GitHub's docs note it can take up to 24 hours
after the domain is configured before the option becomes available.

## 9. Verify

- `https://blog.emilycdecker.com/` loads the site over HTTPS.
- `http://blog.emilycdecker.com/` upgrades to HTTPS.
- `http://emilycdecker.com/` redirects (301) to
  `https://blog.emilycdecker.com/`.
- `https://emilycdecker.com/` — check whether it redirects or shows a
  certificate warning, per the limitation in step 5.
- `www.emilycdecker.com` does whatever step 4 decided, and in
  particular does not return a GitHub Pages 404.

## Where the origin is recorded in this repo

Changing the canonical origin again means changing all of these
together. A mismatch between the built `baseURL` and the origin the
audit expects fails `npm run site -- check` rather than shipping
quietly.

| Location | What it sets |
|---|---|
| `config/_default/hugo.toml` (`baseURL`) | default build origin |
| `.github/workflows/gh-pages.yml` (`--base-url`) | deployed build origin |
| `tools/lib/site-audit.mjs` (`SITE_ORIGIN`) | origin the artifact is audited against; the other tools import it |
| `static/CNAME` | names the origin in the artifact; ignored by GitHub under Actions publishing (see step 1) |
| GitHub → Settings → Pages | the live custom domain — not in the repo |

Note: iwantmyname's exact field labels may differ slightly from what's
above, since this was written from GitHub Pages' documented DNS
requirements, not a live look at their panel.
