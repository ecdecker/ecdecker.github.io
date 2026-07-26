#!/usr/bin/env python3
"""Measure the perceptual cost of Hugo's AVIF and WebP settings, and pick a
per-image quality.

Why this exists: byte counts at equal `q` do not answer "which codec is
smaller", because a given q is not perceptually equivalent across codecs.
Comparing at equal q overstated AVIF's advantage by roughly 30% here. The
same non-equivalence holds *between images*: reaching a fixed perceptual
floor takes anywhere from q25 to q70 depending on content, so a single
global quality either wastes bytes on easy images or wrecks hard ones.
Measured here, per-image targeting is 1.70x smaller than the cheapest
global q clearing the same floor -- a bigger win than AVIF-vs-WebP (1.23x).

Two modes
---------
report (default)
    Full q-sweep over one directory, with SSIM and PSNR per variant. The
    exploratory mode; use it to sanity-check the floor itself.

--write-data
    Scans the real site, binary-searches the cheapest q per image that
    holds SSIM >= --target, and writes data/imagequality.json for
    layouts/_partials/image.html to read. This is the mode that ships.

Method
------
Hugo does the encoding, so we measure what actually ships rather than a
re-encode. For each source image this builds a throwaway Hugo site that
emits a lossless PNG reference plus AVIF/WebP variants at the delivery
width, and each variant is scored against that reference.

SSIM is computed here over non-overlapping 8x8 luma blocks: ImageMagick 6
has no SSIM metric and numpy is not available, so it is done directly.
ImageMagick's PSNR is reported alongside in report mode as a cross-check --
note that AV1 encoders tune psychovisually at PSNR's expense, so PSNR
systematically UNDERSTATES AVIF and should be read as a conservative floor.

Keys
----
A data-file key is the image's source path, relative to whichever root it
lives under:

    assets/images/paper-curves.png      -> images/paper-curves.png
    content/posts/field-notes/plate.png -> posts/field-notes/plate.png

image.html rebuilds exactly this from the resource it was handed: a global
asset's .Name is "/images/paper-curves.png", while a page-bundle sibling's
.Name is the bare "plate.png", which is prefixed with page.File.Dir. Both
were verified empirically against Hugo 0.164 rather than assumed.

Caching
-------
Measurement is slow (seconds per image per probe), so every entry stores
the SHA-256 of its source. An image whose hash still matches is skipped.
Changing --target, --width, --format or the ladder invalidates everything,
since the stored q no longer answers the question that was asked.

Limits
------
* SSIM is a proxy. Butteraugli or SSIMULACRA2 would be better; neither is
  available here.
* The search assumes SSIM is monotonic in q. That holds in practice but is
  not guaranteed by either encoder; a full sweep (report mode) is the
  cross-check.
* Quality is chosen at one delivery width and then applied to every width
  in the ladder.
* Matched-quality pairing in report mode picks the cheapest WebP whose
  SSIM is >= the AVIF's. When it overshoots, AVIF's reported saving is
  flattered, so the matched-SSIM ratios are upper bounds on its advantage.

Usage
-----
    python3 tools/measure-image-quality.py [image_dir] [--width 800]
    python3 tools/measure-image-quality.py --write-data [--target 0.92]

Requires: hugo, ImageMagick (convert, compare).
"""
import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from operator import mul

QUALITIES = [25, 30, 35, 40, 45, 50, 55, 60, 70, 80]
# The selection ladder runs higher than the report sweep: an image that
# misses the floor at q80 needs a real answer, not a shrug.
SELECT_QUALITIES = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".tif", ".tiff")
C1 = (0.01 * 255) ** 2
C2 = (0.03 * 255) ** 2
SQUARES = [i * i for i in range(256)]

SITE_CONFIG = "baseURL='http://e.org/'\ntitle='m'\n"

# Per image: cap the delivery width at the source width (the site never
# upscales, so neither may the measurement), resize once, then emit a
# lossless PNG reference plus the requested variants off that same resize.
IMAGE_BLOCK = """\
{{- with resources.Get "images/%(flat)s" -}}
{{- $W := %(width)d -}}{{- if lt .Width $W }}{{ $W = .Width }}{{ end -}}
{{- $d := .Resize (printf "%%dx" $W) -}}
{{- $ref := $d.Resize (printf "%%dx png" $W) -}}
REF|%(flat)s|{{ $ref.RelPermalink }}|{{ len $ref.Content }}|
%(variants)s{{- end -}}
"""
VARIANT_LINE = """\
{{- $v := $d.Resize (printf "%%dx %(fmt)s q%(q)d" $W) -}}
%(tag)s|%(flat)s|%(q)d|{{ $v.RelPermalink }}|{{ len $v.Content }}|
"""


