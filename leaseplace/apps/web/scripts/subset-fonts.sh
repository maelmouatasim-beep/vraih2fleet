#!/usr/bin/env bash
# Régénère la police d'interface réduite aux caractères latins (licence OFL,
# voir src/fonts/LICENSE.txt). Prérequis : pip install fonttools brotli.
set -euo pipefail
cd "$(dirname "$0")/.."
pyftsubset node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2 \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+2248,U+2260,U+2264-2265" \
  --layout-features='*' --flavor=woff2 --output-file=src/fonts/geist-latin-var.woff2
cp node_modules/geist/LICENSE.txt src/fonts/LICENSE.txt
