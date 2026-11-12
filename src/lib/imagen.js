// Imagen PNG de la ficha, dibujada en el equipo (canvas): tema oscuro, sin blanco puro. Respeta la
// casilla de modo reservado. Al pie, la firma opcional del contador y la linea fija de Ficha RUC.
import { vista, riesgos, lineasFirma, PIE_FUENTE } from "./compartir.js";
import { fecha, soles } from "./ruc.js";

const C = {
  bg: "#15100b", cell: "#1e1711", cell2: "#261d15", grid: "#3d3024", fg: "#f3eadf", muted: "#ad9a84", faint: "#75644f",
  accent: "#e8a04a", rojo: "#e5534b", verde: "#4fbf7a", amarillo: "#e3b341", gris: "#8b949e", rojoFondo: "#2e1914",
};
const SEM = { verde: C.verde, amarillo: C.amarillo, ambar: C.amarillo, rojo: C.rojo, gris: C.gris };
const SANS = '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace';
const W = 640, PAD = 22, ET = 168;                 // ancho, margen y columna de etiquetas (px CSS)

function partir(ctx, texto, ancho) {             // ajuste de linea por palabras
  const out = [];
  for (const parrafo of String(texto || "").split("\n")) {
    let linea = "";
    for (const p of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? linea + " " + p : p;
      if (ctx.measureText(prueba).width <= ancho || !linea) linea = prueba;
      else { out.push(linea); linea = p; }
    }
    out.push(linea);
  }
  return out;
}

// Dibuja (o solo mide, si dibujar=false) y devuelve el alto total.
function componer(ctx, x, { reservado, datosAl, firma }, dibujar) {
  const v = vista(x, reservado);
  let y = 0;
  const rect = (x0, y0, w, h, color) => { if (dibujar) { ctx.fillStyle = color; ctx.fillRect(x0, y0, w, h); } };
  const texto = (t, x0, y0, font, color, alin = "left") => {
    if (!dibujar) return;
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = alin; ctx.textBaseline = "top"; ctx.fillText(t, x0, y0);
  };

  // Cabecera
  rect(0, 0, W, 46, C.cell2);
  texto("FICHA RUC", PAD, 15, `700 15px ${SANS}`, C.fg);
  const d = datosAl || x.datos_al;
  if (d) texto(`Datos al ${fecha(d)}`, W - PAD, 17, `500 12px ${MONO}`, C.muted, "right");
  rect(0, 46, W, 1, C.grid);
  y = 46 + 16;

  // Filas etiqueta | valor
  const filas = [["RUC", v.ruc, `600 15px ${MONO}`]];
  if (x.encontrado) {
    filas.push(["Razón social", v.razon, `600 14px ${SANS}`],
      ["Estado", x.estado, null], ["Condición del domicilio", x.condicion, null]);
    if (v.ubicacion) filas.push(["Ubicación", v.ubicacion, `400 13.5px ${SANS}`]);
    if (v.domicilio) filas.push(["Domicilio fiscal", v.domicilio, `400 13.5px ${SANS}`]);
    filas.push(["Locales anexos", String((x.anexos && x.anexos.total) || 0), `500 13.5px ${MONO}`]);
  } else filas.push(["Resultado", "No figura en nuestros datos", `400 13.5px ${SANS}`]);
  const anchoVal = W - PAD * 2 - ET - 12;
  const x0 = PAD, xv = PAD + ET + 12;
  rect(x0, y, W - PAD * 2, 1, C.grid);
  for (const [et, val, font] of filas) {
    let lineas, alto;
    if (font) { ctx.font = font; lineas = partir(ctx, val, anchoVal); alto = Math.max(1, lineas.length) * 20 + 14; }
    else alto = 34;
    rect(x0, y, ET, alto, C.cell2); rect(x0 + ET, y, W - PAD * 2 - ET, alto, C.cell);
    texto(et.toUpperCase(), x0 + 10, y + 11, `600 10.5px ${SANS}`, C.muted);
    if (font) lineas.forEach((l, i) => texto(l, xv, y + 8 + i * 20, font, C.fg));
    else {                                        // semaforo: punto de color + nombre
      const s = val || {}, col = SEM[s.semaforo] || C.gris;
      if (dibujar) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(xv + 5, y + alto / 2, 5, 0, Math.PI * 2); ctx.fill(); }
      texto(s.nombre || "—", xv + 16, y + 9, `600 14px ${SANS}`, s.semaforo === "rojo" ? "#f08a83" : C.fg);
    }
    y += alto;
    rect(x0, y, W - PAD * 2, 1, C.grid);
    y += 1;
  }

  // Alertas: siempre completas
  if (x.encontrado) {
    y += 14;
    texto("ALERTAS", PAD, y, `700 11px ${SANS}`, C.muted);
    y += 20;
    const lista = [];
    const s = x.marcas && x.marcas.ssco;
    if (s) lista.push(["Sin capacidad operativa", [s.firme && `Firme desde ${fecha(s.firme)}`, s.resolucion].filter(Boolean).join(" · ")]);
    for (const p of x.listas || []) if (p.tipo === "riesgo")
      lista.push([p.nombre, [p.desde && `Desde ${fecha(p.desde)}`, p.monto_deuda && soles(p.monto_deuda), p.resolucion,
        p.historico && "Lista antigua: no describe la situación actual"].filter(Boolean).join(" · ")]);
    const otros = riesgos(x).filter(r => !lista.some(([n]) => n === r));
    for (const r of otros) lista.push([r, ""]);
    if (!lista.length) {
      rect(PAD, y, W - PAD * 2, 34, C.cell);
      texto("✓ Sin alertas", PAD + 12, y + 9, `600 13.5px ${SANS}`, C.verde);
      y += 34;
    } else for (const [nombre, det] of lista) {
      ctx.font = `400 12px ${SANS}`;
      const dl = det ? partir(ctx, det, W - PAD * 2 - 40) : [];
      const alto = 32 + dl.length * 17;
      rect(PAD, y, W - PAD * 2, alto, C.rojoFondo); rect(PAD, y, 3, alto, C.rojo);
      texto("⚠ " + nombre, PAD + 14, y + 8, `600 13.5px ${SANS}`, "#f08a83");
      dl.forEach((l, i) => texto(l, PAD + 30, y + 28 + i * 17, `400 12px ${SANS}`, C.muted));
      y += alto + 6;
    }
  }

  // Pie: firma opcional + linea fija
  y += 16;
  rect(0, y, W, 1, C.grid);
  const pie = lineasFirma(firma);
  const altoPie = 16 + pie.length * 20 + 26;
  rect(0, y + 1, W, altoPie, C.cell2);
  let yp = y + 14;
  pie.forEach((l, i) => { texto(l, PAD, yp, i === 0 ? `600 13.5px ${SANS}` : `400 12.5px ${SANS}`, C.fg); yp += 20; });
  texto(PIE_FUENTE, PAD, yp + 2, `400 11.5px ${SANS}`, C.faint);
  return y + 1 + altoPie;
}

// -> Promise<Blob> PNG (escala 2 para que se lea nitido en el celular)
export async function imagenFicha(x, opciones) {
  const escala = 2;
  const medir = document.createElement("canvas").getContext("2d");
  const alto = Math.ceil(componer(medir, x, opciones, false));
  const cv = document.createElement("canvas");
  cv.width = W * escala; cv.height = alto * escala;
  const ctx = cv.getContext("2d");
  ctx.scale(escala, escala);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, alto);
  componer(ctx, x, opciones, true);
  return new Promise((ok, mal) => cv.toBlob(b => (b ? ok(b) : mal(new Error("sin imagen"))), "image/png"));
}
