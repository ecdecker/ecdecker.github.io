#!/usr/bin/env bash
#
# Install the prerequisites for tools/generate-lemur-sprites.sh. All three
# are required — that script fails outright if any one of them is missing,
# so this installer does too, rather than reporting success when it wasn't
# able to provide one:
#
#   magick (ImageMagick 7)  crops sprite-sheet cells and converts them to PBM
#   potrace                 traces the PBM bitmaps into SVG paths
#   svgo                    optimizes the traced SVGs
#
# Usage through the project CLI:
#   npm run site -- assets sprites --setup
#
# Installing system packages needs root, so this script shells out to sudo
# and will prompt for a password on most systems. Run it directly in a
# terminal rather than through anything that cannot answer that prompt.

set -euo pipefail

have() { command -v "$1" >/dev/null 2>&1; }

echo "Checking lemur sprite pipeline dependencies..."
echo

NEED_MAGICK=0; have magick || NEED_MAGICK=1
NEED_POTRACE=0; have potrace || NEED_POTRACE=1
NEED_SVGO=0
if ! have svgo && [[ ! -x "$(dirname "$0")/../node_modules/.bin/svgo" ]]; then
  NEED_SVGO=1
fi

echo "  magick:  $([[ $NEED_MAGICK  == 0 ]] && echo found || echo missing)"
echo "  potrace: $([[ $NEED_POTRACE == 0 ]] && echo found || echo missing)"
echo "  svgo:    $([[ $NEED_SVGO    == 0 ]] && echo found || echo missing)"
echo

if (( ! NEED_MAGICK && ! NEED_POTRACE )); then
  echo "ImageMagick and potrace are already installed."
elif have apt-get; then
  PKGS=()
  (( NEED_POTRACE )) && PKGS+=("potrace")
  # Ubuntu/Debian's apt-packaged "imagemagick" is still ImageMagick 6, which
  # only provides 'convert' — no 'magick' binary. Installing it would leave
  # the hard 'magick' requirement unmet, so don't claim that as a fix.
  if (( NEED_MAGICK )); then
    echo "apt does not provide ImageMagick 7 ('magick') on this system." >&2
    echo "Install it via Homebrew (https://brew.sh) — 'brew install imagemagick'" >&2
    echo "gives a real 'magick' binary on Linux too — or from" >&2
    echo "https://imagemagick.org/script/download.php, then re-run this script." >&2
    exit 1
  fi
  if (( ${#PKGS[@]} )); then
    echo "Installing via apt: ${PKGS[*]}"
    echo "(this runs 'sudo apt-get install', which will prompt for your password)"
    sudo apt-get update
    sudo apt-get install -y "${PKGS[@]}"
  fi
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
have magick  || { echo "magick is still missing." >&2; FAIL=1; }
have potrace || { echo "potrace is still missing." >&2; FAIL=1; }
if ! have svgo && [[ ! -x "$(dirname "$0")/../node_modules/.bin/svgo" ]]; then
  echo "svgo is still missing." >&2
  FAIL=1
fi

if (( FAIL )); then
  echo "One or more dependencies could not be installed." >&2
  exit 1
fi

echo "All dependencies installed. Generate the sprites with:"
echo "  npm run site -- assets sprites"
