#!/usr/bin/env bash
#
# Usage through the project CLI:
#   npm run site -- assets sprites
#
# Or directly:
#   tools/generate-lemur-sprites.sh [input.png] [outdir]
#
# Dependencies (ImageMagick 7, potrace, svgo) are installed automatically if
# missing — see "Dependencies" below. All three are required: this script
# fails outright if one can't be installed, rather than silently skipping a
# step and producing sprites that only sometimes match what was reviewed.
# Installing system packages needs root, so that step may shell out to sudo
# and prompt for a password — run this in a terminal that can answer it.

set -euo pipefail

INPUT="${1:-../assets/images/lemur-sprite-sheet.png}"
OUTDIR="${2:-../assets/images/lemur-sprites}"

# --------------------------------------------------------------------------
# Dependencies
#
#   magick (ImageMagick 7)  crops sprite-sheet cells and converts them to PBM
#   potrace                 traces the PBM bitmaps into SVG paths
#   svgo                    optimizes the traced SVGs
# --------------------------------------------------------------------------

have() { command -v "$1" >/dev/null 2>&1; }
have_svgo() { have svgo || [[ -x "$(dirname "$0")/../node_modules/.bin/svgo" ]]; }

if ! have magick || ! have potrace || ! have_svgo; then
  echo "Checking lemur sprite pipeline dependencies..."
  echo

  NEED_MAGICK=0;  have magick  || NEED_MAGICK=1
  NEED_POTRACE=0; have potrace || NEED_POTRACE=1
  NEED_SVGO=0;    have_svgo    || NEED_SVGO=1

  echo "  magick:  $([[ $NEED_MAGICK  == 0 ]] && echo found || echo missing)"
  echo "  potrace: $([[ $NEED_POTRACE == 0 ]] && echo found || echo missing)"
  echo "  svgo:    $([[ $NEED_SVGO    == 0 ]] && echo found || echo missing)"
  echo

  if (( NEED_MAGICK || NEED_POTRACE )); then
    if have apt-get; then
      # Ubuntu/Debian's apt-packaged "imagemagick" is still ImageMagick 6,
      # which only provides 'convert' — no 'magick' binary. Installing it
      # would leave the hard 'magick' requirement below unmet, so don't
      # claim that as a fix.
      if (( NEED_MAGICK )); then
        echo "apt does not provide ImageMagick 7 ('magick') on this system." >&2
        echo "Install it via Homebrew (https://brew.sh) — 'brew install imagemagick'" >&2
        echo "gives a real 'magick' binary on Linux too — or from" >&2
        echo "https://imagemagick.org/script/download.php, then re-run this script." >&2
        exit 1
      fi
      echo "Installing via apt: potrace"
      echo "(this runs 'sudo apt-get install', which will prompt for your password)"
      sudo apt-get update
      sudo apt-get install -y potrace
    elif have brew; then
      PKGS=()
      (( NEED_MAGICK ))  && PKGS+=("imagemagick")
      (( NEED_POTRACE )) && PKGS+=("potrace")
      echo "Installing via Homebrew: ${PKGS[*]}"
      brew install "${PKGS[@]}"
    else
      echo "Error: no supported package manager found (looked for apt-get, brew)." >&2
      echo "Install ImageMagick 7 and potrace manually, then re-run this script." >&2
      exit 1
    fi
  fi

  if (( NEED_SVGO )); then
    have npm || {
      echo "Error: npm not found — cannot install svgo." >&2
      echo "Install Node.js, then re-run this script." >&2
      exit 1
    }
    echo
    echo "Installing svgo as a project devDependency..."
    npm install --save-dev svgo
  fi

  echo
  FAIL=0
  have magick  || { echo "magick is still missing."  >&2; FAIL=1; }
  have potrace || { echo "potrace is still missing." >&2; FAIL=1; }
  have_svgo    || { echo "svgo is still missing."    >&2; FAIL=1; }
  (( FAIL )) && { echo "One or more dependencies could not be installed." >&2; exit 1; }

  echo "All dependencies installed."
  echo
fi

SVGO=(svgo)
have svgo || SVGO=("$(dirname "$0")/../node_modules/.bin/svgo")

# --------------------------------------------------------------------------
# Sprite generation
# --------------------------------------------------------------------------
#
# The sheet is 1536 x 1024 px: 6 columns x 4 rows, nominally 256 x 256 px
# per cell.
#
# Rows:
#   0 = climbing
#   1 = hanging
#   2 = jumping
#   3 = turning
#
# The rows are NOT evenly spaced at exact 256 px multiples — the artist's
# poses (especially the long, curling tail) overflow a naive 256 px cell by
# a different amount in each row. Cropping on the naive grid (row * 256)
# was verified — by rendering it — to cut two ways at every row boundary:
# the tail of the row above bleeds into the top of the next row's frames,
# while that row's own tail gets cut off at the bottom.
#
# ROW_Y/ROW_H below are measured, not computed from a fixed cell height.
# The measurement: threshold the sheet to pure black/white, shrink it to
# 1 px wide (an area-average per scanline, i.e. how much ink each row of
# the original has across all 6 columns), and find the contiguous
# non-white bands. That gives the true ink extent per row, with clean
# white gaps between them:
#
#   climbing  y  21-270  (height 250)
#   hanging   y 303-546  (height 244)
#   jumping   y 590-741  (height 152)
#   turning   y 798-989  (height 192)
#
# ROW_Y/ROW_H below pad each of those bands by 3 px and round to whole
# pixels — enough to clear anti-aliasing without reaching into a
# neighboring row's gap (the tightest gap, between hanging and jumping, is
# 43 px). Reproduce this yourself with:
#
#   magick lemur-sprite-sheet.png -colorspace Gray -threshold 70% \
#     -resize 1x1024\! -depth 8 txt:- | ...(scan for gray(255) runs)
#
# Columns stay on the naive grid (COLS * CELL_W divides the sheet width
# exactly, and no column-boundary bleed was observed), trimmed by INSET_X
# to exclude the sheet's faint column divider lines.

