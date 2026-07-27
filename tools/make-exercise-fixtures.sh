#!/usr/bin/env bash
#
# Regenerate the synthetic plates used by exercises/images/.
#
# The four plates in assets/images/ are real photographs and cover the cases
# that matter for choosing a quality value — a soft gradient, a fine-grained
# texture. They do not cover the cases that break the pipeline outright. These
# do, and they are synthetic so they stay a few kilobytes each and can be
# rebuilt byte-for-byte instead of being carried as opaque binaries.
#
# The outputs are committed. This script records how they were made and lets
# them be reproduced; it is not part of the build.
#
# Requires ImageMagick. Usage: tools/make-exercise-fixtures.sh
set -euo pipefail

cd "$(dirname "$0")/.."
out=exercises/images
mkdir -p "$out"

# ImageMagick 7 renamed the binary. Prefer it, fall back to 6. Note that
# identify is a separate command on 6 but a subcommand on 7.
if command -v magick >/dev/null 2>&1; then
  im=magick
  id=(magick identify)
else
  im=convert
  id=(identify)
fi

# Grayscale. Hugo cannot AVIF-encode a grayscale PNG — libavif's encodeGray
# path fails — so this plate is the one that proves whether image.html degrades
# to WebP cleanly or emits a <source> pointing at nothing.
$im -size 900x600 gradient:'#ffffff-#13120f' \
  -colorspace Gray -type Grayscale -depth 8 "$out/grayscale.png"

# Narrower than the smallest configured width (320). Nothing in the srcset may
# be wider than this, or the pipeline is upscaling and spending bytes to invent
# detail that was never in the source.
$im -size 240x160 gradient:'#e4dfd4-#6c6a62' -depth 8 "$out/narrow.png"

# Taller than it is wide, past the top of the width ladder, so the height
# attribute and the intrinsic aspect ratio are both exercised.
$im -size 800x1200 gradient:'#f6f3eb-#6c6a62' \
  -swirl 60 -depth 8 "$out/portrait.png"

# Very wide and short. `sizes` resolves against width, so a panorama is where a
# wrong `sizes` costs the most: the browser picks a candidate far larger than
# the slot it will actually occupy.
$im -size 1600x400 gradient:'#efece4-#13120f' \
  -wave 12x400 -crop 1600x400+0+0 +repage -depth 8 "$out/panorama.png"

# Transparency survives AVIF and WebP but not JPEG. The alpha channel is also
# where a naive "flatten onto white" step would show up against the Bone page
# background.
$im -size 600x600 xc:none \
  -fill '#13120f' -draw 'circle 300,300 300,80' \
  -fill '#6c6a62' -draw 'circle 200,200 200,120' \
  -depth 8 "$out/alpha.png"

printf '%s\n' "--- generated ---"
for f in "$out"/*.png; do
  printf '%-34s %s\n' "$f" "$("${id[@]}" -format '%wx%h %[colorspace] %[channels] %b' "$f")"
done
