"""Genera icons/{16,32,48,128}.png: cuadro redondeado espresso con una ficha y una lupa cobre.
Uso: python tools/hacer_iconos.py   (requiere Pillow)"""
from pathlib import Path
from PIL import Image, ImageDraw

FONDO, BORDE, COBRE, PAPEL, LINEA = (31, 24, 18), (63, 49, 37), (240, 154, 62), (220, 202, 180), (120, 100, 80)
OUT = Path(__file__).resolve().parent.parent / "icons"


def icono(n: int) -> Image.Image:
    s = 8                                             # supermuestreo para bordes suaves
    W = n * s
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W - 1, W - 1], radius=W * 0.22, fill=FONDO, outline=BORDE, width=max(s, W // 48))
    # ficha
    x0, y0, x1, y1 = W * .2, W * .16, W * .66, W * .78
    d.rounded_rectangle([x0, y0, x1, y1], radius=W * .05, fill=PAPEL)
    if n >= 32:
        for i, ancho in enumerate((.32, .24, .3)):
            y = y0 + W * (.12 + .13 * i)
            d.rounded_rectangle([x0 + W * .06, y, x0 + W * (.06 + ancho), y + W * .05], radius=W * .02, fill=LINEA)
    # lupa
    cx, cy, r = W * .64, W * .62, W * .17
    g = max(s * 2, int(W * .075))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=COBRE, width=g)
    d.line([cx + r * .7, cy + r * .7, W * .88, W * .88], fill=COBRE, width=int(g * 1.2))
    return im.resize((n, n), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for n in (16, 32, 48, 128):
        icono(n).save(OUT / f"{n}.png")
    print("iconos listos en", OUT)
