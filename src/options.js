import { origenes } from "./lib/sitios.js";
import { textoDias, pedirEstado } from "./lib/acceso.js";
const $ = id => document.getElementById(id);
const enviar = m => chrome.runtime.sendMessage(m);
function aviso(texto, tipo) {
  const d = document.createElement("div");
  d.className = "msg " + (tipo || "");
  d.textContent = texto;
  $("r").replaceChildren(d);
}
function cuotaTxt(c) {
  return c && c.restante !== null && c.restante !== undefined ? ` · ${c.restante} de ${c.limite} consultas este mes` : "";
}

let enlaces = {};
async function estado(forzar = true) {
  const e = await pedirEstado(enviar, { tipo: "acceso", forzar });
  const a = e.acceso || {};
  enlaces = e.enlaces || {};
  $("estado").className = a.tipo === "vencida" ? "" : a.tipo === "permanente" ? "activo" : "muted";
  $("estado").textContent = !e.tieneAcceso ? ((e.error && e.error.texto) || "Preparando tu prueba gratis…")
    : a.tipo === "permanente" ? `Acceso del Club activo${cuotaTxt(e.cuota)}.`
    : a.tipo === "vencida" ? "Tu prueba terminó. Únete al Club de Contadores: es gratis."
    : `Prueba gratis · ${textoDias(a.dias_restantes)}${cuotaTxt(e.cuota)}. Únete al Club para seguir usándola.`;
  $("unete").hidden = !e.tieneAcceso || a.tipo === "permanente";
  $("bReg").hidden = !e.registroAbierto;                // solo con el registro del Club abierto
  $("codigoTxt").hidden = !e.codigo || a.tipo === "permanente";
  $("codigoTxt").textContent = e.codigo ? `Tu código: ${e.codigo} (va en el mensaje de WhatsApp). Cuando activemos tu acceso, la extensión lo detecta sola.` : "";
}
const abrir = url => url && window.open(url, "_blank", "noopener");
$("bWa").addEventListener("click", () => abrir(enlaces.whatsapp));
$("bReg").addEventListener("click", () => abrir(enlaces.registro));
$("bRevisar").addEventListener("click", async () => { aviso("Revisando…"); await estado(true); $("r").replaceChildren(); });

$("guardar").addEventListener("click", async () => {
  const llave = $("llave").value.trim();
  if (!llave) return aviso("Pega tu código de acceso primero.", "err");
  $("guardar").disabled = true;
  aviso("Validando…");
  const r = await enviar({ tipo: "guardar_llave", llave });
  $("guardar").disabled = false;
  if (!r.ok) return aviso(r.texto, "err");
  $("llave").value = "";
  aviso(`Acceso válido${cuotaTxt(r.cuota)}. Ya puedes seleccionar un RUC en cualquier página.`, "ok");
  estado();
});
$("mostrar").addEventListener("click", () => {
  const i = $("llave");
  i.type = i.type === "password" ? "text" : "password";
  $("mostrar").textContent = i.type === "password" ? "Mostrar" : "Ocultar";
});
$("olvidar").addEventListener("click", async () => {
  await enviar({ tipo: "olvidar_llave" });
  aviso("Listo: borramos tu acceso y lo consultado de este equipo.", "ok");
  estado();
});
estado();

// --- Boton "Ver ficha" al seleccionar (permiso opcional) ---------------------------------------
const cfgDePantalla = () => ({ todos: document.querySelector("input[name=donde]:checked").value === "todos",
                               sitios: $("sitios").value.split(/[\s,;]+/).filter(Boolean) });
function avisoBoton(texto, tipo) {
  const d = document.createElement("div");
  d.className = "msg " + (tipo || ""); d.textContent = texto;
  $("rBoton").replaceChildren(d);
}
async function estadoBoton() {
  const e = await enviar({ tipo: "boton_estado" });
  document.querySelector(`input[name=donde][value=${e.todos ? "todos" : "sitios"}]`).checked = true;
  if (e.sitios && e.sitios.length && !$("sitios").value) $("sitios").value = e.sitios.join("\n");
  $("bEstado").textContent = e.activo ? (e.todos ? "Activado en todos los sitios web." : `Activado en: ${e.sitios.join(", ")}.`) : "Desactivado.";
  $("bEstado").className = e.activo ? "activo" : "muted";
  $("bApagar").hidden = !e.activo;
  $("bActivar").textContent = e.activo ? "Guardar cambios" : "Activar";
}
$("bActivar").addEventListener("click", () => {
  const cfg = cfgDePantalla();
  const origins = origenes(cfg);
  if (!origins.length) return avisoBoton("Escribe al menos un sitio (por ejemplo mail.google.com) o elige «En todos los sitios web».", "err");
  // El permiso se pide AQUI, dentro del clic (Chrome lo exige); luego el service worker registra el boton.
  chrome.permissions.request({ origins }).then(async dado => {
    if (!dado) return avisoBoton("No diste el permiso: el botón sigue desactivado. El menú del clic derecho funciona igual.", "err");
    const r = await enviar({ tipo: "boton_guardar", activo: true, ...cfg });
    avisoBoton(r.ok ? "Listo: selecciona un RUC en una página (recárgala si ya estaba abierta) y aparece «Ver ficha»." : r.texto, r.ok ? "ok" : "err");
    estadoBoton();
  });
});
$("bApagar").addEventListener("click", async () => {
  await enviar({ tipo: "boton_guardar", activo: false, ...cfgDePantalla() });
  avisoBoton("Desactivado: devolvimos el permiso de los sitios.", "ok");
  estadoBoton();
});
estadoBoton();
