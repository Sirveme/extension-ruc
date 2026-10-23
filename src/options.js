import { origenes } from "./lib/sitios.js";
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

async function estado() {
  const e = await enviar({ tipo: "estado_llave" });
  $("estado").textContent = e.tieneLlave ? `Llave guardada: ${e.prefijo}…${cuotaTxt(e.cuota)}` : "Aún no configuras tu llave.";
  $("olvidar").hidden = !e.tieneLlave;
}

$("guardar").addEventListener("click", async () => {
  const llave = $("llave").value.trim();
  if (!llave) return aviso("Pega tu llave primero.", "err");
  $("guardar").disabled = true;
  aviso("Validando…");
  const r = await enviar({ tipo: "guardar_llave", llave });
  $("guardar").disabled = false;
  if (!r.ok) return aviso(r.texto, "err");
  $("llave").value = "";
  aviso(`Llave válida · plan ${r.plan}${cuotaTxt(r.cuota)}. Ya puedes seleccionar un RUC en cualquier página.`, "ok");
  estado();
});
$("mostrar").addEventListener("click", () => {
  const i = $("llave");
  i.type = i.type === "password" ? "text" : "password";
  $("mostrar").textContent = i.type === "password" ? "Mostrar" : "Ocultar";
});
$("olvidar").addEventListener("click", async () => {
  await enviar({ tipo: "olvidar_llave" });
  aviso("Listo: borramos tu llave y lo consultado de este equipo.", "ok");
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
