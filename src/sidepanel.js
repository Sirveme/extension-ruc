// Panel lateral: ficha de un RUC o tabla de varios. Todo dato de la API se pinta con
// textContent (nunca como HTML).
import { fecha, soles } from "./lib/ruc.js";

const vista = document.getElementById("vista");
const pieCuota = document.getElementById("cuota");
let ultimo = 0;                       // pedido mostrado (para no repetirlo)
let lote = null;                      // ultimo resultado de varios RUC (volver de la ficha a la tabla)

const enviar = m => chrome.runtime.sendMessage(m);
function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k === "texto") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h !== null && h !== undefined && h !== false) e.append(h);
  return e;
}
const limpiar = (...n) => { vista.replaceChildren(...n.flat().filter(x => x !== null && x !== undefined && x !== false)); };
const mensaje = (texto, tipo = "") => el("div", { class: "msg " + tipo, texto });

function pintarCuota(c) {
  if (!c || c.restante === null || c.restante === undefined) { pieCuota.textContent = ""; return; }
  pieCuota.textContent = `${c.restante} de ${c.limite} consultas este mes`;
}

function sinLlave() {
  limpiar(el("div", { class: "vacio" }, el("b", { texto: "Configura tu llave" }),
    "Para ver la ficha necesitas tu llave gratuita. Pégala una vez en Configuración y queda guardada en este equipo."),
    el("button", { class: "pri", texto: "Ir a Configuración", onclick: () => chrome.runtime.openOptionsPage() }),
    el("p", { class: "muted", texto: "¿Aún no tienes llave? Escríbenos al WhatsApp 967317946." }));
}

function inicio() {
  limpiar(el("div", { class: "vacio" }, el("b", { texto: "Selecciona un RUC" }),
    "En cualquier página, selecciona un RUC (o un texto con varios), clic derecho y elige «Ficha RUC». ",
    "También puedes pegarlos desde el ícono de la extensión."));
}

// --- Riesgo de un resultado ------------------------------------------------------------
function riesgos(x) {
  if (!x || !x.encontrado) return [];
  const r = [];
  if (x.marcas && x.marcas.ssco) r.push("Sin capacidad operativa");
  if (x.condicion && x.condicion.semaforo === "rojo") r.push(x.condicion.nombre || "No habido");
  if (x.estado && x.estado.semaforo === "rojo") r.push(x.estado.nombre || "No activo");
  for (const p of x.listas || []) if (p.tipo === "riesgo") r.push(p.nombre);
  return r;
}