COLS=6
CELL_W=256
INSET_X=2
CROP_W=$((CELL_W - INSET_X * 2))

ROW_NAMES=("climbing" "hanging" "jumping" "turning")
ROW_Y=(18 300 587 795)
ROW_H=(256 250 158 198)

# Every frame is padded/centered to this square canvas regardless of its
# row's (unequal) crop height, so every output SVG shares one frame size —
# required for the strip's background-size: 600% 100% CSS trick, and for a
# consistent canvas across rows generally.
FRAME=256

mkdir -p "$OUTDIR/svg"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# potrace renders solid black by default. The theme's other iconography
# (folio-spark, the Lucide icons in sprite.html) uses fill="currentColor" so
# it inherits color from CSS instead of being locked to black — do the same
# here so the lemur can be recolored, and themed for light/dark, in CSS.
recolor_svg() {
  sed -i -E 's/fill="(#[0-9a-fA-F]{3,6}|black)"/fill="currentColor"/g' "$1"
}

optimize_svg() {
  "${SVGO[@]}" "$1" -o "$1" >/dev/null
}

for ((row=0; row<4; row++)); do
  action="${ROW_NAMES[$row]}"
  y="${ROW_Y[$row]}"
  h="${ROW_H[$row]}"
  frame_pngs=()

  for ((col=0; col<COLS; col++)); do
    frame="$(printf "%02d" "$col")"
    name="${action}-${frame}"

    x=$((col * CELL_W + INSET_X))

    # PNG/PBM are intermediates only — potrace needs a bitmap to trace, and
    # the strip step needs frames to append — so they live in TMPDIR and
    # never touch OUTDIR. SVG (per-frame and the strip) is the only output.
    png="$TMPDIR/$name.png"
    pbm="$TMPDIR/$name.pbm"
    svg="$OUTDIR/svg/$name.svg"

    echo "Generating $name"

    # Crop the measured content band, remove grayscale/antialiasing, then
    # center onto a fixed FRAMExFRAME canvas — padding shorter rows,
    # trimming the couple of stray pixels a too-generous margin might add.
    magick "$INPUT" \
      -crop "${CROP_W}x${h}+${x}+${y}" \
      +repage \
      -colorspace Gray \
      -threshold 70% \
      -gravity center \
      -background white \
      -extent "${FRAME}x${FRAME}" \
      "$png"

    frame_pngs+=("$png")

    # Potrace works particularly well from PBM for pure B/W art.
    magick "$png" "$pbm"

    potrace "$pbm" \
      --svg \
      --tight \
      --output "$svg"

    recolor_svg "$svg"
    optimize_svg "$svg"
  done

  # Also trace the whole row as one image, frames left to right, so it can
  # be used as a single CSS sprite sheet: background-size: 600% 100% and a
  # steps(5) animation on background-position-x steps through the 6 frames
  # without any JavaScript.
  strip_name="${action}-strip"
  strip_png="$TMPDIR/$strip_name.png"
  strip_pbm="$TMPDIR/$strip_name.pbm"
  strip_svg="$OUTDIR/svg/$strip_name.svg"

  echo "Generating $strip_name"

  magick "${frame_pngs[@]}" +append "$strip_png"
  magick "$strip_png" "$strip_pbm"

  # No --tight here, deliberately: it crops to the union bounding box of ink
  # across the *whole* row, which trims the outer edges by different amounts
  # on each side. That shifts the traced viewBox's origin away from frame
  # 0's cell boundary, so a background-position steps() animation assuming
  # 6 even divisions would drift out of alignment by the last frame. Leaving
  # the canvas untouched keeps every cell at its exact multiple of
  # $FRAME, which is what the stepped background-position math relies on.
  potrace "$strip_pbm" \
    --svg \
    --output "$strip_svg"

  recolor_svg "$strip_svg"
  optimize_svg "$strip_svg"
done

echo
echo "Done."
echo
echo "SVG sprites:"
echo "  $OUTDIR/svg/climbing-00.svg ... climbing-05.svg"
echo "  $OUTDIR/svg/hanging-00.svg  ... hanging-05.svg"
echo "  $OUTDIR/svg/jumping-00.svg  ... jumping-05.svg"
echo "  $OUTDIR/svg/turning-00.svg  ... turning-05.svg"
echo
echo "SVG strips (one traced image per row, for CSS sprite animation):"
echo "  $OUTDIR/svg/climbing-strip.svg"
echo "  $OUTDIR/svg/hanging-strip.svg"
echo "  $OUTDIR/svg/jumping-strip.svg"
echo "  $OUTDIR/svg/turning-strip.svg"
