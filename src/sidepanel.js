// Panel lateral: ficha de un RUC o tabla de varios, en el estilo hoja de calculo del ecosistema.
// Todo dato de la API se pinta con textContent (nunca como HTML). Sin pistas de la fuente.
import { fecha, soles, textoInvalido } from "./lib/ruc.js";
import { SITIO } from "./lib/api.js";

const vista = document.getElementById("vista");
const $ = id => document.getElementById(id);
let ultimo = 0;                       // pedido ya mostrado (para no repetirlo)
let lote = null;                      // ultima tabla (volver de la ficha a la tabla)

const enviar = m => chrome.runtime.sendMessage(m);
function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k === "texto") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h !== null && h !== undefined && h !== false && h !== "") e.append(h);
  return e;
}
const limpiar = (...n) => { cerrarMenu(); vista.replaceChildren(...n.flat().filter(x => x !== null && x !== undefined && x !== false)); vista.scrollTop = 0; };
const mensaje = (texto, tipo = "") => el("div", { class: "msg " + tipo, texto });
const fx = t => { $("fx").textContent = t || ""; };
const titulo = t => String(t || "").toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());

function pintarCuota(c) {
  $("cuota").textContent = c && c.restante !== null && c.restante !== undefined ? `${c.restante}/${c.limite} consultas este mes` : "";
}
// Las fechas de corte vienen de la API (nunca fijas aqui): `datos_al` = estado, condicion,
// domicilio y anexos; `cortes.listas` = las listas publicas (coactiva, retencion...). Si difieren
// se muestran las dos, cada una con lo suyo.
const corteListas = (...xs) => (xs.flat().find(x => x && x.cortes && x.cortes.listas) || {}).cortes?.listas || null;
const pintarDatosAl = (d, listas = null) => {
  const t = [d && `Datos al ${fecha(d)}`, listas && listas !== d && `listas al ${fecha(listas)}`].filter(Boolean).join(" · ");
  $("datosAl").textContent = t;
  $("datosAl").title = listas && listas !== d ? "Estado, condición y domicilio: primera fecha. Listas (coactiva, retención…): segunda." : "";
};

// --- Riesgo de un resultado ---------------------------------------------------------------
function riesgos(x) {
  if (!x || !x.encontrado) return [];
  const r = [];
  if (x.marcas && x.marcas.ssco) r.push("Sin capacidad operativa");
  if (x.condicion && x.condicion.semaforo === "rojo") r.push(x.condicion.nombre || "No habido");
  if (x.estado && x.estado.semaforo === "rojo") r.push(x.estado.nombre || "No activo");
  for (const p of x.listas || []) if (p.tipo === "riesgo") r.push(p.nombre);
  return r;
}
const chip = (s, texto) => el("span", { class: "chip-sem " + ((s && s.semaforo) || "gris") },
  el("s", { class: "sem " + ((s && s.semaforo) || "gris") }), texto || (s && s.nombre) || "—");

// --- Acciones: copiar, compartir por WhatsApp, ver mas en el Verificador -------------------
function textoCompartir(x, datosAl) {
  const partes = [`RUC ${x.ruc}`, x.encontrado ? x.razon_social : "No figura en nuestros datos"];
  if (x.encontrado) partes.push(`${x.estado.nombre} · ${x.condicion.nombre}`);
  const r = riesgos(x);
  if (r.length) partes.push("⚠️ " + r.join(", "));
  const d = datosAl || x.datos_al;
  return partes.join(" — ") + (d ? ` (datos al ${fecha(d)})` : "");
}
async function copiar(x, boton) {
  await navigator.clipboard.writeText(x.encontrado ? `${x.ruc}\t${x.razon_social}` : x.ruc);
  if (boton) { const t = boton.textContent; boton.textContent = "Copiado ✓"; setTimeout(() => (boton.textContent = t), 1400); }
}
const abrir = url => window.open(url, "_blank", "noopener");
const compartir = x => abrir("https://wa.me/?text=" + encodeURIComponent(textoCompartir(x, lote && lote.datos_al)));
const verMas = x => abrir(`${SITIO}/verificador?ruc=${encodeURIComponent(x.ruc)}`);
const ACCIONES = [
  ["Copiar RUC y razón social", (x, b) => copiar(x, b)],
  ["Compartir por WhatsApp", x => compartir(x)],
  ["Ver más en el Verificador ↗", x => verMas(x)],
];

