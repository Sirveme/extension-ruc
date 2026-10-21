// Service worker: menu contextual, panel lateral y el UNICO que llama a la API.
// No lee paginas: el texto seleccionado lo entrega Chrome en el clic del menu.
import { analizarTexto, motivoSinRuc } from "./lib/ruc.js";
import * as api from "./lib/api.js";
import { normalizarLlave } from "./lib/llave.js";

const MENU = "ficha-ruc";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU, title: "Ficha RUC: «%s» · 1 consulta por RUC", contexts: ["selection"] });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

// Lo que el panel debe mostrar: un "pedido" en storage.session (el panel lo escucha).
async function pedir(texto, origen) {
  const { rucs, invalidos } = analizarTexto(texto);       // los rechazados tambien: se muestran, no se omiten
  await chrome.storage.session.set({ pedido: { rucs, invalidos, origen,
    motivo: rucs.length || invalidos.length ? null : motivoSinRuc(texto), t: Date.now() } });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU) return;
  // Primero abrir el panel: Chrome solo lo permite dentro del gesto del usuario (sin await antes).
  chrome.sidePanel.open({ windowId: tab.windowId });
  pedir(info.selectionText || "", "seleccion");
});

// Mensajes de las paginas de la propia extension (panel, popup, opciones). Nunca de sitios web.
chrome.runtime.onMessage.addListener((m, sender, responder) => {
  if (sender.id !== chrome.runtime.id || (sender.url && !sender.url.startsWith(chrome.runtime.getURL("")))) return;
  (async () => {
    switch (m && m.tipo) {
      case "consultar": return api.consultar((m.rucs || []).filter(r => /^\d{11}$/.test(r)).slice(0, 500));
      case "costo": return api.costo(m.rucs || []);
      case "cuota": return { cuota: await api.refrescarCuota(), tieneLlave: !!(await api.llave()) };
      case "pegar": await pedir(m.texto || "", "pegado"); return { ok: true };
      case "guardar_llave": {
        const n = normalizarLlave(m.llave);
        if (!n.ok) return n;                        // motivo exacto (p. ej. pegó solo el prefijo)
        const clave = n.llave;
        const v = await api.validar(clave);
        if (v.ok) await chrome.storage.local.set({ llave: clave });
        return v;                                   // nunca devuelve la llave
      }
      case "olvidar_llave":
        await chrome.storage.local.remove(["llave", "cuota"]);
        await chrome.storage.session.clear();
        return { ok: true };
      case "estado_llave": {
        const clave = await api.llave();
        return { tieneLlave: !!clave, prefijo: clave ? clave.slice(0, 17) : null, cuota: await api.cuotaActual() };
      }
      default: return { ok: false, texto: "Pedido desconocido." };
    }
  })().then(responder, e => responder({ ok: false, texto: "Algo falló: " + (e && e.message) }));
  return true;                                      // respuesta asincrona
});
