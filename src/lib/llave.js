// La llave de la API: el formato REAL que genera el panel (/panel/llaves) y acepta la API:
//   psp_live_<8 hex>_<secreto largo>      (el primer tramo es el PREFIJO visible; el resto, el secreto)
// El panel lista solo el prefijo (psp_live_<8 hex>); la llave completa se muestra UNA vez, al crearla.

export const FORMATO = /^psp_live_[a-z0-9]{8}_[A-Za-z0-9_-]{20,}$/;      // igual que _LLAVE_RE de la API
const PREFIJO = /^psp_live_[a-z0-9]{8}$/;

// Lo que la persona pega -> la llave limpia, o el motivo exacto por el que no sirve.
// Tolera lo que suele colarse al copiar: espacios y saltos de linea, comillas, "Bearer ",
// "Authorization:" y los puntos suspensivos de un prefijo enmascarado.
export function normalizarLlave(texto) {
  let t = String(texto || "").replace(/\s+/g, "");
  t = t.replace(/^authorization:/i, "").replace(/^bearer/i, "").replace(/^["'`]+|["'`]+$/g, "");
  if (FORMATO.test(t)) return { ok: true, llave: t };
  // Textos para la persona: NUNCA "llave" (de cara al usuario es su "código de acceso").
  if (!t) return { ok: false, motivo: "vacia", texto: "Pega tu código de acceso primero." };
  if (PREFIJO.test(t.replace(/[.…]+$/, "")))
    return { ok: false, motivo: "prefijo",
             texto: "Eso es solo el comienzo del código de acceso. El código completo es más largo y se muestra una sola vez, "
                  + "al crearlo. Si no lo guardaste, pide uno nuevo al Club." };
  if (/^psp_live_/.test(t))
    return { ok: false, motivo: "incompleta", texto: "El código de acceso parece incompleto: cópialo entero." };
  return { ok: false, motivo: "formato", texto: "Ese no es un código de acceso del Club." };
}
