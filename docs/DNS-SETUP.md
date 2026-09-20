# DNS Setup: blog.emilycdecker.com → GitHub Pages

Registrar: iwantmyname.com
Repo: git@github.com:ecdecker/emilycdecker.com.git
Canonical origin: https://blog.emilycdecker.com/

The site is served from the `blog` subdomain, not the apex. The apex
`emilycdecker.com` is deliberately left free for a different, primary
site later; for now it only forwards to the blog.

A subdomain also needs one `CNAME` record, where an apex needs four `A`
records pointing at GitHub's IP addresses that have to be re-checked
whenever GitHub changes them. That is the other reason for this shape.

## How to check DNS from this machine

Every verification step below uses one of these. `dig` is not installed by
default on this machine; either install it once —

    sudo apt install dnsutils

— or use the Node fallback, which needs nothing beyond the Node this
project already requires:

    node -e 'const d=require("dns").promises;const h=process.argv[1];
    (async()=>{for(const t of ["NS","SOA","A","CNAME"]){
    try{console.log(t+": "+JSON.stringify(await d.resolve(h,t)))}
    catch(e){console.log(t+": "+e.code)}}})()' emilycdecker.com

`ENOTFOUND` for a record type means the name does not exist at all.
`ENODATA` means the name exists but has no record of that type. The
difference matters a lot below.

## 0. Confirm the domain exists and is delegated

Do this first. Everything from step 1 onward assumes the zone is live, and
none of it can be verified while it is not.

    node -e '...' emilycdecker.com          # per the block above

You want `NS` to list nameservers and `SOA` to return a record.

**Observed state, checked 2026-09-10: `emilycdecker.com` returns
`ENOTFOUND` for NS, SOA, A, and TXT alike, while `ecdecker.github.io`
resolves normally from the same machine.** The domain is therefore not
delegated in DNS at all. Resolution is not partially broken or slow to
propagate; there is no zone to query.

Exactly one of these is true, and they are told apart at the registrar,
not in DNS:

- **The domain was never registered.** Log in to iwantmyname and check
  whether `emilycdecker.com` is in the account's domain list. If it is
  not, register it. Nothing else in this document applies until then.
- **It is registered but has no nameservers assigned.** It appears in the
  domain list, but its DNS or nameserver page is empty or shows a
  "pending" / "not configured" state. Assign iwantmyname's own
  nameservers, which is what the DNS-record steps below assume. Their
  panel usually offers this as "use our nameservers" or "default DNS".
- **It is registered and delegated elsewhere.** It appears in the list and
  names some other provider's nameservers. In that case the records in
  steps 3 to 5 must be created at *that* provider, not at iwantmyname,
  and iwantmyname's URL forwarding in step 5 is unavailable — use the
  other provider's redirect feature or a `CNAME` on the apex only if that
  provider supports apex aliasing (a plain apex `CNAME` is not valid DNS).

Re-run the check until NS and SOA both answer. Delegation can take up to
24 hours to appear after a change at the registrar, and a registration
that has never resolved sometimes takes a few hours to first appear.

Only once the zone answers do the remaining steps mean anything.

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
    Value: ecdecker.github.io

(If the value field errors without a trailing dot, enter
`ecdecker.github.io.` instead. If the host field wants the full name
rather than the label, enter `blog.emilycdecker.com.`)

Two things to get right:

- The target is `ecdecker.github.io`, with **no repository name**. It
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

This step is a cleanup, and on a zone that has just been created there is
nothing to clean up — skip it if the DNS page is empty. It applies only
where a previous apex configuration is still present.

These records must go, or they keep sending traffic to GitHub for
hostnames that no repo claims:

- The four apex/blank/"@" `A` records
  (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153).
  Step 5 replaces them.
- The `www` CNAME to `ecdecker.github.io`.

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

or, without `dig` installed, the Node fallback from the top of this
document, run against `blog.emilycdecker.com`.

The answer should be a `CNAME` to `ecdecker.github.io.`, followed by
that name's `A` records — which, as of this writing, are
185.199.108.153, 185.199.109.153, 185.199.110.153, and 185.199.111.153.
Seeing those four addresses under the `CNAME` is the signal that the
record is correct; seeing them *without* a `CNAME` means something
created apex-style `A` records instead, which is step 4's problem.

Then return to Settings → Pages and confirm GitHub now reports the DNS
check as successful.

## 8. Enforce HTTPS

Once GitHub issues the certificate, check "Enforce HTTPS" on the same
Pages settings page. GitHub's docs note it can take up to 24 hours
after the domain is configured before the option becomes available.

## 9. Verify

Each line below prints the status code and any redirect target, without
downloading the page. `-sS` keeps it quiet but still shows errors; `-o
/dev/null` discards the body; `-w` prints what you actually want.

    curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://blog.emilycdecker.com/
    curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' http://blog.emilycdecker.com/
    curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' http://emilycdecker.com/
    curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://emilycdecker.com/
    curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' http://www.emilycdecker.com/

What each should print:

| Request | Expected |
|---|---|
| `https://blog…/` | `200` with no redirect — the site itself |
| `http://blog…/` | `301` to `https://blog.emilycdecker.com/` (GitHub's HTTPS enforcement from step 8) |
| `http://emilycdecker.com/` | `301` to `https://blog.emilycdecker.com/` (the apex forward from step 5) |
| `https://emilycdecker.com/` | `301` to the same, **or** a curl TLS error — see below |
| `http://www…/` | connection failure if `www` was removed; `301` to the blog if it was forwarded |

A `404` anywhere means a hostname is pointed at GitHub Pages that no
repository claims — re-check step 1 and step 4.

The `https://` apex line is the one to look at closely, and it is the
question step 5 flagged. If it prints a curl error mentioning the
certificate rather than a status code, iwantmyname is not serving TLS on
the forward, and an old `https://emilycdecker.com/` link will show a
browser certificate warning before it ever reaches the redirect. To see
the error rather than have curl swallow it:

    curl -sSI https://emilycdecker.com/

If that is the outcome and old HTTPS links matter more than keeping the
apex free, the fallback from step 5 applies: point the apex back at
GitHub Pages until the apex is actually needed for something else.

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
