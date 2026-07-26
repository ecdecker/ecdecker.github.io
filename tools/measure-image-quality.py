#!/usr/bin/env python3
"""Measure the perceptual cost of Hugo's AVIF and WebP settings.

Why this exists: byte counts at equal `q` do not answer "which codec is
smaller", because a given q is not perceptually equivalent across codecs.
Comparing at equal q overstated AVIF's advantage by roughly 30% here.

Method
------
Hugo does the encoding, so we measure what actually ships rather than a
re-encode. For each source image this builds a throwaway Hugo site that
emits a lossless PNG reference plus AVIF and WebP variants across a range
of q, all at the same delivery width. Each variant is then scored against
the reference.

SSIM is computed here over non-overlapping 8x8 luma blocks: ImageMagick 6
has no SSIM metric and numpy is not available, so it is done directly.
ImageMagick's PSNR is reported alongside as a cross-check -- note that AV1
encoders tune psychovisually at PSNR's expense, so PSNR systematically
UNDERSTATES AVIF and should be read as a conservative floor.

Limits
------
* SSIM is a proxy. Butteraugli or SSIMULACRA2 would be better; neither is
  available here.
* Matched-quality pairing picks the cheapest WebP whose SSIM is >= the
  AVIF's. When it overshoots, AVIF's reported saving is flattered, so the
  matched-SSIM ratios below are upper bounds on AVIF's advantage.

Usage
-----
    python3 tools/measure-image-quality.py [image_dir] [--width 800]

Requires: hugo, ImageMagick (convert, compare).
"""
import argparse
import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict

QUALITIES = [25, 30, 35, 40, 45, 50, 55, 60, 70, 80]
C1 = (0.01 * 255) ** 2
C2 = (0.03 * 255) ** 2

MANIFEST_TEMPLATE = """\
{{- $W := %d -}}
{{- range $img := resources.Match "images/*" -}}
  {{- $n := path.BaseName $img.Name -}}
  {{- $d := $img.Resize (printf "%%dx" $W) -}}
  {{- $ref := $d.Resize (printf "%%dx png" $W) -}}
REF|{{ $n }}|{{ $ref.RelPermalink }}|{{ len $ref.Content }}|
  {{- range $q := slice %s -}}
    {{- $a := $d.Resize (printf "%%dx avif q%%d" $W $q) -}}
    {{- $w := $d.Resize (printf "%%dx webp q%%d" $W $q) -}}
AVIF|{{ $n }}|{{ $q }}|{{ $a.RelPermalink }}|{{ len $a.Content }}|
WEBP|{{ $n }}|{{ $q }}|{{ $w.RelPermalink }}|{{ len $w.Content }}|
  {{- end -}}
{{- end -}}
"""


