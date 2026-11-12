// Panel lateral: ficha de un RUC o tabla de varios, en el estilo hoja de calculo del ecosistema.
// Todo dato de la API se pinta con textContent (nunca como HTML). Sin pistas de la fuente.
import { fecha, soles, textoInvalido } from "./lib/ruc.js";
import { SITIO } from "./lib/api.js";
import { textoDias, pedirEstado } from "./lib/acceso.js";
import { riesgos, vista as vistaFicha, textoCopiar, enlaceWhatsapp, enlaceCorreo, asuntoCorreo, nombrePng } from "./lib/compartir.js";
import { imagenFicha } from "./lib/imagen.js";

const vista = document.getElementById("vista");
const $ = id => document.getElementById(id);
let ultimo = 0;                       // pedido ya mostrado (para no repetirlo)
let lote = null;                      // ultima tabla (volver de la ficha a la tabla)
// Modo reservado: casilla «Ocultar datos del contribuyente». Se guarda en este equipo; al instalar, marcada.
let reservado = true;
let fichaActual = null;               // { x, opciones } de la ficha en pantalla (para repintar sin consultar)
let cajaCompartir = false;            // la caja de compartir sigue abierta al cambiar la casilla
const preferencias = chrome.storage.local.get("reservado").then(p => { reservado = p.reservado !== false; }).catch(() => {});

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

const chip = (s, texto) => el("span", { class: "chip-sem " + ((s && s.semaforo) || "gris") },
  el("s", { class: "sem " + ((s && s.semaforo) || "gris") }), texto || (s && s.nombre) || "—");

