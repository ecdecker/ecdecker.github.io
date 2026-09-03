#!/usr/bin/env python3
"""Re-subset the self-hosted woff2 faces in themes/folio/assets/fonts/.

Why this exists: the fonts are committed as binaries, so without a script
there is no record of how they were produced or how to reproduce them when
the upstream version changes.

What it does, and what it deliberately does not do
--------------------------------------------------
It strips TrueType hinting from Instrument Serif and keeps every glyph.

The obvious lever -- cutting the character set -- turned out to be the
wrong one here. Measured on the roman + italic pair (43,160 bytes):

    keep only characters currently used (78)     24,160   -44.0%
    keep printable ASCII (95)                    29,096   -32.6%
    drop currency/math/legal symbols (172)       36,144   -16.3%
    keep all 206, strip hinting                  29,768   -31.0%

Instrument Serif is only 220 glyphs, so per-glyph cost is small and woff2
fixed overhead dominates; charset cuts buy far less than their headline
percentages suggest. Stripping hinting buys nearly as much as an
ASCII-only subset while losing no coverage at all.

Coverage is worth keeping because the display face is not confined to the
hero. tokens.css maps --font-display onto h1/h2/h3 (base.css), so every
authored markdown heading is set in it, and onto .post-body blockquote
(publication.css:136), so pull quotes are too. Those are arbitrary
authored prose, not a boundable string like the wordmark -- a subset
tuned to today's characters breaks the first time someone writes a
heading with a character nobody anticipated. The full latin range also
covers the French translation, including the accents and oe.

Dropping hinting is safe for this face specifically: TrueType hinting
only affects rasterization at small sizes on low-DPI screens, macOS
ignores it outright, and the smallest use of this font in the system is
1.25rem / 20px (the wordmark and h3). It is a display face; it is never
set at body size.

Body and interface copy use the native system UI sans stack. The former Inter
variable file was removed because no build or regeneration step consumed it.

Usage
-----
    npm run site -- assets fonts --setup
    npm run site -- assets fonts [--check]

--check re-derives the outputs and reports whether the committed files
match, without writing anything.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

FONT_DIR = os.path.join("themes", "folio", "assets", "fonts")

# Every codepoint in the source is kept. Note that Google's file carries a
# few beyond its own declared latin unicode-range (U+0102, and the
# combining grave/acute/tilde); filtering to the declared range would drop
# them for ~100 bytes. They stay, so the only difference between source and
# shipped file is hinting.
KEEP_ALL = "*"

# Sources are the pristine Google-served files, kept alongside the shipped
# ones so this is re-runnable without a network fetch.
TARGETS = [
    "instrument-serif-latin",
    "instrument-serif-latin-italic",
]


def pyftsubset():
    """Prefer the one in this interpreter's env, so a venv is picked up."""
    local = os.path.join(os.path.dirname(sys.executable), "pyftsubset")
    return local if os.path.exists(local) else shutil.which("pyftsubset")


def subset(src, dest):
    exe = pyftsubset()
    if not exe:
        sys.exit("pyftsubset not found; pip install fonttools brotli")
    subprocess.run(
        [
            exe,
            src,
            f"--unicodes={KEEP_ALL}",
            # Keep every OpenType feature. Kerning in particular is load
            # bearing on a display serif at 96px.
            "--layout-features=*",
            "--no-hinting",
            "--flavor=woff2",
            f"--output-file={dest}",
        ],
        check=True,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    if not os.path.isdir(FONT_DIR):
        sys.exit(f"run from the repo root; {FONT_DIR} not found")

    tmp = tempfile.mkdtemp()
    ok = True
    try:
        for name in TARGETS:
            src = os.path.join(FONT_DIR, f"{name}.src.woff2")
            shipped = os.path.join(FONT_DIR, f"{name}.woff2")
            if not os.path.exists(src):
                sys.exit(f"missing source {src}")
            out = os.path.join(tmp, f"{name}.woff2")
            subset(src, out)
            before, after = os.path.getsize(src), os.path.getsize(out)
            print(f"{name:32} {before:6} -> {after:6}  {100 - 100 * after / before:5.1f}%")
            if args.check:
                same = (
                    os.path.exists(shipped)
                    and open(shipped, "rb").read() == open(out, "rb").read()
                )
                print(f"{'':32} committed file {'matches' if same else 'DIFFERS'}")
                ok = ok and same
            else:
                shutil.copyfile(out, shipped)
    finally:
        shutil.rmtree(tmp)

    if args.check and not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
