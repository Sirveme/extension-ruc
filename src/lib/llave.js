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
  if (!t) return { ok: false, motivo: "vacia", texto: "Pega tu llave primero." };
  if (PREFIJO.test(t.replace(/[.…]+$/, "")))
    return { ok: false, motivo: "prefijo",
             texto: "Eso es solo el prefijo de la llave (lo que muestra la lista del panel). La llave completa es más larga: "
                  + "sigue con otro «_» y un tramo largo, y se muestra una sola vez, al crearla. Si no la guardaste, crea una "
                  + "nueva en el panel y revoca la anterior." };
  if (/^psp_live_/.test(t))
    return { ok: false, motivo: "incompleta", texto: "La llave parece incompleta: cópiala entera con el botón «Copiar» del panel." };
  return { ok: false, motivo: "formato", texto: "Esa no es una llave de la API: las llaves empiezan con psp_live_." };
}