# --------------------------------------------------------------------------
# Encoding lab
# --------------------------------------------------------------------------

class Lab(object):
    """A throwaway Hugo site that encodes on demand.

    Sources are staged under flat, collision-proof names because two page
    bundles may each hold a "plate.png". Hugo's own resource cache is kept
    between rounds, so a re-render only encodes what is genuinely new.
    """

    def __init__(self, width):
        self.width = width
        self.dir = tempfile.mkdtemp(prefix="imgq-")
        self.flat = {}
        os.makedirs(os.path.join(self.dir, "assets/images"))
        os.makedirs(os.path.join(self.dir, "layouts"))
        with open(os.path.join(self.dir, "hugo.toml"), "w") as fh:
            fh.write(SITE_CONFIG)

    def stage(self, key, path):
        """Copy one source in; return its flat name."""
        if key not in self.flat:
            ext = os.path.splitext(path)[1].lower()
            flat = "m%04d%s" % (len(self.flat), ext)
            shutil.copy(path, os.path.join(self.dir, "assets/images", flat))
            self.flat[key] = flat
        return self.flat[key]

    def render(self, requests):
        """requests: {flat: [(fmt, q), ...]} -> (refs, variants).

        refs is {flat: (path, bytes)}; variants is
        {(flat, fmt, q): (path, bytes)}.
        """
        blocks = []
        for flat in sorted(requests):
            lines = "".join(
                VARIANT_LINE % {"fmt": fmt, "q": q, "flat": flat,
                                "tag": fmt.upper()}
                for fmt, q in sorted(set(requests[flat])))
            blocks.append(IMAGE_BLOCK % {"flat": flat, "width": self.width,
                                         "variants": lines})
        with open(os.path.join(self.dir, "layouts/home.html"), "w") as fh:
            fh.write("".join(blocks))
        subprocess.run(["hugo", "--logLevel", "error", "--quiet"],
                       cwd=self.dir, check=True)
        with open(os.path.join(self.dir, "public/index.html"), "rb") as fh:
            manifest = fh.read().decode()

        pub = os.path.join(self.dir, "public")
        refs = {}
        for flat, rel, size in re.findall(r"REF\|([^|]+)\|([^|]+)\|(\d+)\|",
                                          manifest):
            refs[flat] = (pub + rel, int(size))
        variants = {}
        for tag, flat, q, rel, size in re.findall(
                r"(AVIF|WEBP)\|([^|]+)\|(\d+)\|([^|]+)\|(\d+)\|", manifest):
            variants[(flat, tag.lower(), int(q))] = (pub + rel, int(size))
        if not refs:
            sys.exit("manifest parse failed -- Hugo emitted no reference")
        return refs, variants

    def close(self):
        shutil.rmtree(self.dir, ignore_errors=True)


# --------------------------------------------------------------------------
# Metrics
# --------------------------------------------------------------------------

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
    """Mean SSIM over non-overlapping 8x8 blocks.

    The per-row sums go through sum()/map() rather than an inner Python
    loop: identical integer arithmetic, far less interpreter overhead --
    which matters because this is the bottleneck of the whole tool.
    """
    (w, h, a), (w2, h2, b) = ref, cand
    if (w, h) != (w2, h2):
        raise ValueError("dimension mismatch: %dx%d vs %dx%d" % (w, h, w2, h2))
    square = SQUARES.__getitem__
    total = 0.0
    blocks = 0
    for by in range(0, h - 7, 8):
        for bx in range(0, w - 7, 8):
            sa = sb = saa = sbb = sab = 0
            for y in range(by, by + 8):
                off = y * w + bx
                ra = a[off:off + 8]
                rb = b[off:off + 8]
                sa += sum(ra)
                sb += sum(rb)
                saa += sum(map(square, ra))
                sbb += sum(map(square, rb))
                sab += sum(map(mul, ra, rb))
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


class Scorer(object):
    """SSIM with the reference decode cached -- it is reused every round."""

    def __init__(self):
        self.refs = {}

    def score(self, ref_path, cand_path):
        ref = self.refs.get(ref_path)
        if ref is None:
            ref = self.refs[ref_path] = decode_luma(ref_path)
        return ssim(ref, decode_luma(cand_path))


