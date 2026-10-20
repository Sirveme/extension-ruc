// Llamadas a la API. SOLO las usa el service worker: es el unico que lee la llave.
// - credentials: "omit" -> nunca viajan las cookies del Club con una consulta.
// - Cache de sesion (storage.session, se borra al cerrar Chrome): un RUC ya visto no gasta cuota.
// - La bitacora del servidor no guarda que RUC se consulto; la extension tampoco guarda historial.

export const API = "https://club.perusistemas.pro/api/v1";
const LOTE = 100;                     // tope del servidor por llamada
const CACHE_MS = 12 * 3600 * 1000;
const ESPERA_MAX_S = 5;

export async function llave() {
  return (await chrome.storage.local.get("llave")).llave || "";
}

function leerCuota(h) {
  const n = k => (h.get(k) === null ? null : Number(h.get(k)));
  if (h.get("X-Cuota-Limite") === null) return null;
  return { limite: n("X-Cuota-Limite"), usada: n("X-Cuota-Usada"), restante: n("X-Cuota-Restante"),
           reinicio: h.get("X-Cuota-Reinicio") };
}

async function guardarCuota(c) {
  if (c) await chrome.storage.local.set({ cuota: { ...c, visto: Date.now() } });
}

async function llamar(ruta, { metodo = "GET", cuerpo = null, clave } = {}) {
  const ctl = new AbortController();
  const reloj = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(API + ruta, {
      method: metodo, signal: ctl.signal, cache: "no-store", credentials: "omit",
      headers: { Authorization: "Bearer " + clave, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    let d = null;
    try { d = await r.json(); } catch (_) { /* sin cuerpo JSON */ }
    const cuota = leerCuota(r.headers);
    await guardarCuota(cuota);
    return { status: r.status, d, cuota, espera: Number(r.headers.get("Retry-After") || 0) };
  } catch (e) {
    return { status: 0, d: null, error: e.name === "AbortError" ? "tiempo" : "red" };
  } finally {
    clearTimeout(reloj);
  }
}

// Un error de la API -> mensaje claro para la persona.
export function mensaje(res) {
  const e = (res.d && res.d.error) || {};
  if (res.error === "tiempo") return { codigo: "tiempo", texto: "La consulta tardó demasiado. Intenta de nuevo." };
  if (res.status === 0) return { codigo: "red", texto: "Sin conexión. Revisa tu internet e intenta de nuevo." };
  if (res.status === 401) return { codigo: "llave_invalida", texto: "Tu llave no es válida. Revísala en Configuración." };
  if (res.status === 403) return { codigo: e.codigo || "llave_revocada", texto: "Tu llave está suspendida o revocada. Escríbenos al WhatsApp 967317946." };
  if (res.status === 429 && e.codigo === "cuota_agotada")
    return { codigo: "cuota_agotada", texto: `Llegaste a tu cuota del mes. Se reinicia el ${fechaCorta(e.reinicio)}.`,
             restante: e.restante ?? 0, reinicio: e.reinicio };
  if (res.status === 429) return { codigo: "demasiado_rapido", texto: "Vas muy rápido. Espera unos segundos e intenta de nuevo." };
  return { codigo: e.codigo || "error", texto: e.mensaje || "No pudimos consultar. Intenta de nuevo." };
}

function fechaCorta(iso) {
  if (!iso) return "inicio del próximo mes";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

// Valida una llave nueva con /yo (no consume cuota).
export async function validar(clave) {
  const res = await llamar("/yo", { clave });
  if (res.status !== 200) return { ok: false, ...mensaje(res) };
  await guardarCuota(res.d.cuota);
  return { ok: true, plan: res.d.plan, nombre: res.d.nombre, cuota: res.d.cuota };
}

export async function cuotaActual() {
  const { cuota } = await chrome.storage.local.get("cuota");
  return cuota || null;
}

// Refresca la cuota con /yo si el dato guardado es viejo (no consume).
export async function refrescarCuota(maxEdadMs = 5 * 60 * 1000) {
  const c = await cuotaActual();
  if (c && Date.now() - (c.visto || 0) < maxEdadMs) return c;
  const clave = await llave();
  if (!clave) return null;
  const res = await llamar("/yo", { clave });
  if (res.status === 200) { await guardarCuota(res.d.cuota); return { ...res.d.cuota, visto: Date.now() }; }
  return c;
}

async function deCache(rucs) {
  const claves = rucs.map(r => "c:" + r);
  const g = await chrome.storage.session.get(claves);
  const out = {};
  for (const r of rucs) {
    const x = g["c:" + r];
    if (x && Date.now() - x.t < CACHE_MS) out[r] = x.v;
  }
  return out;
}

// Cuantas consultas costaria (los que estan en cache no cuestan).
export async function costo(rucs) {
  const enCache = await deCache(rucs);
  return { total: rucs.length, nuevos: rucs.filter(r => !(r in enCache)).length, cuota: await cuotaActual() };
}

async function conReintento(fn) {
  let res = await fn();
  if (res.status === 429 && !(res.d && res.d.error && res.d.error.codigo === "cuota_agotada") && res.espera <= ESPERA_MAX_S) {
    await new Promise(ok => setTimeout(ok, Math.max(1, res.espera) * 1000));
    res = await fn();
  }
  return res;
}

// Consulta una lista de RUC (ya validados). -> {ok, resultados en el orden pedido, datos_al, gastadas}
export async function consultar(rucs) {
  const clave = await llave();
  if (!clave) return { ok: false, codigo: "sin_llave", texto: "Para ver la ficha necesitas tu llave gratuita." };
  const enCache = await deCache(rucs);
  const faltan = rucs.filter(r => !(r in enCache));
  const nuevos = {};
  let gastadas = 0, datosAl = null;
  if (faltan.length === 1) {
    const res = await conReintento(() => llamar("/ruc/" + faltan[0], { clave }));
    if (res.status === 200) { nuevos[faltan[0]] = res.d; datosAl = res.d.datos_al; gastadas = 1; }
    else if (res.status === 404) { nuevos[faltan[0]] = { ruc: faltan[0], encontrado: false }; gastadas = 1; }
    else return { ok: false, ...mensaje(res) };
  }
  for (let i = 0; faltan.length > 1 && i < faltan.length; i += LOTE) {
    const tanda = faltan.slice(i, i + LOTE);
    const res = await conReintento(() => llamar("/ruc/lote", { metodo: "POST", cuerpo: { rucs: tanda }, clave }));
    if (res.status !== 200) return { ok: false, ...mensaje(res), parcial: i > 0 };
    for (const x of res.d.resultados) nuevos[x.ruc] = x;
    datosAl = res.d.datos_al;
    gastadas += tanda.length;
  }
  const guardar = {};
  for (const [r, v] of Object.entries(nuevos)) guardar["c:" + r] = { t: Date.now(), v };
  if (Object.keys(guardar).length) await chrome.storage.session.set(guardar);
  const todos = { ...enCache, ...nuevos };
  return { ok: true, resultados: rucs.map(r => todos[r]), gastadas,
           datos_al: datosAl || Object.values(todos).map(x => x && x.datos_al).find(Boolean) || null,
           cuota: await cuotaActual() };
}
