// Service worker: menu contextual, panel lateral, boton "Ver ficha" (opcional) y el UNICO que
// llama a la API. No lee paginas: el texto llega del clic del menu o, si la persona activo el
// boton, del RUC que ella selecciono y toco.
import { analizarTexto, motivoSinRuc, rucValido } from "./lib/ruc.js";
import * as api from "./lib/api.js";
import { normalizarLlave } from "./lib/llave.js";
import { origenes } from "./lib/sitios.js";

const MENU = "ficha-ruc";
const BOTON = "boton-ver-ficha";

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.create({ id: MENU, title: "Ficha RUC: «%s» · 1 consulta por RUC", contexts: ["selection"] });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  if (reason === "install") api.revalidar();          // la prueba gratis se pide sola, sin que la persona haga nada
});
chrome.runtime.onStartup.addListener(() => { api.revalidar(); });     // detecta si el Club ya activo el acceso

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

// --- Boton "Ver ficha" al seleccionar: permiso OPCIONAL, lo activa la persona ---------------------

async function registrarBoton(cfg) {
  const matches = origenes(cfg);
  const viejos = await chrome.scripting.getRegisteredContentScripts({ ids: [BOTON] });
  if (viejos.length) await chrome.scripting.unregisterContentScripts({ ids: [BOTON] });
  if (!cfg.activo || !matches.length) return { ok: true, activo: false };
  if (!(await chrome.permissions.contains({ origins: matches })))
    return { ok: false, activo: false, texto: "Chrome no dio el permiso para esos sitios." };
  await chrome.scripting.registerContentScripts([{ id: BOTON, js: ["src/boton.js"], matches, allFrames: true,
                                                  runAt: "document_idle", persistAcrossSessions: true }]);
  return { ok: true, activo: true, matches };
}

// Activacion desde el popup: Chrome puede cerrar el popup al mostrar su pregunta de permiso, y
// con el su codigo. El popup deja la peticion "pendiente"; al llegar el permiso, se termina aqui.
chrome.permissions.onAdded.addListener(async () => {
  const { boton_pendiente: p } = await chrome.storage.local.get("boton_pendiente");
  if (!p || Date.now() - p.t > 10 * 60 * 1000) return;
  const cfg = { activo: true, todos: !!p.todos, sitios: p.sitios || [] };
  const r = await registrarBoton(cfg);
  await chrome.storage.local.set({ boton: { ...cfg, activo: r.activo } });
  await chrome.storage.local.remove("boton_pendiente");
});

// Si la persona quita el permiso desde Chrome, el boton se apaga (y la configuracion lo refleja).
chrome.permissions.onRemoved.addListener(async () => {
  const { boton } = await chrome.storage.local.get("boton");
  if (boton && boton.activo && !(await chrome.permissions.contains({ origins: origenes(boton) }))) {
    await chrome.storage.local.set({ boton: { ...boton, activo: false } });
    await registrarBoton({ ...boton, activo: false });
  }
});

chrome.runtime.onMessage.addListener((m, sender, responder) => {
  if (sender.id !== chrome.runtime.id) return;
  const desdePagina = !(sender.url && sender.url.startsWith(chrome.runtime.getURL("")));
  if (desdePagina) {
    // Un sitio web (el script del boton) SOLO puede pedir abrir la ficha de un RUC valido.
    // No recibe nada de vuelta: ni la credencial, ni datos, ni acceso a la API.
    if (m && m.tipo === "ficha_desde_seleccion" && typeof m.ruc === "string" && rucValido(m.ruc) && sender.tab) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId });       // dentro del gesto: sin await antes
      pedir(m.ruc, "boton");
    }
    // Etiqueta "RUC mal escrito": el panel muestra el motivo (digito verificador). No consulta ni gasta.
    if (m && m.tipo === "ruc_mal_escrito" && typeof m.ruc === "string" && /^(10|15|17|20)\d{9}$/.test(m.ruc)
        && !rucValido(m.ruc) && sender.tab) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId });       // dentro del gesto: sin await antes
      pedir(m.ruc, "boton");
    }
    return;
  }
  (async () => {
    switch (m && m.tipo) {
      case "consultar": return api.consultar((m.rucs || []).filter(r => /^\d{11}$/.test(r)).slice(0, 500));
      case "costo": return api.costo(m.rucs || []);
      case "cuota": {
        const { boton } = await chrome.storage.local.get("boton");
        const est = await api.estadoAcceso();
        return { ...est, cuota: (await api.refrescarCuota()) || est.cuota, boton: !!(boton && boton.activo) };
      }
      case "acceso": return api.estadoAcceso({ forzar: !!m.forzar });      // al abrirse: re-valida (no consume)
      case "pegar": await pedir(m.texto || "", "pegado"); return { ok: true };
      case "guardar_llave": {
        const n = normalizarLlave(m.llave);
        if (!n.ok) return n;                        // motivo exacto (p. ej. pego solo el prefijo)
        const clave = n.llave;
        const v = await api.validar(clave);
        if (v.ok) await chrome.storage.local.set({ llave: clave });
        return v;                                   // nunca devuelve la llave
      }
      case "olvidar_llave":                          // la instalacion se conserva: no reinicia la prueba
        await chrome.storage.local.remove(["llave", "cuota", "acceso", "codigo"]);
        await chrome.storage.session.clear();
        return { ok: true };
      case "boton_estado": {
        const { boton } = await chrome.storage.local.get("boton");
        const cfg = boton || { activo: false, todos: true, sitios: [] };
        const reg = await chrome.scripting.getRegisteredContentScripts({ ids: [BOTON] });
        return { ...cfg, activo: !!(cfg.activo && reg.length), origenes: origenes(cfg) };
      }
      case "boton_guardar": {                        // el permiso ya lo pidio la pagina de opciones
        const cfg = { activo: !!m.activo, todos: !!m.todos, sitios: (m.sitios || []).slice(0, 50) };
        const r = await registrarBoton(cfg);
        await chrome.storage.local.set({ boton: { ...cfg, activo: r.activo } });
        if (!cfg.activo) {                           // al apagarlo se devuelve el permiso
          const sobra = origenes({ ...cfg, todos: cfg.todos }).filter(o => !chrome.runtime.getManifest().host_permissions.includes(o));
          if (sobra.length) await chrome.permissions.remove({ origins: sobra }).catch(() => {});
        }
        return r;
      }
      default: return { ok: false, texto: "Pedido desconocido." };
    }
  })().then(responder, e => responder({ ok: false, texto: "Algo falló: " + (e && e.message) }));
  return true;                                      // respuesta asincrona
});