let menu = null;
function cerrarMenu() {
  if (!menu) return;
  menu.boton.setAttribute("aria-expanded", "false");
  menu.caja.remove(); menu = null;
}
function abrirMenu(x, boton) {
  const igual = menu && menu.boton === boton;
  cerrarMenu();
  if (igual) return;
  const caja = el("div", { class: "menu-pop", role: "menu" },
    ACCIONES.map(([t, fn]) => el("button", { role: "menuitem", texto: t, onclick: async e => {
      e.stopPropagation(); await fn(x, e.currentTarget); setTimeout(cerrarMenu, /Copiar/.test(t) ? 900 : 0); } })));
  document.body.append(caja);
  const r = boton.getBoundingClientRect(), w = caja.offsetWidth, h = caja.offsetHeight;
  caja.style.left = Math.max(6, Math.min(r.right - w, innerWidth - w - 6)) + "px";
  caja.style.top = (r.bottom + h + 6 > innerHeight ? Math.max(6, r.top - h - 2) : r.bottom + 2) + "px";
  boton.setAttribute("aria-expanded", "true");
  menu = { caja, boton };
  caja.querySelector("button").focus();
}
document.addEventListener("click", e => { if (menu && !menu.caja.contains(e.target) && e.target !== menu.boton) cerrarMenu(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarMenu(); });
vista.addEventListener("scroll", cerrarMenu);

// --- Estados simples ---------------------------------------------------------------------------
function sinLlave() {
  fx("");
  limpiar(el("div", { class: "vacio" }, el("b", { texto: "Configura tu llave" }),
    "Para ver la ficha necesitas tu llave gratuita. Pégala una vez en Configuración y queda guardada en este equipo."),
    el("div", { class: "acciones" }, el("button", { class: "pri", texto: "Ir a Configuración", onclick: () => chrome.runtime.openOptionsPage() })),
    el("p", { class: "muted", texto: "¿Aún no tienes llave? Escríbenos al WhatsApp 967317946." }));
}
function inicio() {
  fx("");
  limpiar(el("div", { class: "vacio" }, el("b", { texto: "Selecciona un RUC" }),
    "En cualquier página, selecciona un RUC (o un texto con varios), clic derecho y elige «Ficha RUC». ",
    "También puedes pegarlos desde el ícono de la extensión."));
}
const bloqueNoValidos = inv => inv && inv.length
  ? el("section", { class: "bloque novalidos", "aria-label": "No válidos" }, el("b", { texto: `No válidos (${inv.length})` }),
      inv.map(x => el("div", { class: "linea", texto: textoInvalido(x) })))
  : null;

// --- Ficha ---------------------------------------------------------------------------------------
function ficha(x, { volver = null, invalidos = [] } = {}) {
  fx(`RUC ${x.ruc}`);
  pintarDatosAl(x.datos_al || (lote && lote.datos_al), corteListas(x, lote ? lote.resultados : []));
  if (!x.encontrado) {
    return limpiar(volver, el("div", { class: "ficha" },
      el("div", { class: "celdas" }, el("div", { class: "et", texto: "RUC" }), el("div", { class: "va mono", texto: x.ruc })),
      mensaje(`El RUC ${x.ruc} es válido, pero no figura en nuestros datos: puede ser muy reciente o tener un dígito cambiado.`)),
      bloqueNoValidos(invalidos));
  }
  const lugar = [x.distrito, x.provincia, x.departamento].filter(Boolean).map(titulo).join(" · ");
  const fila = (et, va, clase = "") => [el("div", { class: "et", texto: et }), el("div", { class: "va " + clase }, va)];
  const riesgo = [], info = [];
  const s = x.marcas && x.marcas.ssco;
  if (s) riesgo.push(el("div", { class: "linea riesgo" }, el("span", { texto: "Sin capacidad operativa" }),
    el("small", { texto: [s.firme && `Firme desde ${fecha(s.firme)}`, s.resolucion].filter(Boolean).join(" · ") })));
  for (const p of x.listas || []) {
    const det = [p.desde && `Desde ${fecha(p.desde)}`, p.monto_deuda && soles(p.monto_deuda), p.resolucion, p.servicio,
                 p.historico && "Lista antigua: no describe la situación actual"].filter(Boolean).join(" · ");
    (p.tipo === "riesgo" ? riesgo : info).push(el("div", { class: "linea " + (p.tipo === "riesgo" ? "riesgo" : "info") },
      el("span", { texto: p.nombre }), det ? el("small", { texto: det }) : null));
  }
  if (x.marcas && x.marcas.contador) info.push(el("div", { class: "linea info" }, el("span", { texto: "Contador o estudio contable" })));
  if (x.marcas && x.marcas.negocio_nuevo) info.push(el("div", { class: "linea info" }, el("span", { texto: "Negocio nuevo" }),
    el("small", { texto: `Inscrito el ${fecha(x.marcas.negocio_nuevo.inscrito)}` })));
  limpiar(volver,
    invalidos.length ? bloqueNoValidos(invalidos) : null,
    el("article", { class: "ficha" },
      el("div", { class: "acciones" }, ACCIONES.map(([t, fn]) => el("button", { texto: t.replace(" RUC y razón social", ""), title: t,
        onclick: e => fn(x, e.currentTarget) }))),
      el("div", { class: "celdas" },
        fila("RUC", x.ruc, "mono"),
        fila("Razón social", x.razon_social || "", "razon"),
        fila("Estado del contribuyente", chip(x.estado)),
        fila("Condición del domicilio", chip(x.condicion)),
        lugar ? fila("Ubicación", lugar) : [],
        x.domicilio ? fila("Domicilio fiscal", x.domicilio) : [],
        fila("Locales anexos", String((x.anexos && x.anexos.total) || 0), "mono")),
      riesgo.length ? el("section", { class: "bloque" }, el("b", { texto: "Alertas" }), riesgo) : null,
      info.length ? el("section", { class: "bloque" }, el("b", { texto: "Información" }), info) : null));
}

// --- Tabla -----------------------------------------------------------------------------------------
function tabla(res, invalidos) {
  lote = { ...res, invalidos };
  const filas = res.resultados.filter(Boolean);
  const conRiesgo = filas.filter(x => riesgos(x).length).length;
  fx(`${filas.length} RUC${invalidos.length ? ` · ${invalidos.length} no válido${invalidos.length === 1 ? "" : "s"}` : ""}`);
  pintarDatosAl(res.datos_al, corteListas(res.resultados));
  const soloRiesgo = el("input", { type: "checkbox" });
  const cuerpo = el("tbody");
  const pintar = () => {
    cerrarMenu();
    const ver = filas.filter(x => !soloRiesgo.checked || riesgos(x).length);
    cuerpo.replaceChildren(...ver.map((x, i) => {
      const r = riesgos(x);
      const kebab = el("button", { class: "kebab", texto: "⋮", title: "Acciones", "aria-label": `Acciones de ${x.ruc}`, "aria-haspopup": "menu",
        "aria-expanded": "false", onclick: e => { e.stopPropagation(); abrirMenu(x, e.currentTarget); } });
      return el("tr", { class: "fila" + (r.length ? " rojo" : "") + (x.encontrado ? "" : " nofigura"), tabindex: "0", title: "Ver ficha",
          onclick: () => abrirDesdeTabla(x), onkeydown: e => e.key === "Enter" && e.target === e.currentTarget && abrirDesdeTabla(x) },
        el("td", { class: "n", texto: String(i + 1) }),
        el("td", { class: "c-id" }, el("b", { class: "mono ruc", texto: x.ruc }),
          el("span", { class: "rs", texto: x.encontrado ? x.razon_social : "No figura en nuestros datos" }),
          r.length ? el("span", { class: "riesgos", texto: r.join(" · ") }) : null),
        el("td", { class: "c-est" }, x.encontrado ? chip(x.estado) : "—"),
        el("td", { class: "c-dom" }, x.encontrado ? chip(x.condicion) : "—"),
        el("td", { class: "c-acc" }, kebab));
    }));
    if (!ver.length) cuerpo.replaceChildren(el("tr", {}, el("td", { colspan: "5", class: "vacio", texto: "Ninguno con riesgo." })));
  };
  soloRiesgo.addEventListener("change", pintar);
  limpiar(
    el("div", { class: "barra" },
      el("b", { texto: `${filas.length} RUC` }), el("span", { class: "muted", texto: conRiesgo ? `· ${conRiesgo} con riesgo` : "· ninguno con riesgo" }),
      el("span", { class: "sp" }), el("label", {}, soloRiesgo, "Solo con riesgo")),
    el("div", { class: "barra" },
      el("button", { texto: "Copiar tabla", onclick: e => copiarTabla(filas, e.currentTarget) }),
      el("button", { texto: "Descargar CSV", onclick: () => descargarCsv(filas) })),
    el("table", { class: "tabla" },
      el("thead", {}, el("tr", {}, el("th", { class: "n", texto: "#" }), el("th", { class: "c-id", texto: "RUC · Razón social" }),
        el("th", { class: "c-est", texto: "Estado" }), el("th", { class: "c-dom", texto: "Domicilio" }), el("th", { class: "c-acc", "aria-label": "Acciones" }))),
      cuerpo),
    bloqueNoValidos(invalidos));
  pintar();
}

function abrirDesdeTabla(x) {
  ficha(x, { volver: el("div", { class: "acciones" }, el("button", { texto: "← Volver a la tabla", onclick: () => tabla(lote, lote.invalidos) })) });
}

const filasPlanas = filas => [["RUC", "Razón social", "Estado del contribuyente", "Condición del domicilio", "Distrito", "Provincia", "Departamento", "Riesgo", "Listas"],
  ...filas.map(x => x.encontrado
    ? [x.ruc, x.razon_social, x.estado.nombre, x.condicion.nombre, x.distrito || "", x.provincia || "", x.departamento || "",
       riesgos(x).join("; "), (x.listas || []).map(p => p.nombre).join("; ")]
    : [x.ruc, "No figura en nuestros datos", "", "", "", "", "", "", ""])];

async function copiarTabla(filas, boton) {
  await navigator.clipboard.writeText(filasPlanas(filas).map(f => f.join("\t")).join("\n"));
  boton.textContent = "Copiada ✓"; setTimeout(() => (boton.textContent = "Copiar tabla"), 1500);
}
function descargarCsv(filas) {
  const csv = "﻿" + filasPlanas(filas).map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = el("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: "ficha-ruc.csv" });
  document.body.append(a); a.click(); a.remove();
}

// --- Pedido -> confirmar costo -> consultar -> mostrar ---------------------------------------------
async function consultar(rucs, invalidos) {
  fx(rucs.length > 1 ? `${rucs.length} RUC` : `RUC ${rucs[0]}`);
  limpiar(el("div", { class: "vacio", texto: rucs.length > 1 ? `Consultando ${rucs.length} RUC…` : "Consultando…" }));
  const res = await enviar({ tipo: "consultar", rucs });
  pintarCuota(res.cuota);
  if (!res.ok) {
    if (res.codigo === "sin_llave") return sinLlave();
    if (res.codigo === "llave_invalida") return limpiar(mensaje(res.texto, "err"),
      el("div", { class: "acciones" }, el("button", { class: "pri", texto: "Revisar mi llave", onclick: () => chrome.runtime.openOptionsPage() })));
    return limpiar(mensaje(res.texto, "err"),
      res.codigo === "cuota_agotada" ? el("p", { class: "muted", texto: "¿Necesitas más consultas? Escríbenos al WhatsApp 967317946." }) : null);
  }
  if (rucs.length === 1) { lote = null; ficha(res.resultados[0], { invalidos }); } else tabla(res, invalidos);
}

async function atender(p) {
  if (!p || p.t === ultimo) return;
  ultimo = p.t;
  const invalidos = p.invalidos || [];
  const est = await enviar({ tipo: "cuota" });
  pintarCuota(est.cuota);
  if (!est.tieneLlave) return sinLlave();
  if (!p.rucs.length) {
    pintarDatosAl(null);
    if (invalidos.length) {                                    // solo rechazados: se dicen uno por uno
      fx(invalidos.length === 1 ? invalidos[0].valor : `${invalidos.length} números`);
      return limpiar(bloqueNoValidos(invalidos), el("p", { class: "muted", texto: "Revisa los dígitos y vuelve a intentar." }));
    }
    fx("");
    const t = { dni: "Por ahora la ficha es solo por RUC (11 dígitos). Ese número parece un DNI.",
                nada: "No encontramos un RUC en lo que seleccionaste." }[p.motivo] || "No encontramos un RUC en lo que seleccionaste.";
    return limpiar(mensaje(t), el("p", { class: "muted", texto: "Selecciona un RUC de 11 dígitos y vuelve a intentar." }));
  }
  const c = await enviar({ tipo: "costo", rucs: p.rucs });
  const restante = c.cuota && c.cuota.restante !== null && c.cuota.restante !== undefined ? c.cuota.restante : null;
  // Un solo RUC: el menu ya dice que usa 1 consulta. Varios: se confirma el costo antes.
  if (p.rucs.length === 1 || c.nuevos === 0) return consultar(p.rucs, invalidos);
  fx(`${p.rucs.length} RUC${invalidos.length ? ` · ${invalidos.length} no válido${invalidos.length === 1 ? "" : "s"}` : ""}`);
  const alcanza = restante === null || c.nuevos <= restante;
  limpiar(el("div", { class: "vacio" }, el("b", { texto: `Encontramos ${p.rucs.length} RUC` }),
      c.nuevos < p.rucs.length ? `${p.rucs.length - c.nuevos} ya los consultaste hoy (no cuestan). ` : ""),
    alcanza
      ? el("div", { class: "barra" }, el("button", { class: "pri", texto: `Ver datos · ${c.nuevos} consulta${c.nuevos === 1 ? "" : "s"}`,
          onclick: () => consultar(p.rucs, invalidos) }),
          restante !== null ? el("span", { class: "muted", texto: `te quedan ${restante} este mes` }) : null)
      : el("div", {}, mensaje(`Ver datos de todos usaría ${c.nuevos} consultas y te quedan ${restante} este mes.`),
          restante > 0 ? el("div", { class: "barra" }, el("button", { class: "pri", texto: `Consultar los primeros ${restante}`,
            onclick: () => consultar(p.rucs.slice(0, restante), invalidos) })) : null),
    bloqueNoValidos(invalidos));
}

chrome.storage.session.onChanged.addListener(ch => { if (ch.pedido) atender(ch.pedido.newValue); });
(async () => {
  const { pedido } = await chrome.storage.session.get("pedido");
  if (pedido && Date.now() - pedido.t < 60000) atender(pedido);
  else {
    const est = await enviar({ tipo: "cuota" });
    pintarCuota(est.cuota);
    est.tieneLlave ? inicio() : sinLlave();
  }
})();
