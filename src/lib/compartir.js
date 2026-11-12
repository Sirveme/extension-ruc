// Modo reservado y textos para compartir. Funciones puras (sin chrome.*): las usan el panel y los tests.
// El enmascarado es solo de lo que se VE y se COMPARTE: los datos ya consultados quedan en memoria y,
// al desmarcar la casilla, se muestran completos sin volver a consultar.

export const OCULTO = "••••••";
export const PIE_FUENTE = "Fuente: Ficha RUC · Perú Sistemas Pro — software para contabilidad";

const titulo = t => String(t || "").toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());

// 20100070970 -> 20••••••970 (primeros 2 y ultimos 3)
export function ocultarRuc(ruc) {
  const r = String(ruc || "");
  return r.length === 11 ? r.slice(0, 2) + "•".repeat(6) + r.slice(-3) : r;
}

// "BANCO DE CREDITO DEL PERU" -> "BANCO •• ••••••• ••• ••••": la primera palabra y el resto con puntos.
export function ocultarRazon(razon) {
  const palabras = String(razon || "").trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return "";
  return [palabras[0], ...palabras.slice(1).map(p => "•".repeat(p.length))].join(" ");
}

// Riesgos de un resultado (lo que el contador necesita evaluar): siempre completos.
export function riesgos(x) {
  if (!x || !x.encontrado) return [];
  const r = [];
  if (x.marcas && x.marcas.ssco) r.push("Sin capacidad operativa");
  if (x.condicion && x.condicion.semaforo === "rojo") r.push(x.condicion.nombre || "No habido");
  if (x.estado && x.estado.semaforo === "rojo") r.push(x.estado.nombre || "No activo");
  for (const p of x.listas || []) if (p.tipo === "riesgo") r.push(p.nombre);
  return r;
}

// Lo que se muestra de la ficha segun la casilla. Reservado: RUC y razon social parciales, domicilio
// oculto, ubicacion solo provincia y departamento (sin distrito). Estado, condicion y alertas: completos.
export function vista(x, reservado) {
  const lugar = reservado ? [x.provincia, x.departamento] : [x.distrito, x.provincia, x.departamento];
  return {
    ruc: reservado ? ocultarRuc(x.ruc) : x.ruc,
    razon: reservado ? ocultarRazon(x.razon_social) : (x.razon_social || ""),
    domicilio: x.domicilio ? (reservado ? OCULTO : x.domicilio) : "",
    ubicacion: lugar.filter(Boolean).map(titulo).join(" · "),
  };
}

// "2026-11-05" -> "05/11"
export function diaMes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}` : "";
}

// Texto para WhatsApp o correo.
export function textoFicha(x, { reservado = true, datosAl = null } = {}) {
  const v = vista(x, reservado);
  const d = diaMes(datosAl || x.datos_al);
  if (!x.encontrado) return [`RUC: ${v.ruc}`, "No figura en nuestros datos.", d && `Datos al ${d}`].filter(Boolean).join("\n");
  const r = riesgos(x);
  return [
    `RUC: ${v.ruc}`,
    `Razón social: ${v.razon}`,
    `Estado: ${(x.estado && x.estado.nombre) || "—"}`,
    `Condición: ${(x.condicion && x.condicion.nombre) || "—"}`,
    v.ubicacion && `Ubicación: ${v.ubicacion}`,
    r.length ? `Alertas: ⚠️ ${r.join(" · ")}` : "Alertas: ninguna",
    d && `Datos al ${d}`,
  ].filter(Boolean).join("\n");
}

// Asunto del correo: en modo reservado, sin el RUC completo.
export const asuntoCorreo = (x, reservado) => (reservado ? "Ficha RUC" : `Ficha RUC ${x.ruc}`);

export function enlaceCorreo(x, opciones) {
  return `mailto:?subject=${encodeURIComponent(asuntoCorreo(x, opciones.reservado))}&body=${encodeURIComponent(textoFicha(x, opciones))}`;
}

export const enlaceWhatsapp = (x, opciones) => "https://wa.me/?text=" + encodeURIComponent(textoFicha(x, opciones));

// Lo que copia «Copiar»: RUC y razon social, segun la casilla.
export function textoCopiar(x, reservado) {
  const v = vista(x, reservado);
  return x.encontrado ? `${v.ruc}\t${v.razon}` : v.ruc;
}

// Firma del contador o estudio (opcional). Solo lo que la persona escribio.
export function lineasFirma(f) {
  if (!f) return [];
  const nombre = String(f.nombre || "").trim().slice(0, 80);
  const resto = [String(f.cpc || "").trim().slice(0, 40), String(f.telefono || "").trim().slice(0, 40)].filter(Boolean).join(" · ");
  return [nombre, resto].filter(Boolean);
}

// Nombre del archivo PNG: sin el RUC completo en modo reservado.
export const nombrePng = (x, reservado) => (reservado ? "ficha-ruc.png" : `ficha-ruc-${x.ruc}.png`);