// --- Acciones: copiar, compartir, ver mas en el Verificador ----------------------------------------
// Lo que se copia o comparte respeta la casilla de modo reservado. Nada de esto consulta ni gasta cuota.
const opcionesCompartir = x => ({ reservado, datosAl: x.datos_al || (lote && lote.datos_al) });
async function copiar(x, boton) {
  await navigator.clipboard.writeText(textoCopiar(x, reservado));
  if (boton) { const t = boton.textContent; boton.textContent = "Copiado ✓"; setTimeout(() => (boton.textContent = t), 1400); }
}
const abrir = url => window.open(url, "_blank", "noopener");
// Tras preparar la imagen (puede tardar un momento), una pestana nueva no depende del bloqueador de ventanas.
const abrirPestana = url => chrome.tabs.create({ url }).catch(() => abrir(url));
const abrirCorreo = url => { const a = el("a", { href: url }); document.body.append(a); a.click(); a.remove(); };
const compartir = x => abrir(enlaceWhatsapp(x, opcionesCompartir(x)));
async function firma() {
  try { return (await chrome.storage.local.get("firma")).firma || null; } catch (_) { return null; }
}
async function png(x) {
  return imagenFicha(x, { ...opcionesCompartir(x), firma: await firma() });
}
async function copiarImagen(x) {
  const b = await png(x);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
}
async function descargarPng(x) {
  const a = el("a", { href: URL.createObjectURL(await png(x)), download: nombrePng(x, reservado) });
  document.body.append(a); a.click(); a.remove();
}
const verMas = x => abrir(`${SITIO}/verificador?ruc=${encodeURIComponent(x.ruc)}`);
const ACCIONES = [
  ["Copiar RUC y razón social", (x, b) => copiar(x, b)],
  ["Compartir por WhatsApp", x => compartir(x)],                        // texto, segun la casilla
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

// --- Prueba gratis: aviso discreto y muro de registro (sin hablar de llaves) -------------------------
let est = null;                       // estado del acceso: { acceso: {tipo, dias_restantes}, codigo, enlaces }
const vencida = () => !!(est && est.acceso && est.acceso.tipo === "vencida");

function pintarAviso() {
  const a = est && est.acceso, caja = $("aviso");
  if (!a || a.tipo !== "prueba") { caja.classList.remove("urgente"); return caja.replaceChildren(); }
  const d = Number(a.dias_restantes);
  const urgente = Number.isFinite(d) && d <= 3;                 // 3 dias o menos: la barra se enciende
  caja.classList.toggle("urgente", urgente);
  caja.replaceChildren(
    urgente
      ? el("span", { class: "txt" }, el("b", { texto: d <= 0 ? "Tu prueba termina hoy." : `Tu prueba termina en ${d} día${d === 1 ? "" : "s"}.` }),
          " Únete gratis y no pierdas tu acceso")
      : el("span", { class: "txt" }, el("b", { texto: "Prueba gratis" }), ` · ${textoDias(a.dias_restantes)}.`),
    el("button", { class: "pri unete", texto: "Únete gratis al Club", onclick: () => muro() }));
}

function muro() {
  const fin = vencida();
  fx("");
  pintarDatosAl(null);
  const e = (est && est.enlaces) || {};
  limpiar(el("section", { class: "muro", "aria-label": "Únete al Club" },
    el("h2", { texto: fin ? "Tu prueba terminó." : "Únete al Club de Contadores" }),
    el("p", { texto: fin ? "Únete al Club de Contadores: es gratis. Así sigues viendo la ficha de cualquier RUC."
                         : "Es gratis: únete y sigue usándola sin interrupciones cuando termine tu prueba." }),
    el("div", { class: "acciones principal" },
      el("button", { class: "pri grande", texto: "Únete por WhatsApp", onclick: () => abrir(e.whatsapp) }),
      est && est.registroAbierto ? el("button", { texto: "Regístrate aquí", onclick: () => abrir(e.registro) }) : null),
    est && est.codigo ? el("p", { class: "muted" }, "Tu código: ", el("span", { class: "codigo", texto: est.codigo }),
      " · ya va en el mensaje de WhatsApp.") : null,
    el("p", { class: "muted", texto: "Cuando activemos tu acceso, la extensión lo detecta sola: no tienes que pegar nada." }),
    el("div", { class: "acciones" },
      fin ? el("button", { texto: "Ya me uní: revisar de nuevo", onclick: e2 => revisar(e2.currentTarget) })
          : el("button", { texto: "← Seguir con mi prueba", onclick: () => inicio() }))));
}

async function revisar(boton) {
  if (boton) { boton.disabled = true; boton.textContent = "Revisando…"; }
  est = await pedirEstado(enviar, { tipo: "acceso", forzar: true });
  pintarAviso();
  if (vencida()) {
    muro();
    const b = vista.querySelector(".muro .acciones:last-child button");
    if (b) { b.textContent = "Aún no está activo · revisar de nuevo"; }
  } else inicio();
}

function sinAcceso(texto) {
  fx("");
  limpiar(mensaje(texto || "No pudimos iniciar tu prueba gratis en este momento.", "err"),
    el("div", { class: "acciones" }, el("button", { class: "pri", texto: "Reintentar", onclick: e => revisar(e.currentTarget) })));
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
// Casilla de modo reservado, arriba de la ficha. Cambiarla repinta al instante (sin consultar).
function casillaReservado() {
  const c = el("input", { type: "checkbox", id: "reservado" });
  c.checked = reservado;
  c.addEventListener("change", () => {
    reservado = c.checked;
    chrome.storage.local.set({ reservado }).catch(() => {});
    if (fichaActual) repintar();
  });
  return el("label", { class: "reservado", title: "Oculta RUC, razón social y domicilio en pantalla y en lo que copias o compartes" },
    c, "Ocultar datos del contribuyente");
}

// Caja de compartir: 4 opciones + copiar/descargar la imagen. Avisa si sale con datos ocultos o completos.
function bloqueCompartir(x) {
  const estado = el("div", { class: "estado-compartir muted", role: "status", "aria-live": "polite" });
  const decir = (t, tipo = "") => { estado.className = "estado-compartir " + (tipo || "muted"); estado.textContent = t; };
  const conImagen = (fn, okTexto) => async e => {
    const b = e.currentTarget; b.disabled = true;
    try { await fn(); if (okTexto) decir(okTexto, "ok"); }
    catch (_) { decir("No pudimos preparar la imagen. Usa «Descargar PNG».", "err"); }
    finally { b.disabled = false; }
  };
  const op = opcionesCompartir(x);
  return el("section", { class: "compartir", "aria-label": "Compartir" },
    el("p", { class: "aviso-datos " + (reservado ? "oculto" : "completo"),
      texto: reservado ? "Se compartirá con datos ocultos" : "Se compartirá con datos completos" }),
    el("div", { class: "opciones" },
      el("button", { texto: "WhatsApp texto", onclick: () => abrir(enlaceWhatsapp(x, op)) }),
      el("button", { texto: "WhatsApp imagen", onclick: conImagen(async () => { await copiarImagen(x); abrirPestana("https://web.whatsapp.com/"); },
        "Imagen copiada, pégala en el chat.") }),
      el("button", { texto: "Correo texto", onclick: () => abrirCorreo(enlaceCorreo(x, op)) }),
      el("button", { texto: "Correo imagen", onclick: conImagen(async () => {
        await copiarImagen(x); abrirCorreo(`mailto:?subject=${encodeURIComponent(asuntoCorreo(x, reservado))}`); },
        "Imagen copiada, pégala en el correo.") })),
    el("div", { class: "acciones" },
      el("button", { texto: "Copiar imagen", onclick: conImagen(() => copiarImagen(x), "Imagen copiada, pégala en el chat.") }),
      el("button", { texto: "Descargar PNG", onclick: conImagen(() => descargarPng(x), "Imagen descargada.") })),
    estado);
}

function repintar() {                                // mismo RUC, misma posicion: sin consultar
  const arriba = vista.scrollTop;
  ficha(fichaActual.x, fichaActual.opciones);
  vista.scrollTop = arriba;
}

function ficha(x, { volver = null, invalidos = [] } = {}) {
  if (!fichaActual || fichaActual.x !== x) cajaCompartir = false;     // otro RUC: la caja empieza cerrada
  fichaActual = { x, opciones: { volver, invalidos } };
  const v = vistaFicha(x, reservado);
  fx(`RUC ${x.encontrado ? v.ruc : x.ruc}`);
  pintarDatosAl(x.datos_al || (lote && lote.datos_al), corteListas(x, lote ? lote.resultados : []));
  if (!x.encontrado) {
    return limpiar(volver, el("div", { class: "ficha" },
      el("div", { class: "celdas" }, el("div", { class: "et", texto: "RUC" }), el("div", { class: "va mono", texto: x.ruc })),
      mensaje(`El RUC ${x.ruc} es válido, pero no figura en nuestros datos: puede ser muy reciente o tener un dígito cambiado.`)),
      bloqueNoValidos(invalidos));
  }
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
  const share = cajaCompartir ? bloqueCompartir(x) : null;
  limpiar(volver,
    invalidos.length ? bloqueNoValidos(invalidos) : null,
    casillaReservado(),
    el("article", { class: "ficha" + (reservado ? " reservada" : "") },
      el("div", { class: "acciones" },
        el("button", { texto: "Copiar", title: "Copiar RUC y razón social", onclick: e => copiar(x, e.currentTarget) }),
        el("button", { texto: "Compartir", "aria-expanded": String(cajaCompartir), onclick: () => { cajaCompartir = !cajaCompartir; repintar(); } }),
        el("button", { texto: "Ver más en el Verificador ↗", onclick: () => verMas(x) })),
      share,
      el("div", { class: "celdas" },
        fila("RUC", v.ruc, "mono"),
        fila("Razón social", v.razon, "razon"),
        fila("Estado del contribuyente", chip(x.estado)),
        fila("Condición del domicilio", chip(x.condicion)),
        v.ubicacion ? fila("Ubicación", v.ubicacion) : [],
        v.domicilio ? fila("Domicilio fiscal", v.domicilio, reservado ? "oculto" : "") : [],
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
    if (res.codigo === "prueba_vencida") { est = await pedirEstado(enviar, { tipo: "acceso" }); pintarAviso(); return muro(); }
    if (res.codigo === "sin_acceso" || res.codigo === "acceso_invalido") return sinAcceso(res.texto);
    if (res.codigo === "reintentar") return limpiar(mensaje(res.texto),
      el("div", { class: "acciones" }, el("button", { class: "pri", texto: "Volver a intentar", onclick: () => consultar(rucs, invalidos) })));
    return limpiar(mensaje(res.texto, "err"),
      res.codigo === "cuota_agotada" ? el("p", { class: "muted", texto: "¿Necesitas más consultas? Escríbenos al WhatsApp 967317946." }) : null);
  }
  if (rucs.length === 1) { lote = null; ficha(res.resultados[0], { invalidos }); } else tabla(res, invalidos);
}

async function atender(p) {
  if (!p || p.t === ultimo) return;
  ultimo = p.t;
  await preferencias;
  const invalidos = p.invalidos || [];
  est = await pedirEstado(enviar, { tipo: "cuota" });
  pintarCuota(est.cuota);
  pintarAviso();
  if (!est.tieneAcceso) return sinAcceso(est.error && est.error.texto);
  if (vencida()) return muro();
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
    est = await pedirEstado(enviar, { tipo: "acceso", forzar: true });          // al abrirse: re-valida (no consume)
    pintarCuota(est.cuota);
    pintarAviso();
    if (!est.tieneAcceso) sinAcceso(est.error && est.error.texto);
    else if (vencida()) muro();
    else inicio();
  }
})();