// --- Ficha -------------------------------------------------------------------------------
function ficha(x, volver) {
  if (!x.encontrado) {
    return limpiar(volver, el("div", { class: "ficha" },
      el("div", { class: "ruc mono", texto: x.ruc }),
      mensaje("Ese RUC no figura en nuestros datos. Revisa los dígitos.")));
  }
  const copiar = el("button", { class: "sec", texto: "Copiar", onclick: async () => {
    await navigator.clipboard.writeText(x.ruc); copiar.textContent = "Copiado"; setTimeout(() => (copiar.textContent = "Copiar"), 1500);
  } });
  const lugar = [x.distrito, x.provincia, x.departamento].filter(Boolean).map(t => t.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase())).join(" · ");
  const alertas = [];
  const s = x.marcas && x.marcas.ssco;
  if (s) alertas.push(el("div", { class: "alerta" }, el("b", { texto: "Sin capacidad operativa" }),
    el("small", { texto: [s.firme && `Firme desde ${fecha(s.firme)}`, s.resolucion].filter(Boolean).join(" · ") })));
  if (x.condicion && x.condicion.semaforo === "rojo")
    alertas.push(el("div", { class: "alerta" }, el("b", { texto: `Domicilio: ${x.condicion.nombre}` })));
  const infos = [];
  for (const p of x.listas || []) {
    const det = [p.desde && `Desde ${fecha(p.desde)}`, p.monto_deuda && soles(p.monto_deuda), p.resolucion, p.servicio,
                 p.historico && "Lista antigua: no describe la situación actual"].filter(Boolean).join(" · ");
    (p.tipo === "riesgo" ? alertas : infos).push(el("div", { class: p.tipo === "riesgo" ? "alerta" : "info" },
      el("b", { texto: p.nombre }), det ? el("small", { texto: det }) : null));
  }
  if (x.marcas && x.marcas.contador) infos.push(el("div", { class: "info" }, el("b", { texto: "Contador o estudio contable" })));
  if (x.marcas && x.marcas.negocio_nuevo) infos.push(el("div", { class: "info" }, el("b", { texto: "Negocio nuevo" }),
    el("small", { texto: `Inscrito el ${fecha(x.marcas.negocio_nuevo.inscrito)}` })));
  limpiar(volver, el("article", { class: "ficha" },
    el("div", { class: "ruc" }, el("span", { class: "mono", texto: x.ruc }), copiar),
    el("h1", { texto: x.razon_social || "" }),
    el("div", { class: "chips" },
      el("span", { class: "chip " + (x.estado.semaforo || ""), texto: x.estado.nombre || "" }),
      el("span", { class: "chip " + (x.condicion.semaforo || ""), texto: x.condicion.nombre || "" })),
    lugar ? el("div", { class: "lugar", texto: lugar }) : null,
    x.domicilio ? el("div", { class: "muted", texto: x.domicilio }) : null,
    alertas, infos,
    el("div", { class: "muted", texto: `Locales anexos: ${(x.anexos && x.anexos.total) || 0}` }),
    el("div", { class: "datos-al", texto: x.datos_al ? `Datos al ${fecha(x.datos_al)}` : "" })));
}

// --- Tabla -------------------------------------------------------------------------------
function tabla(res) {
  lote = res;
  const filas = res.resultados.filter(Boolean);
  const soloRiesgo = el("input", { type: "checkbox" });
  const cuerpo = el("tbody");
  const pintar = () => {
    const ver = filas.filter(x => !soloRiesgo.checked || riesgos(x).length);
    cuerpo.replaceChildren(...ver.map(x => el("tr", { class: "fila", tabindex: "0", title: "Ver ficha",
      onclick: () => abrirDesdeTabla(x), onkeydown: e => e.key === "Enter" && abrirDesdeTabla(x) },
      el("td", { class: "mono", texto: x.ruc }),
      el("td", { texto: x.encontrado ? x.razon_social : "No figura" }),
      el("td", { texto: x.encontrado ? `${x.estado.nombre} · ${x.condicion.nombre}` : "" }),
      el("td", { class: "riesgo", texto: riesgos(x).length ? "⚠ " + riesgos(x).join(", ") : "" }))));
    if (!ver.length) cuerpo.replaceChildren(el("tr", {}, el("td", { colspan: "4", class: "vacio", texto: "Ninguno con riesgo." })));
  };
  soloRiesgo.addEventListener("change", pintar);
  const conRiesgo = filas.filter(x => riesgos(x).length).length;
  limpiar(
    el("div", { class: "barra" },
      el("b", { texto: `${filas.length} RUC` }), el("span", { class: "muted", texto: conRiesgo ? `· ${conRiesgo} con riesgo` : "· ninguno con riesgo" }),
      el("span", { class: "sp" }),
      el("label", {}, soloRiesgo, "Solo con riesgo")),
    el("div", { class: "barra" },
      el("button", { class: "sec", texto: "Copiar tabla", onclick: e => copiarTabla(filas, e.target) }),
      el("button", { class: "sec", texto: "Descargar CSV", onclick: () => descargarCsv(filas) })),
    el("table", { class: "tabla" }, el("thead", {}, el("tr", {}, ...["RUC", "Razón social", "Estado", "Riesgo"].map(t => el("th", { texto: t })))), cuerpo),
    el("div", { class: "datos-al", texto: res.datos_al ? `Datos al ${fecha(res.datos_al)}` : "" }));
  pintar();
}

function abrirDesdeTabla(x) {
  const volver = el("button", { class: "sec", texto: "← Volver a la tabla", onclick: () => tabla(lote) });
  ficha(x, volver);
}

