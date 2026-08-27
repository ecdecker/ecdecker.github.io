#!/usr/bin/env bash
#
# Prerequisites: run `npm run site -- assets sprites --setup`, or install
# ImageMagick (magick), potrace, and svgo yourself. All three are required —
# this script fails rather than silently skipping any of them.

set -euo pipefail

INPUT="${1:-../assets/images/lemur-sprite-sheet.png}"
OUTDIR="${2:-../assets/images/lemur-sprites}"

# The generated sheet is:
#   1536 x 1024 px
#   6 columns x 4 rows
#   256 x 256 px per cell
#
# Rows:
#   0 = climbing
#   1 = hanging
#   2 = jumping
#   3 = turning
#
# Output:
#   sprites/
#     png/
#       climbing-00.png ... climbing-05.png
#       hanging-00.png  ... hanging-05.png
#       jumping-00.png  ... jumping-05.png
#       turning-00.png  ... turning-05.png
#     svg/
#       climbing-00.svg ... etc. (individual frames)
#       climbing-strip.svg, hanging-strip.svg, jumping-strip.svg,
#       turning-strip.svg (all 6 frames traced as one image, side by
#       side, for CSS background-position sprite animation)

COLS=6
ROWS=4
CELL_W=256
CELL_H=256

# Crop slightly inside each cell so the faint sprite-sheet
# divider lines are excluded.
INSET=2
CROP_W=$((CELL_W - INSET * 2))
CROP_H=$((CELL_H - INSET * 2))

ROW_NAMES=("climbing" "hanging" "jumping" "turning")

mkdir -p "$OUTDIR/png" "$OUTDIR/svg"

# Every tool below is required, not optional: a run that silently skips a
# step (an un-optimized SVG, or a fallback image tool with different
# threshold/crop behavior) produces sprites that only sometimes match what
# was reviewed. Fail loudly instead.
command -v magick >/dev/null || {
  echo "Error: 'magick' (ImageMagick 7) not found." >&2
  echo "Run npm run site -- assets sprites --setup to install it." >&2
  exit 1
}

command -v potrace >/dev/null || {
  echo "Error: 'potrace' not found." >&2
  echo "Run npm run site -- assets sprites --setup to install it." >&2
  exit 1
}

SVGO=(svgo)
if ! command -v svgo >/dev/null; then
  if [[ -x "$(dirname "$0")/../node_modules/.bin/svgo" ]]; then
    SVGO=("$(dirname "$0")/../node_modules/.bin/svgo")
  else
    echo "Error: 'svgo' not found." >&2
    echo "Run npm run site -- assets sprites --setup to install it." >&2
    exit 1
  fi
fi

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

for ((row=0; row<ROWS; row++)); do
  action="${ROW_NAMES[$row]}"
  frame_pngs=()

  for ((col=0; col<COLS; col++)); do
    frame="$(printf "%02d" "$col")"
    name="${action}-${frame}"

    x=$((col * CELL_W + INSET))
    y=$((row * CELL_H + INSET))

    png="$OUTDIR/png/$name.png"
    pbm="$TMPDIR/$name.pbm"
    svg="$OUTDIR/svg/$name.svg"

    echo "Generating $name"

    # Extract one 252x252 sprite, remove grayscale/antialiasing,
    # and preserve a consistent canvas for animation.
    magick "$INPUT" \
      -crop "${CROP_W}x${CROP_H}+${x}+${y}" \
      +repage \
      -colorspace Gray \
      -threshold 70% \
      -bordercolor white \
      -border "${INSET}x${INSET}" \
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
  # $CELL_W, which is what the stepped background-position math relies on.
  potrace "$strip_pbm" \
    --svg \
    --output "$strip_svg"

  recolor_svg "$strip_svg"
  optimize_svg "$strip_svg"
done

echo
echo "Done."
echo
echo "PNG sprites:"
echo "  $OUTDIR/png/climbing-00.png ... climbing-05.png"
echo "  $OUTDIR/png/hanging-00.png  ... hanging-05.png"
echo "  $OUTDIR/png/jumping-00.png  ... jumping-05.png"
echo "  $OUTDIR/png/turning-00.png  ... turning-05.png"
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
