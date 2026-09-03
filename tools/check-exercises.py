#!/usr/bin/env python3
"""Assert the invariants the development exercise exists to expose.

Builds the site with --environment development, so exercises/ is mounted, then
reads the emitted HTML. Every check here corresponds to a defect that actually
shipped or to a constraint the project has stated out loud. A check that cannot
name the failure it prevents does not belong in this file.

    tools/check-exercises.py              # build and check
    tools/check-exercises.py --keep       # leave the build tree for inspection
    tools/check-exercises.py --update     # rewrite the weight ceilings

Pure standard library, matching tools/measure-image-quality.py. No parser
dependency either: the markup this checks is emitted by templates in this
repository, so it is regular enough to match with regexes, and a stdlib
HTMLParser buys little against markup we control.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import os
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
BUDGETS = ROOT / "tools" / "exercise-budgets.json"

# Anything at or above this is a source original that escaped into the output.
# publishResources = false exists to stop exactly that, and the link hook's
# assets/ fallback publishes whatever it resolves without processing it.
MAX_PUBLISHED_BYTES = 1_048_576

SCHEME = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.\-]*:")


class Failures:
    def __init__(self) -> None:
        self.items: list[tuple[str, str]] = []

    def add(self, check: str, detail: str) -> None:
        self.items.append((check, detail))

    def __bool__(self) -> bool:
        return bool(self.items)


def build(dest: Path) -> None:
    proc = subprocess.run(
        [os.environ.get("HUGO_BIN", "hugo"), "--source", str(ROOT), "--environment", "development",
         "--destination", str(dest), "--quiet"],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout + proc.stderr)
        sys.exit(f"hugo build failed ({proc.returncode})")


def image_size(path: Path) -> tuple[int, int] | None:
    """Width and height from a PNG or JPEG header, without an image library."""
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            # SOF0..SOF15, excluding the non-frame markers in that range.
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return w, h
            i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    return None


def source_widths() -> dict[str, int]:
    """Stem -> pixel width for every source image Hugo might process.

    Hugo names a derivative "<stem>_hu_<hash>.<ext>", so the stem is enough to
    find what a variant came from.
    """
    widths: dict[str, int] = {}
    for base in (ROOT / "assets", ROOT / "exercises", ROOT / "content"):
        for path in base.rglob("*"):
            if path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
                continue
            if "_hu_" in path.name:
                continue
            size = image_size(path)
            if size:
                widths[path.stem] = size[0]
    return widths


def check_dead_hrefs(page: Path, html: str, fail: Failures) -> None:
    """Go's URL filter rewrites schemes it does not allowlist to #ZgotmplZ.

    That is how tel: links became dead. javascript: is *supposed* to end up
    here, but it should never reach an author-written link, so any occurrence in
    an href is a defect.
    """
    for m in re.finditer(r'<a\b[^>]*href="([^"]*ZgotmplZ[^"]*)"', html):
        fail.add("dead-href", f"{page}: {m.group(1)}")


def check_internal_links(page: Path, html: str, out: Path, fail: Failures) -> None:
    """A root-relative href must resolve to something that was published.

    The ?query bug 404'd precisely here: the resource never resolved, so the
    file was never published, and the link pointed at nothing.
    """
    for m in re.finditer(r'<a\b[^>]*href="([^"]+)"', html):
        href = m.group(1)
        if SCHEME.match(href) or href.startswith(("#", "//")):
            continue
        if not href.startswith("/"):
            continue  # relative links are resolved by the browser, not us
        # Published filenames on disk are literal UTF-8 (e.g. "enquête.csv");
        # the href is percent-encoded, so the lookup must decode first or a
        # correctly-resolving link reports as broken.
        path = unquote(href.split("?")[0].split("#")[0])
        target = out / path.lstrip("/")
        if target.is_dir():
            target = target / "index.html"
        elif path.endswith("/"):
            target = target / "index.html"
        if not target.exists():
            fail.add("broken-link", f"{page}: {href}")


def check_pictures(page: Path, html: str, fail: Failures) -> None:
    """Both sources must survive. Losing one silently degrades every reader.

    This is the check that would catch a grayscale AVIF failure, or any other
    encoder refusal, without needing to know the cause in advance.
    """
    for m in re.finditer(r"<picture>(.*?)</picture>", html, re.S):
        block = m.group(1)
        img = re.search(r"<img\b[^>]*>", block)
        name = (re.search(r'src="([^"]+)"', block) or [None, "?"])[1]
        if 'type="image/avif"' not in block:
            fail.add("picture-source", f"{page}: no AVIF source for {name}")
        if not img or ".webp" not in (
            (re.search(r'srcset="([^"]*)"', img.group(0)) or [None, ""])[1]
        ):
            fail.add("picture-source", f"{page}: no WebP srcset for {name}")


def check_upscale(page: Path, html: str, widths: dict[str, int], fail: Failures) -> None:
    """No variant may be wider than the source it came from.

    Hugo upscales past the source width if asked, which spends bytes inventing
    detail that was never captured — the worst trade available to this project.
    """
    for m in re.finditer(r"([A-Za-z0-9_\-.]+)_hu_[0-9a-f]+\.\w+ (\d+)w", html):
        stem, w = m.group(1), int(m.group(2))
        src = widths.get(stem)
        if src is not None and w > src:
            fail.add("upscale", f"{page}: {stem} variant {w}w exceeds source {src}w")


def check_img_attrs(page: Path, html: str, fail: Failures) -> None:
    """width/height stop layout shift; alt is not optional."""
    for m in re.finditer(r"<img\b[^>]*>", html):
        tag = m.group(0)
        src = (re.search(r'src="([^"]+)"', tag) or [None, "?"])[1]
        for attr in ("width", "height", "alt"):
            if not re.search(rf'\b{attr}="', tag):
                fail.add("img-attrs", f"{page}: <img {src}> has no {attr}")


def check_loading(page: Path, html: str, fail: Failures) -> None:
    """First plate eager and prioritised, every later one lazy.

    The first is in the initial viewport and would be fetched regardless, so
    marking it eager reorders a request rather than adding one. Later plates
    staying lazy is what keeps a twenty-plate article cheap to open.
    """
    figures = re.findall(r"<figure>.*?</figure>", html, re.S)
    for i, fig in enumerate(figures):
        loading = (re.search(r'loading="(\w+)"', fig) or [None, None])[1]
        if loading is None:
            continue
        if i == 0:
            if loading != "eager":
                fail.add("loading", f"{page}: first plate is {loading}, expected eager")
            elif 'fetchpriority="high"' not in fig:
                fail.add("loading", f"{page}: first plate is eager without fetchpriority")
        elif loading != "lazy":
            fail.add("loading", f"{page}: plate {i + 1} is {loading}, expected lazy")


def check_published_sizes(out: Path, fail: Failures) -> None:
    for path in out.rglob("*"):
        if path.is_file() and path.stat().st_size > MAX_PUBLISHED_BYTES:
            kb = path.stat().st_size / 1024
            fail.add("oversized", f"{path.relative_to(out)}: {kb:,.0f} KB")


def ceiling_for(actual: int) -> int:
    """A recorded ceiling with enough slack to survive ordinary editing.

    Pinning the ceiling to the exact current byte count makes adding one
    sentence a build failure, and a check that cries wolf on prose edits gets
    switched off. Ten percent of a ~55 KB page is ~5 KB: far more than a
    paragraph, far less than a stray font file, an unoptimised plate, or a
    second copy of the CSS. Regressions worth catching are step changes, not
    drift.
    """
    return int(actual * 1.10)


def cold_weight(page: Path, html: str, out: Path) -> int:
    """Upper bound on a cold load of one route.

    HTML (which now carries the CSS inline) plus every font it references plus
    the largest candidate for each eager image. It is an upper bound on purpose:
    the browser picks a smaller srcset candidate than the widest, and real
    transfer over a throttled link is what tools/capture-load-states.mjs
    measures. This number is here to ratchet, not to be precise.
    """
    total = len(html.encode())
    seen: set[str] = set()

    for m in re.finditer(r'(?:url\(|href=")([^)"]*\.woff2)', html):
        seen.add(m.group(1))

    for fig in re.findall(r"<figure>.*?</figure>", html, re.S):
        if 'loading="eager"' not in fig:
            continue
        widest = 0
        widest_url = None
        for m in re.finditer(r'([^\s,"]+\.(?:avif|webp)) (\d+)w', fig):
            if int(m.group(2)) > widest:
                widest, widest_url = int(m.group(2)), m.group(1)
        if widest_url:
            seen.add(widest_url)

    for url in seen:
        target = out / url.lstrip("/")
        if target.is_file():
            total += target.stat().st_size
    return total


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true", help="leave the build tree in place")
    ap.add_argument("--update", action="store_true", help="rewrite the weight ceilings")
    args = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="folio-check-"))
    out = tmp / "public"
    try:
        sources = sorted((ROOT / "exercises").rglob("*.md"))
        expected = ROOT / "exercises" / "index.md"
        if sources != [expected]:
            found = ", ".join(str(path.relative_to(ROOT)) for path in sources) or "none"
            sys.exit(f"expected one development page at exercises/index.md; found {found}")

        build(out)
        widths = source_widths()
        fail = Failures()
        weights: dict[str, int] = {}

        for page in sorted(out.rglob("*.html")):
            rel = page.relative_to(out)
            html = page.read_text(encoding="utf-8", errors="replace")
            check_dead_hrefs(rel, html, fail)
            check_internal_links(rel, html, out, fail)
            check_pictures(rel, html, fail)
            check_upscale(rel, html, widths, fail)
            check_img_attrs(rel, html, fail)
            check_loading(rel, html, fail)
            if rel.as_posix() == "exercises/index.html":
                if '<ul class="ex-miss">' in html:
                    fail.add("component-coverage", f"{rel}: one or more stylesheet classes lack a specimen")
                if html.count('<details class="plate">') < 1:
                    fail.add("on-demand-images", f"{rel}: deferred plates are not enclosed in disclosures")
                weights["exercises"] = cold_weight(rel, html, out)

        check_published_sizes(out, fail)

        # Weight ceilings. Routes with no recorded ceiling are reported so a new
        # page has to be looked at once rather than sliding in unmeasured.
        ceilings = json.loads(BUDGETS.read_text()) if BUDGETS.exists() else {}
        if args.update:
            recorded = {k: ceiling_for(v) for k, v in sorted(weights.items())}
            BUDGETS.write_text(json.dumps(recorded, indent=2) + "\n")
            print(f"wrote {len(recorded)} ceilings to {BUDGETS.relative_to(ROOT)}")
        else:
            for route, actual in sorted(weights.items()):
                limit = ceilings.get(route)
                if limit is None:
                    fail.add("weight-unrecorded", f"{route}: {actual:,} B, no ceiling on record")
                elif actual > limit:
                    fail.add(
                        "weight",
                        f"{route}: {actual:,} B exceeds ceiling {limit:,} B "
                        f"(+{actual - limit:,})",
                    )

        pages = len(list(out.rglob("*.html")))
        if fail:
            print(f"FAIL — {len(fail.items)} problem(s) across {pages} pages\n")
            current = None
            for check, detail in fail.items:
                if check != current:
                    print(f"  [{check}]")
                    current = check
                print(f"    {detail}")
            return 1

        print(f"OK — one development page and {pages} total rendered pages; its route is within budget")
        return 0
    finally:
        if args.keep:
            print(f"build tree left at {out}")
        else:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
