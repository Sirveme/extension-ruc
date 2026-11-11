"""Arma dist/ficha-ruc-<version>.zip con SOLO lo que va a la Chrome Web Store
(manifest, src/, icons/). Revisa que no haya blanco puro, pistas de la fuente ni palabras de
"llave" en los textos que ve la persona (la llave existe por detras; de cara al usuario es
"tu prueba" / "tu acceso")."""
import json, re, sys, zipfile
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
# Palabras que la persona NUNCA debe ver (se revisan solo en textos de pantalla, no en el codigo).
PROHIBIDAS = re.compile(r"\b(llaves?|key|api|token|psp_live)\b", re.I)
# JS: cadenas o comentarios (los comentarios se descartan). Solo cuentan como "texto de pantalla"
# las cadenas con al menos dos palabras: los identificadores, rutas y URL no llevan espacios.
_JS = re.compile(r"""("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|//[^\n]*|/\*[\s\S]*?\*/""")
_HTML_ATR = re.compile(r"""\b(?:placeholder|title|aria-label|alt|content)\s*=\s*("[^"]*"|'[^']*')""", re.I)
NO_ES_PANTALLA = {"Bearer "}                    # cabecera HTTP: no se muestra


def textos_de_pantalla(f: Path, t: str) -> list[str]:
    if f.suffix == ".js":
        return [m.group(1)[1:-1] for m in _JS.finditer(t) if m.group(1) and " " in m.group(1).strip("\"'`")
                and m.group(1)[1:-1] not in NO_ES_PANTALLA]
    if f.suffix == ".html":
        sin = re.sub(r"<(script|style)\b[\s\S]*?</\1>|<!--[\s\S]*?-->", " ", t, flags=re.I)
        return [m.group(1)[1:-1] for m in _HTML_ATR.finditer(sin)] + re.findall(r">([^<]+)<", sin)
    if f.name == "manifest.json":
        m = json.loads(t)
        return [m.get("name", ""), m.get("short_name", ""), m.get("description", ""), (m.get("action") or {}).get("default_title", "")]
    return []


def revisar(archivos) -> list[str]:
    problemas = []
    for f in archivos:
        if f.suffix in (".js", ".html", ".css", ".json"):
            t = f.read_text(encoding="utf-8")
            if f.suffix != ".json" and re.search(r"#fff(?:fff)?\b|(?<![-\w])white(?![-\w])", t, re.I):    # el color, no white-space
                problemas.append(f"{f.name}: color blanco")
            if re.search(r"\bSUNAT\b|padr[oó]n reducido", t, re.I):
                problemas.append(f"{f.name}: pista de la fuente en la UI")
            for x in textos_de_pantalla(f, t):
                if PROHIBIDAS.search(x):
                    problemas.append(f"{f.name}: palabra de llave en la pantalla: {x.strip()[:70]!r}")
    return problemas


if __name__ == "__main__":
    version = json.loads((BASE / "manifest.json").read_text(encoding="utf-8"))["version"]
    archivos = [BASE / "manifest.json", *sorted((BASE / "src").rglob("*")), *sorted((BASE / "icons").glob("*.png"))]
    problemas = revisar(archivos)
    if problemas:
        sys.exit("No se empaqueta:\n  " + "\n  ".join(problemas))
    (BASE / "dist").mkdir(exist_ok=True)
    destino = BASE / "dist" / f"ficha-ruc-{version}.zip"
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        for f in archivos:
            if f.is_file():
                z.write(f, f.relative_to(BASE).as_posix())
    print(f"{destino} · {sum(1 for f in archivos if f.is_file())} archivos")
