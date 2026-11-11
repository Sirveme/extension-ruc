// Textos del acceso para la persona (panel, popup y configuracion). Sin "llave": "tu prueba", "tu acceso".
export function textoDias(n) {
  const d = Number(n);
  if (!Number.isFinite(d)) return "quedan unos días";
  if (d <= 0) return "termina hoy";
  return d === 1 ? "queda 1 día" : `quedan ${d} días`;
}

// Estado del acceso pedido al service worker. Si quien responde es el service worker de la version
// ANTERIOR (se actualizo la carpeta sin recargar la extension), no conoce "acceso" ni devuelve
// "tieneAcceso": se usa su mensaje "cuota", que dice si hay acceso guardado, y se sigue consultando
// normal con ese acceso. Nunca se pide una prueba por esto.
export async function pedirEstado(enviar, m) {
  const r = await enviar(m);
  if (r && "tieneAcceso" in r) return r;
  const v = r && "tieneLlave" in r ? r : await enviar({ tipo: "cuota" });
  if (v && "tieneAcceso" in v) return v;
  if (v && "tieneLlave" in v) {
    return { tieneAcceso: !!v.tieneLlave, acceso: v.tieneLlave ? { tipo: "permanente" } : null, codigo: null,
             cuota: v.cuota || null, boton: !!v.boton, enlaces: {}, registroAbierto: false, anterior: true,
             error: v.tieneLlave ? null : { texto: "Actualiza la extensión: abre chrome://extensions y toca ↻ en Ficha RUC." } };
  }
  return r || {};
}