# --------------------------------------------------------------------------
# Site scan
# --------------------------------------------------------------------------

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def discover(root):
    """Every image the site can render, as {key: absolute path}.

    Both roots matter: shared plates live in assets/, and research posts are
    page bundles carrying their own images next to the prose.
    """
    found = {}
    for sub in ("assets", "content"):
        base = os.path.join(root, sub)
        for dirpath, _dirs, files in os.walk(base):
            for name in sorted(files):
                if not name.lower().endswith(IMAGE_EXTS):
                    continue
                path = os.path.join(dirpath, name)
                key = os.path.relpath(path, base).replace(os.sep, "/")
                if key in found:
                    sys.exit("duplicate key %s -- assets/ and content/ must "
                             "not both define it" % key)
                found[key] = path
    return found


# --------------------------------------------------------------------------
# Per-image quality selection
# --------------------------------------------------------------------------

def cheapest_quality(lab, scorer, flat, fmts, ladder, target, log):
    """Lowest ladder q whose SSIM >= target, per format.

    Binary search rather than a sweep: 4 probes instead of 14 per image,
    which is the difference between a tolerable and an unusable run once
    the corpus grows. One Hugo render per round covers every format.

    Returns {fmt: (q, ssim, bytes, reached)}; a format that never clears
    the floor reports the top of the ladder with reached=False.
    """
    lo = {f: 0 for f in fmts}
    hi = {f: len(ladder) - 1 for f in fmts}
    best = {}
    seen = {}
    while True:
        probes = {}
        for f in fmts:
            if lo[f] <= hi[f]:
                probes[f] = ladder[(lo[f] + hi[f]) // 2]
        if not probes:
            break
        want = [(f, q) for f, q in probes.items() if (f, q) not in seen]
        if want:
            refs, variants = lab.render({flat: want})
            ref_path = refs[flat][0]
            for f, q in want:
                path, size = variants[(flat, f, q)]
                seen[(f, q)] = (scorer.score(ref_path, path), size)
        for f, q in probes.items():
            s, size = seen[(f, q)]
            mid = (lo[f] + hi[f]) // 2
            log("    %-4s q%-3d ssim %.5f %8d B" % (f, q, s, size))
            if s >= target:
                best[f] = (q, s, size)
                hi[f] = mid - 1
            else:
                lo[f] = mid + 1

    out = {}
    for f in fmts:
        if f in best:
            out[f] = best[f] + (True,)
        else:
            top = ladder[-1]
            if (f, top) not in seen:
                refs, variants = lab.render({flat: [(f, top)]})
                path, size = variants[(flat, f, top)]
                seen[(f, top)] = (scorer.score(refs[flat][0], path), size)
            s, size = seen[(f, top)]
            out[f] = (top, s, size, False)
    return out


def load_data(path):
    if not os.path.exists(path):
        return {}
    with open(path) as fh:
        try:
            return json.load(fh)
        except ValueError:
            return {}


def write_data(path, doc):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w") as fh:
        json.dump(doc, fh, indent=2, sort_keys=True)
        fh.write("\n")


def run_write_data(args):
    root = os.path.abspath(args.root)
    out_path = os.path.join(root, args.out)
    fmts = ["avif", "webp"] if args.format == "both" else [args.format]
    params = {"target": args.target, "width": args.width,
              "format": args.format, "qualities": SELECT_QUALITIES}

    images = discover(root)
    if not images:
        sys.exit("no images found under %s/{assets,content}" % root)

    old = load_data(out_path)
    old_images = old.get("images") or {}
    stale_params = [k for k, v in params.items() if old.get(k) != v]
    if old_images and stale_params and not args.force:
        print("measurement parameters changed (%s) -- remeasuring everything"
              % ", ".join(sorted(stale_params)))

    entries = {}
    todo = []
    for key in sorted(images):
        digest = sha256(images[key])
        prev = old_images.get(key)
        if (prev and not args.force and not stale_params
                and prev.get("hash") == digest
                and isinstance(prev.get("quality"), int)):
            entries[key] = prev
        else:
            todo.append((key, digest))

    dropped = sorted(set(old_images) - set(images))
    print("%d image(s): %d cached, %d to measure%s"
          % (len(images), len(entries), len(todo),
             "; dropping %d stale entry(ies): %s"
             % (len(dropped), ", ".join(dropped)) if dropped else ""))

    if todo:
        lab = Lab(args.width)
        scorer = Scorer()

        def log(msg):
            print(msg)
            sys.stdout.flush()

        try:
            for n, (key, digest) in enumerate(todo, 1):
                log("[%d/%d] %s" % (n, len(todo), key))
                flat = lab.stage(key, images[key])
                res = cheapest_quality(lab, scorer, flat, fmts,
                                       SELECT_QUALITIES, args.target, log)
                # With --format both the binding constraint is whichever
                # codec needs more q; shipping the AVIF number to WebP too
                # would quietly push the fallback below the floor.
                entry = {"quality": max(res[f][0] for f in fmts),
                         "hash": digest,
                         "ssim": round(min(res[f][1] for f in fmts), 5),
                         "bytes": max(res[f][2] for f in fmts)}
                if not all(res[f][3] for f in fmts):
                    entry["below_target"] = True
                    log("    ! floor unreachable at q<=%d" % SELECT_QUALITIES[-1])
                entries[key] = entry
                log("    -> q%d (ssim %.5f, %d B)"
                    % (entry["quality"], entry["ssim"], entry["bytes"]))
        finally:
            lab.close()

    doc = dict(params)
    doc["_generated_by"] = "tools/measure-image-quality.py --write-data"
    doc["images"] = entries
    write_data(out_path, doc)

    print("\nwrote %s" % out_path)
    print("%-40s %5s %9s %9s" % ("image", "q", "ssim", "bytes"))
    total = 0
    for key in sorted(entries):
        e = entries[key]
        total += e.get("bytes", 0)
        print("%-40s q%-4d %9.5f %9d%s"
              % (key, e["quality"], e.get("ssim", float("nan")),
                 e.get("bytes", 0),
                 "  (below target)" if e.get("below_target") else ""))
    qs = sorted(e["quality"] for e in entries.values())
    if qs:
        print("\n%d B total at %dpx; q range %d-%d, so one global value would "
              "have to be q%d" % (total, args.width, qs[0], qs[-1], qs[-1]))


# --------------------------------------------------------------------------
# Report mode (full sweep)
# --------------------------------------------------------------------------

def run_report(args):
    found = sorted(p for p in glob.glob(os.path.join(args.image_dir, "*"))
                   if p.lower().endswith(IMAGE_EXTS))
    if not found:
        sys.exit("no images found in %s" % args.image_dir)

    lab = Lab(args.width)
    scorer = Scorer()
    try:
        names, requests = {}, {}
        for path in found:
            flat = lab.stage(path, path)
            names[flat] = os.path.splitext(os.path.basename(path))[0]
            requests[flat] = [(f, q) for f in ("avif", "webp")
                              for q in QUALITIES]
        refs, variants = lab.render(requests)

        print("Delivery width %dpx, %d image(s), SSIM floor %.2f\n"
              % (args.width, len(found), args.target))
        print("%-24s %-5s %4s %9s %8s %8s"
              % ("image", "fmt", "q", "bytes", "SSIM", "PSNR"))
        results = defaultdict(dict)
        for flat in sorted(names):
            name = names[flat]
            ref_path = refs[flat][0]
            for fmt in ("avif", "webp"):
                for q in QUALITIES:
                    path, size = variants[(flat, fmt, q)]
                    s = scorer.score(ref_path, path)
                    results[name][(fmt.upper(), q)] = (size, s)
                    print("%-24s %-5s %4d %9d %8.5f %8.2f"
                          % (name, fmt.upper(), q, size, s,
                             psnr(ref_path, path)))
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
            print("(--write-data records these against every image the site "
                  "actually ships)")
        else:
            print("no single global q reaches the floor for every image")
    finally:
        lab.close()


def main():
    ap = argparse.ArgumentParser(
        description="Measure Hugo image quality; optionally write "
                    "data/imagequality.json.")
    ap.add_argument("image_dir", nargs="?", default="images",
                    help="report mode only: directory of source images")
    ap.add_argument("--width", type=int, default=800,
                    help="delivery width to measure at, capped per image to "
                         "the source width (default 800)")
    ap.add_argument("--target", type=float, default=0.92,
                    help="SSIM floor (default 0.92)")
    ap.add_argument("--write-data", action="store_true",
                    help="scan the site and write the per-image data file")
    ap.add_argument("--format", choices=("avif", "webp", "both"),
                    default="avif",
                    help="--write-data: codec(s) that must clear the floor. "
                         "avif (default) sizes for the format nearly every "
                         "reader gets; both also protects the WebP fallback, "
                         "at more bytes")
    ap.add_argument("--root", default=os.path.dirname(
                        os.path.dirname(os.path.abspath(__file__))),
                    help="site root (default: the repo containing this tool)")
    ap.add_argument("--out", default="data/imagequality.json",
                    help="data file to write, relative to --root")
    ap.add_argument("--force", action="store_true",
                    help="--write-data: ignore cached entries")
    args = ap.parse_args()

    for tool in ("hugo", "convert", "compare"):
        if not shutil.which(tool):
            sys.exit("required tool not found: %s" % tool)

    if args.write_data:
        run_write_data(args)
    else:
        run_report(args)


if __name__ == "__main__":
    main()