def build_variants(image_dir, width, workdir):
    """Have Hugo emit reference + variants; return the manifest text."""
    for sub in ("assets/images", "layouts"):
        os.makedirs(os.path.join(workdir, sub))
    found = [p for p in glob.glob(os.path.join(image_dir, "*"))
             if p.lower().endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff"))]
    if not found:
        sys.exit("no images found in %s" % image_dir)
    for p in found:
        shutil.copy(p, os.path.join(workdir, "assets/images", os.path.basename(p)))
    with open(os.path.join(workdir, "hugo.toml"), "w") as fh:
        fh.write("baseURL='http://e.org/'\ntitle='m'\n")
    with open(os.path.join(workdir, "layouts/home.html"), "w") as fh:
        fh.write(MANIFEST_TEMPLATE % (width, " ".join(str(q) for q in QUALITIES)))
    subprocess.run(["hugo", "--logLevel", "error", "--quiet"],
                   cwd=workdir, check=True)
    with open(os.path.join(workdir, "public/index.html"), "rb") as fh:
        return fh.read().decode(), len(found)


def decode_luma(path):
    """Decode any ImageMagick-readable image to (w, h, luma bytes)."""
    raw = subprocess.run(
        ["convert", path, "-colorspace", "Gray", "-depth", "8", "pgm:-"],
        capture_output=True, check=True).stdout
    if not raw.startswith(b"P5"):
        raise ValueError("unexpected decode output for %s" % path)
    pos, fields = 2, []
    while len(fields) < 3:
        while raw[pos:pos + 1].isspace():
            pos += 1
        if raw[pos:pos + 1] == b"#":
            while raw[pos:pos + 1] != b"\n":
                pos += 1
            continue
        start = pos
        while pos < len(raw) and not raw[pos:pos + 1].isspace():
            pos += 1
        fields.append(int(raw[start:pos]))
    pos += 1
    w, h, _ = fields
    return w, h, raw[pos:pos + w * h]


def ssim(ref, cand):
    """Mean SSIM over non-overlapping 8x8 blocks."""
    (w, h, a), (w2, h2, b) = ref, cand
    if (w, h) != (w2, h2):
        raise ValueError("dimension mismatch: %dx%d vs %dx%d" % (w, h, w2, h2))
    total = 0.0
    blocks = 0
    for by in range(0, h - 7, 8):
        for bx in range(0, w - 7, 8):
            sa = sb = saa = sbb = sab = 0
            for y in range(by, by + 8):
                row = y * w
                for x in range(bx, bx + 8):
                    pa, pb = a[row + x], b[row + x]
                    sa += pa
                    sb += pb
                    saa += pa * pa
                    sbb += pb * pb
                    sab += pa * pb
            ma, mb = sa / 64.0, sb / 64.0
            va = saa / 64.0 - ma * ma
            vb = sbb / 64.0 - mb * mb
            cov = sab / 64.0 - ma * mb
            total += (((2 * ma * mb + C1) * (2 * cov + C2)) /
                      ((ma * ma + mb * mb + C1) * (va + vb + C2)))
            blocks += 1
    return total / blocks if blocks else float("nan")


def psnr(ref_path, cand_path):
    out = subprocess.run(["compare", "-metric", "PSNR", ref_path, cand_path,
                          "null:"], capture_output=True)
    m = re.search(r"([0-9]+\.?[0-9]*)",
                  (out.stderr or b"").decode("utf-8", "replace"))
    return float(m.group(1)) if m else float("nan")


def parse(manifest, pub):
    refs, cands = {}, defaultdict(dict)
    for name, rel, size in re.findall(r"REF\|([^|]+)\|([^|]+)\|(\d+)\|", manifest):
        refs[name] = (pub + rel, int(size))
    for fmt, name, q, rel, size in re.findall(
            r"(AVIF|WEBP)\|([^|]+)\|(\d+)\|([^|]+)\|(\d+)\|", manifest):
        cands[name][(fmt, int(q))] = (pub + rel, int(size))
    if not refs or not cands:
        sys.exit("manifest parse failed")
    return refs, cands


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image_dir", nargs="?", default="images")
    ap.add_argument("--width", type=int, default=800)
    ap.add_argument("--target", type=float, default=0.92,
                    help="SSIM floor for the per-image recommendation")
    args = ap.parse_args()

    for tool in ("hugo", "convert", "compare"):
        if not shutil.which(tool):
            sys.exit("required tool not found: %s" % tool)

    workdir = tempfile.mkdtemp(prefix="imgq-")
    try:
        manifest, n = build_variants(args.image_dir, args.width, workdir)
        refs, cands = parse(manifest, os.path.join(workdir, "public"))

        print("Delivery width %dpx, %d image(s), SSIM floor %.2f\n"
              % (args.width, n, args.target))
        print("%-24s %-5s %4s %9s %8s %8s"
              % ("image", "fmt", "q", "bytes", "SSIM", "PSNR"))
        results = defaultdict(dict)
        for name in sorted(refs):
            ref_path, _ = refs[name]
            ref = decode_luma(ref_path)
            for key in sorted(cands[name]):
                path, size = cands[name][key]
                s = ssim(ref, decode_luma(path))
                results[name][key] = (size, s)
                print("%-24s %-5s %4d %9d %8.5f %8.2f"
                      % (name, key[0], key[1], size, s, psnr(ref_path, path)))
            sys.stdout.flush()

        # Per-image minimum q meeting the floor, vs the lowest single global q
        # that meets it everywhere. The gap is the cost of one global setting.
        print("\n=== Cheapest AVIF meeting SSIM >= %.2f ===" % args.target)
        per_image = 0
        needed = {}
        for name in sorted(results):
            hit = [(q, sz) for (f, q), (sz, s) in sorted(results[name].items())
                   if f == "AVIF" and s >= args.target]
            if hit:
                q, sz = hit[0]
                needed[name] = q
                per_image += sz
                print("%-24s q%-3d %9d B" % (name, q, sz))
            else:
                print("%-24s %-4s %9s  (floor unreachable at q<=%d)"
                      % (name, "--", "-", QUALITIES[-1]))
        globals_ok = [gq for gq in QUALITIES
                      if all(results[n].get(("AVIF", gq), (0, 0))[1] >= args.target
                             for n in results)]
        print("\nper-image total: %d B" % per_image)
        if globals_ok:
            gq = globals_ok[0]
            gtotal = sum(results[n][("AVIF", gq)][0] for n in results)
            print("single global q%d: %d B" % (gq, gtotal))
            if per_image:
                print("=> per-image targeting is %.2fx smaller at the same floor"
                      % (gtotal / float(per_image)))
            print("\nrecommended per-image overrides: %s"
                  % ", ".join("%s=q%d" % (k, v) for k, v in sorted(needed.items())))
        else:
            print("no single global q reaches the floor for every image")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    main()
