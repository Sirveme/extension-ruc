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
