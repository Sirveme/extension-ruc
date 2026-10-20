"""Arma dist/ficha-ruc-<version>.zip con SOLO lo que va a la Chrome Web Store
(manifest, src/, icons/). Revisa que no haya blanco puro ni pistas de la fuente en la UI."""
import json, re, sys, zipfile
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
version = json.loads((BASE / "manifest.json").read_text(encoding="utf-8"))["version"]
archivos = [BASE / "manifest.json", *sorted((BASE / "src").rglob("*")), *sorted((BASE / "icons").glob("*.png"))]
problemas = []
for f in archivos:
    if f.suffix in (".js", ".html", ".css"):
        t = f.read_text(encoding="utf-8")
        if re.search(r"#fff(?:fff)?\b|(?<![-\w])white(?![-\w])", t, re.I):    # el color, no white-space
            problemas.append(f"{f.name}: color blanco")
        if re.search(r"\bSUNAT\b|padr[oó]n reducido", t, re.I):
            problemas.append(f"{f.name}: pista de la fuente en la UI")
if problemas:
    sys.exit("No se empaqueta:\n  " + "\n  ".join(problemas))
(BASE / "dist").mkdir(exist_ok=True)
destino = BASE / "dist" / f"ficha-ruc-{version}.zip"
with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
    for f in archivos:
        if f.is_file():
            z.write(f, f.relative_to(BASE).as_posix())
print(f"{destino} · {sum(1 for f in archivos if f.is_file())} archivos")