const filasPlanas = filas => [["RUC", "Razón social", "Estado", "Condición", "Distrito", "Provincia", "Departamento", "Riesgo", "Listas"],
  ...filas.map(x => x.encontrado
    ? [x.ruc, x.razon_social, x.estado.nombre, x.condicion.nombre, x.distrito || "", x.provincia || "", x.departamento || "",
       riesgos(x).join("; "), (x.listas || []).map(p => p.nombre).join("; ")]
    : [x.ruc, "No figura", "", "", "", "", "", "", ""])];

async function copiarTabla(filas, boton) {
  await navigator.clipboard.writeText(filasPlanas(filas).map(f => f.join("\t")).join("\n"));
  boton.textContent = "Copiada"; setTimeout(() => (boton.textContent = "Copiar tabla"), 1500);
}

function descargarCsv(filas) {
  const csv = "﻿" + filasPlanas(filas).map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = el("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: "ficha-ruc.csv" });
  document.body.append(a); a.click(); a.remove();
}

// --- Pedido -> confirmar costo -> consultar -> mostrar ----------------------------------
async function consultar(rucs) {
  limpiar(el("div", { class: "vacio", texto: rucs.length > 1 ? `Consultando ${rucs.length} RUC…` : "Consultando…" }));
  const res = await enviar({ tipo: "consultar", rucs });
  pintarCuota(res.cuota);
  if (!res.ok) {
    if (res.codigo === "sin_llave") return sinLlave();
    if (res.codigo === "llave_invalida") return limpiar(mensaje(res.texto, "err"),
      el("button", { class: "pri", texto: "Revisar mi llave", onclick: () => chrome.runtime.openOptionsPage() }));
    return limpiar(mensaje(res.texto, "err"),
      res.codigo === "cuota_agotada" ? el("p", { class: "muted", texto: "¿Necesitas más consultas? Escríbenos al WhatsApp 967317946." }) : null);
  }
  if (rucs.length === 1) ficha(res.resultados[0], null); else tabla(res);
}

async function atender(p) {
  if (!p || p.t === ultimo) return;
  ultimo = p.t;
  const est = await enviar({ tipo: "cuota" });
  pintarCuota(est.cuota);
  if (!est.tieneLlave) return sinLlave();
  if (!p.rucs.length) {
    const t = { dni: "Por ahora la ficha es solo por RUC (11 dígitos). Ese número parece un DNI.",
                digito: "Ese número no es un RUC válido: revisa los dígitos.",
                nada: "No encontramos un RUC válido en lo que seleccionaste." }[p.motivo || "nada"];
    return limpiar(mensaje(t), el("p", { class: "muted", texto: "Selecciona un RUC de 11 dígitos y vuelve a intentar." }));
  }
  const c = await enviar({ tipo: "costo", rucs: p.rucs });
  const restante = c.cuota && c.cuota.restante !== null ? c.cuota.restante : null;
  // Un solo RUC: el menu ya dice que usa 1 consulta. Varios: se confirma el costo antes.
  if (p.rucs.length === 1 || c.nuevos === 0) return consultar(p.rucs);
  const alcanza = restante === null || c.nuevos <= restante;
  limpiar(el("div", { class: "vacio" }, el("b", { texto: `Encontramos ${p.rucs.length} RUC` }),
      c.nuevos < p.rucs.length ? `${p.rucs.length - c.nuevos} ya los consultaste hoy (no cuestan). ` : ""),
    alcanza
      ? el("div", { class: "barra" }, el("button", { class: "pri", texto: `Ver datos · ${c.nuevos} consulta${c.nuevos === 1 ? "" : "s"}`,
          onclick: () => consultar(p.rucs) }),
          restante !== null ? el("span", { class: "muted", texto: `te quedan ${restante} este mes` }) : null)
      : el("div", {}, mensaje(`Ver datos de todos usaría ${c.nuevos} consultas y te quedan ${restante} este mes.`),
          restante > 0 ? el("button", { class: "pri", texto: `Consultar los primeros ${restante}`,
            onclick: () => consultar(p.rucs.slice(0, restante)) }) : null));
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
