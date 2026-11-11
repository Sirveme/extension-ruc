// Textos del acceso para la persona (panel, popup y configuracion). Sin "llave": "tu prueba", "tu acceso".
export function textoDias(n) {
  const d = Number(n);
  if (!Number.isFinite(d)) return "quedan unos días";
  if (d <= 0) return "termina hoy";
  return d === 1 ? "queda 1 día" : `quedan ${d} días`;
}
