// Llamadas a la API. SOLO las usa el service worker: es el unico que lee la credencial.
// - credentials: "omit" -> nunca viajan las cookies del Club con una consulta.
// - Cache de sesion (storage.session, se borra al cerrar Chrome): un RUC ya visto no gasta cuota.
// - La bitacora del servidor no guarda que RUC se consulto; la extension tampoco guarda historial.
// - Prueba gratis: la primera vez la extension pide SOLA una credencial de prueba (15 dias) atada a
//   esta instalacion (un UUID que se genera una vez y se guarda). El vencimiento lo controla el
//   SERVIDOR: borrar los datos no reinicia la prueba. Al abrirse, se re-valida con /yo (no consume)
//   para detectar cuando el Club activo el acceso permanente.
//   De cara a la persona NUNCA se habla de llaves: "tu prueba" y "tu acceso".

export const API = "https://club.perusistemas.pro/api/v1";
export const SITIO = API.replace(/\/api\/v1$/, "");      // el Verificador ("Ver más") vive en el mismo sitio
const LOTE = 100;                     // tope del servidor por llamada
const CACHE_MS = 12 * 3600 * 1000;
const ESPERA_MAX_S = 5;
const REVALIDAR_MS = 60 * 1000;
export const WA_CLUB = "51938246208";                    // bandeja del Club (registro manual por ahora)

