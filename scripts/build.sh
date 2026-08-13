#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(python - <<'PY'
import json, pathlib
manifest = pathlib.Path('manifest.json')
print(json.loads(manifest.read_text())['version'])
PY
)"
OUT_DIR="$ROOT/dist"
OUT_FILE="$OUT_DIR/tavo-visual-library-$VERSION.tpg"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

zip -r "$OUT_FILE" manifest.json entry.js locales ui/panel.html README.md >/dev/null

echo "Built: $OUT_FILE"
