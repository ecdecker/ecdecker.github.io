# Lighthouse findings

The English homepage was audited on 2026-07-27 with Lighthouse 13.4.1 and
Headless Chrome 151. The audit used Lighthouse's default mobile profile,
simulated throttling, and a 412 × 823 viewport.

## Verified result

| Category | Score |
| --- | ---: |
| Performance | 99 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| Agentic Browsing | 100 |

| Metric | Result |
| --- | ---: |
| First Contentful Paint | 1.2 s |
| Largest Contentful Paint | 1.8 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 1.2 s |

The page made five requests and transferred 139,984 bytes. It loaded no
JavaScript, loaded two fonts, and spent about 59 ms on main-thread tasks.
Lighthouse deducted one performance point for the measured paint timings; it
reported no weighted failures in the other categories.

## Resolved finding

The initial audit scored accessibility at 98 because the footer column labels
used `h4` elements immediately after the page's `h1`. Commit `255c9ba` changes
the labels to `h2` while preserving their presentation. A second audit after
that change scored accessibility at 100.

## Reproduction

Start Hugo without its live-reload client:

```sh
hugo server \
  --bind 127.0.0.1 \
  --port 1414 \
  --disableFastRender \
  --renderToMemory \
  --noHTTPCache \
  --disableLiveReload
```

In another shell, point `CHROME_PATH` at a current Chrome or Chromium binary
and run:

```sh
npx --yes lighthouse http://127.0.0.1:1414/ \
  --output=json \
  --output=html \
  --output-path=/tmp/emily-lighthouse \
  --quiet \
  --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage'
```

Lighthouse measurements vary slightly between runs and machines. The scores
above describe the local development build and should not be read as field
data from a production deployment.