// Enlaces del muro de registro. El codigo de la instalacion va en el mensaje y en la vuelta del
// registro: asi el Club sabe que acceso activar.
export function enlaces(codigo) {
  const texto = "Hola, quiero unirme al Club de Contadores. Vengo de la extensión Ficha RUC. #RUC-EXT"
    + (codigo ? ` · Código ${codigo}` : "");
  const vuelta = "/extension/vincular" + (codigo ? "?c=" + encodeURIComponent(codigo) : "");
  return { whatsapp: `https://wa.me/${WA_CLUB}?text=${encodeURIComponent(texto)}`,
           registro: `${SITIO}/registro?para=contador&sig=${encodeURIComponent(vuelta)}`, texto };
}

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
      headers: { ...(clave ? { Authorization: "Bearer " + clave } : {}), ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
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
  if (res.status === 401) return { codigo: "acceso_invalido", texto: "No pudimos validar tu acceso. Cierra y vuelve a abrir la extensión." };
  if (res.status === 403 && e.codigo === "prueba_vencida")
    return { codigo: "prueba_vencida", texto: "Tu prueba terminó. Únete al Club de Contadores: es gratis." };
  if (res.status === 403) return { codigo: e.codigo || "acceso_suspendido", texto: "Tu acceso está suspendido. Escríbenos al WhatsApp 967317946." };
  if (res.status === 429 && e.codigo === "cuota_agotada" && e.periodo === "dia")     // tope diario de la prueba
    return { codigo: "cuota_agotada", texto: "Llegaste al tope de consultas de hoy. Mañana puedes seguir.",
             restante: e.restante ?? 0, reinicio: e.reinicio };
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

// Valida un acceso pegado a mano (modo avanzado) con /yo (no consume cuota).
export async function validar(clave) {
  const res = await llamar("/yo", { clave });
  if (res.status !== 200) return { ok: false, ...mensaje(res) };
  await guardarCuota(res.d.cuota);
  await chrome.storage.local.set({ acceso: { ...(res.d.acceso || { tipo: "permanente" }), visto: Date.now() } });
  return { ok: true, plan: res.d.plan, nombre: res.d.nombre, cuota: res.d.cuota, acceso: res.d.acceso };
}

// --- Prueba gratis y estado del acceso ---------------------------------------------------------
async function instalacion() {
  const { instalacion: i } = await chrome.storage.local.get("instalacion");
  if (i) return i;
  const nueva = crypto.randomUUID();
  await chrome.storage.local.set({ instalacion: nueva });
  return nueva;
}

// Pide (o recupera) la prueba de ESTA instalacion. Si ya la tenia, el servidor da una credencial
// nueva con el MISMO vencimiento: no se reinician los 15 dias.
export async function pedirPrueba() {
  const res = await llamar("/prueba", { metodo: "POST", cuerpo: { instalacion: await instalacion() } });
  if ((res.status === 200 || res.status === 201) && res.d && res.d.credencial) {
    const acceso = { ...res.d.acceso, visto: Date.now() };
    if (acceso.tipo === "prueba" && acceso.dias_restantes === 0) acceso.tipo = "vencida";
    await chrome.storage.local.set({ llave: res.d.credencial, codigo: res.d.codigo, acceso, registro_abierto: !!res.d.registro_abierto });
    return { ok: true, acceso, codigo: res.d.codigo };
  }
  if (res.status === 0) return { ok: false, ...mensaje(res) };
  return { ok: false, codigo: "prueba_no_disponible", texto: "No pudimos iniciar tu prueba gratis en este momento. Intenta más tarde." };
}

// Consulta /yo (no consume) y guarda el estado: prueba (con dias), permanente o vencida.
export async function revalidar() {
  const clave = await llave();
  if (!clave) return pedirPrueba();
  const res = await llamar("/yo", { clave });
  if (res.status === 200) {
    await guardarCuota(res.d.cuota);
    const acceso = { ...(res.d.acceso || { tipo: "permanente" }), visto: Date.now() };
    await chrome.storage.local.set({ acceso, registro_abierto: !!res.d.registro_abierto });
    return { ok: true, acceso };
  }
  if (res.status === 403 && res.d && res.d.error && res.d.error.codigo === "prueba_vencida") {
    const acceso = { tipo: "vencida", visto: Date.now() };
    await chrome.storage.local.set({ acceso, registro_abierto: !!res.d.error.registro_abierto });
    return { ok: true, acceso };
  }
  if (res.status === 401 && (await chrome.storage.local.get("instalacion")).instalacion) return pedirPrueba();
  return { ok: false, ...mensaje(res) };              // sin conexion: se queda con lo que sabia
}

// Lo que muestran el panel, el popup y la configuracion. Re-valida al abrirse (o si el dato es viejo).
export async function estadoAcceso({ forzar = false } = {}) {
  let { acceso, codigo, llave: clave } = await chrome.storage.local.get(["acceso", "codigo", "llave"]);
  // «Regístrate aquí» solo con el registro del Club abierto (lo dice el servidor en cada consulta)
  let error = null;
  if (forzar || !clave || !acceso || Date.now() - (acceso.visto || 0) > REVALIDAR_MS) {
    const r = await revalidar();
    if (r.ok) ({ acceso, codigo, llave: clave } = await chrome.storage.local.get(["acceso", "codigo", "llave"]));
    else error = r;
  }
  const { registro_abierto: registro } = await chrome.storage.local.get("registro_abierto");
  return { tieneAcceso: !!clave, acceso: acceso || null, codigo: codigo || null, cuota: await cuotaActual(),
           enlaces: enlaces(codigo), registroAbierto: !!registro, error };
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

// Error de una consulta: si la prueba vencio, se recuerda (el panel muestra el muro); si la
// credencial dejo de valer, se recupera la de esta instalacion para el proximo intento.
async function fallo(res) {
  const m = mensaje(res);
  if (m.codigo === "prueba_vencida") await chrome.storage.local.set({ acceso: { tipo: "vencida", visto: Date.now() } });
  if (m.codigo === "acceso_invalido" && (await chrome.storage.local.get("instalacion")).instalacion) {
    const p = await pedirPrueba();
    if (p.ok) return { ok: false, codigo: "reintentar", texto: "Renovamos tu acceso. Vuelve a intentar." };
  }
  return { ok: false, ...m };
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
  if (!(await llave())) {
    const p = await pedirPrueba();
    if (!p.ok) return { ok: false, codigo: "sin_acceso", texto: p.texto };
  }
  const clave = await llave();
  const enCache = await deCache(rucs);
  const faltan = rucs.filter(r => !(r in enCache));
  const nuevos = {};
  let gastadas = 0, datosAl = null;
  if (faltan.length === 1) {
    const res = await conReintento(() => llamar("/ruc/" + faltan[0], { clave }));
    if (res.status === 200) { nuevos[faltan[0]] = res.d; datosAl = res.d.datos_al; gastadas = 1; }
    else if (res.status === 404) { nuevos[faltan[0]] = { ruc: faltan[0], encontrado: false }; gastadas = 1; }
    else return fallo(res);
  }
  for (let i = 0; faltan.length > 1 && i < faltan.length; i += LOTE) {
    const tanda = faltan.slice(i, i + LOTE);
    const res = await conReintento(() => llamar("/ruc/lote", { metodo: "POST", cuerpo: { rucs: tanda }, clave }));
    if (res.status !== 200) return { ...(await fallo(res)), parcial: i > 0 };
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
