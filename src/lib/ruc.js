// RUC: validacion (prefijo + digito verificador) y extraccion desde texto libre.
// Misma regla que el backend (identidad.dv_ruc): asi no confunde telefonos, numeros de
// comprobante ni cuentas bancarias con un RUC.

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function digitoVerificador(primeros10) {
  let suma = 0;
  for (let i = 0; i < 10; i++) suma += Number(primeros10[i]) * PESOS[i];
  const r = 11 - (suma % 11);
  return r === 10 ? 0 : r === 11 ? 1 : r;
}

export function rucValido(ruc) {
  return /^(10|15|17|20)\d{9}$/.test(ruc) && digitoVerificador(ruc.slice(0, 10)) === Number(ruc[10]);
}

// Todos los RUC validos del texto, sin repetir y en orden de aparicion. Un RUC debe ser un
// numero suelto de 11 digitos (no parte de un numero mas largo).
export function extraerRucs(texto, maximo = 500) {
  const limpio = String(texto || "").replace(/[   ]/g, " ");
  const vistos = new Set();
  const out = [];
  for (const m of limpio.matchAll(/(?<!\d)(?:10|15|17|20)\d{9}(?!\d)/g)) {
    const ruc = m[0];
    if (!vistos.has(ruc) && rucValido(ruc)) {
      vistos.add(ruc);
      out.push(ruc);
      if (out.length >= maximo) break;
    }
  }
  return out;
}

// Todo numero suelto de 11 digitos del texto: los RUC validos y los RECHAZADOS con su motivo
// (para decirlo en vez de omitirlos). motivo: "digito" (no cumple el digito verificador) |
// "prefijo" (no empieza con 10, 15, 17 o 20).
export function analizarTexto(texto, maximo = 500) {
  const limpio = String(texto || "").replace(/[   ]/g, " ");
  const vistos = new Set();
  const rucs = [], invalidos = [];
  for (const m of limpio.matchAll(/(?<!\d)\d{11}(?!\d)/g)) {
    const v = m[0];
    if (vistos.has(v)) continue;
    vistos.add(v);
    if (rucValido(v)) rucs.push(v);
    else invalidos.push({ valor: v, motivo: /^(10|15|17|20)/.test(v) ? "digito" : "prefijo" });
    if (rucs.length + invalidos.length >= maximo) break;
  }
  return { rucs, invalidos };
}

export function textoInvalido(x) {
  return x.motivo === "digito"
    ? `RUC ${x.valor} — no válido (no cumple el dígito verificador)`
    : `${x.valor} — no es un RUC (un RUC empieza con 10, 15, 17 o 20)`;
}

// Por que no hay RUC en lo seleccionado: para un mensaje claro en vez de un "no se encontro".
export function motivoSinRuc(texto) {
  const t = String(texto || "");
  if (/(?<!\d)\d{8}(?!\d)/.test(t)) return "dni";
  if (/(?<!\d)(?:10|15|17|20)\d{9}(?!\d)/.test(t)) return "digito";
  return "nada";
}

// "2026-10-10" -> "10/10/2026"
export function fecha(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function soles(n) {
  if (n === null || n === undefined || n === "") return "";
  return "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
