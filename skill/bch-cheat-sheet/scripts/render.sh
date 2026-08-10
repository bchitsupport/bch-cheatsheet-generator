#!/usr/bin/env bash
# Render a BCH cheat sheet HTML file to PDF.
#   usage: render.sh input.html output.pdf
# Chromium headless is required — the layout uses flexbox, CSS grid, and CSS
# variables. wkhtmltopdf supports none of them and will not reproduce the format.
set -euo pipefail

IN="${1:?usage: render.sh input.html output.pdf}"
OUT="${2:?usage: render.sh input.html output.pdf}"

CHROME=""
for c in /opt/pw-browsers/chromium-*/chrome-linux/chrome \
         "$(command -v chromium || true)" \
         "$(command -v chromium-browser || true)" \
         "$(command -v google-chrome || true)"; do
  [ -x "${c:-}" ] && CHROME="$c" && break
done
[ -n "$CHROME" ] || { echo "No Chromium found."; exit 1; }

"$CHROME" --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw --virtual-time-budget=4000 \
  --print-to-pdf="$OUT" "file://$(realpath "$IN")" 2>/dev/null

echo "Rendered: $OUT"
pdfinfo "$OUT" 2>/dev/null | grep -E '^Pages|^Page size' || true

# Always rasterize and LOOK at the pages before delivering.
#   pdftoppm -jpeg -r 130 "$OUT" page
