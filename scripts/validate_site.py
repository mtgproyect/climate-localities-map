#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

required = [
    DOCS / "index.html",
    DOCS / "assets/css/app.css",
    DOCS / "assets/js/app.js",
    DOCS / "config/data-sources.json",
    DOCS / "favicon.svg",
    DOCS / ".nojekyll",
]

missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
if missing:
    raise SystemExit("Faltan archivos: " + ", ".join(missing))

config = json.loads(
    (DOCS / "config/data-sources.json").read_text(encoding="utf-8")
)

for key in ("localities_url", "observations_url"):
    value = config.get(key)
    if not isinstance(value, str) or not value.startswith("https://"):
        raise SystemExit(f"Configuración inválida: {key}")

workflow = (ROOT / ".github/workflows/deploy-pages.yml").read_text(
    encoding="utf-8"
)

if "workflow_dispatch:" not in workflow:
    raise SystemExit("El workflow no contiene workflow_dispatch.")

for forbidden in ("\n  schedule:", "\n  push:", "\n  pull_request:"):
    if forbidden in workflow:
        raise SystemExit(f"Disparador no permitido: {forbidden.strip()}")

html = (DOCS / "index.html").read_text(encoding="utf-8")
for expected in ("assets/css/app.css", "assets/js/app.js", "map"):
    if expected not in html:
        raise SystemExit(f"index.html no contiene {expected}")

javascript = (DOCS / "assets/js/app.js").read_text(encoding="utf-8")
for expected in (
    "operational_station_number",
    "markerClusterGroup",
    "localidades.min.json",
    "estaciones.min.json",
):
    if expected not in javascript:
        raise SystemExit(f"app.js no contiene {expected}")

print("Validación correcta.")
