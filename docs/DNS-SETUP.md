# DNS Setup: emilycdecker.com → GitHub Pages

Registrar: iwantmyname.com
Repo: git@github.com:mjdiloreto/emilycdecker.com.git

## 1. Log in to iwantmyname.com

Open the domain emilycdecker.com from your domain list, then find its
DNS management page (may be labeled "DNS", "DNS Zone Records", or
"Manage DNS").

## 2. Apex record (emilycdecker.com)

Remove any existing A record(s) on the apex/blank/"@" host (e.g. a
parking-page record), then add these four A records, all on the
apex/blank/"@" host:

    185.199.108.153
    185.199.109.153
    185.199.110.153
    185.199.111.153

## 3. www record

Remove any existing record on the "www" host, then add:

    Type:  CNAME
    Host:  www
    Value: mjdiloreto.github.io

(If the value field errors without a trailing dot, enter
mjdiloreto.github.io. instead.)

Note: mjdiloreto.github.io is GitHub's fixed Pages hostname, not a
per-repo address, so this CNAME target is correct even though we want
the emilycdecker.com/mjdiloreto/emilycdecker.com project repo to serve
the site rather than any root mjdiloreto.github.io user-pages repo.
GitHub routes by matching the request's Host header against whichever
repo has emilycdecker.com set as its custom domain (step 6), so as
long as no other repo on the account also claims emilycdecker.com as
its custom domain, this repo will serve it correctly.

## 4. Save

Apply/save the DNS zone changes in iwantmyname.

## 5. Wait for propagation

Usually resolves within an hour, but can take up to 24-48 hours.

## 6. Confirm the custom domain in GitHub

In the GitHub repo → Settings → Pages → "Custom domain", enter
emilycdecker.com and save. (The repo's static/CNAME file sets this
automatically on deploy, but saving it here forces GitHub to run its
DNS check now.) Wait for GitHub to show the domain verified.

## 7. Enforce HTTPS

Once GitHub issues the certificate (can take a few minutes to a few
hours after verification), check "Enforce HTTPS" on the same Pages
settings page.

## 8. Verify

Visit https://emilycdecker.com/ and https://www.emilycdecker.com/ and
confirm both load the site over HTTPS.

Note: iwantmyname's exact field labels may differ slightly from what's
above, since this was written from general GitHub Pages DNS
requirements, not a live look at their panel.
