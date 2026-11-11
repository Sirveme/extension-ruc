import { analizarTexto, motivoSinRuc, textoInvalido } from "./lib/ruc.js";
import { origenes } from "./lib/sitios.js";
import { textoDias } from "./lib/acceso.js";

const $ = id => document.getElementById(id);
const enviar = m => chrome.runtime.sendMessage(m);
let ventana = null;
let boton = { activo: false, todos: true, sitios: [] };     // config del boton "Ver ficha" (sitios: avanzado, en Configuracion)
$("ver").disabled = true;                                    // hasta saber la ventana: el panel se abre en el gesto
chrome.windows.getCurrent().then(w => { ventana = w.id; $("ver").disabled = false; });

const etiqueta = t => Object.assign(document.createElement("span"), { className: "etiqueta-err", textContent: t });

function pintarBoton() {
  $("bToggle").checked = boton.activo;
  $("bTxt").textContent = boton.activo
    ? (boton.todos ? "Activado en todos los sitios web." : `Activado en: ${boton.sitios.join(", ")}.`)
    : "Desactivado. Un clic sobre cualquier RUC que selecciones.";
}

(async () => {
  const [est, b] = await Promise.all([enviar({ tipo: "cuota" }), enviar({ tipo: "boton_estado" })]);
  boton = b;
  pintarBoton();
  pintarAviso(est);
  if (est.cuota && est.cuota.restante !== null) $("cuota").textContent = `${est.cuota.restante} de ${est.cuota.limite} consultas este mes`;
  $("texto").focus();
})();

// Prueba gratis: una linea discreta; al vencer, el muro con los dos caminos. Sin hablar de llaves.
function pintarAviso(est) {
  const a = est.acceso, e = est.enlaces || {};
  const link = (t, url) => Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noopener", textContent: t });
  const caja = $("aviso");
  if (!est.tieneAcceso) {
    caja.hidden = false; caja.className = "msg err";
    caja.replaceChildren((est.error && est.error.texto) || "No pudimos iniciar tu prueba gratis. Intenta más tarde.");
  } else if (a && a.tipo === "vencida") {
    caja.hidden = false; caja.className = "msg err";
    caja.replaceChildren(Object.assign(document.createElement("b"), { textContent: "Tu prueba terminó." }),
      " Únete al Club de Contadores: es gratis. ", link("Únete por WhatsApp", e.whatsapp), " · ", link("Regístrate aquí", e.registro));
  } else if (a && a.tipo === "prueba") {
    caja.hidden = false; caja.className = "msg";
    caja.replaceChildren(`Prueba gratis · ${textoDias(a.dias_restantes)}. Únete al Club para seguir usándola. `,
      link("Únete por WhatsApp", e.whatsapp), " · ", link("Regístrate", e.registro));
  } else caja.hidden = true;
}

$("ver").addEventListener("click", () => {
  const texto = $("texto").value;
  const { rucs, invalidos } = analizarTexto(texto);
  // Cada RUC errado, con su etiqueta roja AQUI mismo (se pidio a proposito: no se calla).
  const lineas = invalidos.slice(0, 8).map(textoInvalido);
  if (invalidos.length > 8) lineas.push(`…y ${invalidos.length - 8} más (los verás en el panel).`);
  if (!rucs.length && !invalidos.length)
    lineas.push(motivoSinRuc(texto) === "dni" ? "Por ahora la ficha es solo por RUC (11 dígitos)." : "No encontramos ningún RUC en lo que pegaste.");
  $("r").replaceChildren(...lineas.map(etiqueta));
  if (!rucs.length) return;
  chrome.sidePanel.open({ windowId: ventana });            // dentro del gesto, sin await antes
  // Con RUC errados el popup se queda abierto mostrando sus etiquetas (el panel los lista tambien).
  enviar({ tipo: "pegar", texto }).then(() => { if (!invalidos.length) window.close(); });
});

// Interruptor del boton "Ver ficha". Apagado por defecto; al encenderlo Chrome pide el permiso de
// sitios AHORA (dentro del clic). El popup puede cerrarse cuando Chrome muestra su pregunta: por eso
// se deja la peticion "pendiente" y el service worker termina de activarlo al recibir el permiso.
$("bToggle").addEventListener("change", e => {
  if (e.target.checked) {
    const cfg = { todos: boton.todos !== false, sitios: boton.sitios || [] };
    const origins = origenes(cfg);
    chrome.storage.local.set({ boton_pendiente: { ...cfg, t: Date.now() } });
    chrome.permissions.request({ origins }).then(async dado => {
      if (!dado) {
        await chrome.storage.local.remove("boton_pendiente");
        e.target.checked = false;
        $("bTxt").textContent = "No diste el permiso: sigue desactivado. El clic derecho funciona igual.";
        return;
      }
      boton = { ...cfg, ...(await enviar({ tipo: "boton_guardar", activo: true, ...cfg })), todos: cfg.todos, sitios: cfg.sitios };
      await chrome.storage.local.remove("boton_pendiente");
      pintarBoton();
      if (boton.activo) $("bTxt").textContent += " Recarga la página donde estés.";
    });
  } else {
    enviar({ tipo: "boton_guardar", activo: false, todos: boton.todos, sitios: boton.sitios }).then(() => {
      boton = { ...boton, activo: false };
      pintarBoton();
      $("bTxt").textContent = "Desactivado: devolvimos el permiso de los sitios.";
    });
  }
});
