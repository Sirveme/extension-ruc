// Boton flotante "Ver ficha" junto a una seleccion que ES un RUC valido; al tocarlo, tarjetita con la
// vista rapida (estado, condicion, alerta principal) y «Ver +» para la ficha completa en el panel. Si la seleccion parece un
// RUC (11 digitos que empiezan con 10, 15, 17 o 20) pero no cumple el digito verificador, en su lugar
// sale la etiqueta roja "RUC mal escrito": al tocarla, el panel dice el motivo (no consulta nada).
// Script de contenido: SOLO se registra si la persona lo activa en Configuracion (permiso
// opcional por sitio o en todos). Privacidad: no recorre la pagina; solo mira el texto que la
// persona selecciona, localmente, y no envia nada hasta que hace clic (envia SOLO ese RUC).
//
// Limite conocido de Chrome: en el visor de PDF nativo las extensiones no pueden leer la
// seleccion ni mostrar nada encima (es una caja negra por diseno). Ahi no aparece el boton: para
// PDF queda el cuadro "pega RUC" del icono de la extension. No se intenta leer el visor.
(() => {
  if (window.__fichaRucBoton) return;              // una sola vez por documento
  window.__fichaRucBoton = true;

  const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];    // mismo algoritmo que lib/ruc.js (modulo 11)
  function rucValido(r) {
    if (!/^(10|15|17|20)\d{9}$/.test(r)) return false;
    let s = 0;
    for (let i = 0; i < 10; i++) s += Number(r[i]) * PESOS[i];
    const d = 11 - (s % 11);
    return (d === 10 ? 0 : d === 11 ? 1 : d) === Number(r[10]);
  }
  // La seleccion debe SER un RUC: un solo numero de 11 digitos, como mucho con "RUC", ":" o
  // signos alrededor. Un parrafo con un RUC dentro no muestra el boton (para eso, el menu).
  function rucDe(texto) {
    const t = String(texto || "").replace(/[   ]/g, " ").trim();
    if (!t || t.length > 40) return null;
    const nums = t.match(/\d+/g) || [];
    if (nums.length !== 1 || nums[0].length !== 11) return null;
    if (/[a-z]/i.test(t.replace(/\bruc\b/i, "").replace(/n[°º.]?/i, ""))) return null;
    if (rucValido(nums[0])) return { ruc: nums[0], valido: true };
    // Parece un RUC (prefijo correcto) pero el digito no cuadra: "mal escrito". Otros 11 digitos
    // (p. ej. un telefono con 51 delante) no son RUC: no se muestra nada.
    return /^(10|15|17|20)/.test(nums[0]) ? { ruc: nums[0], valido: false } : null;
  }

  // --- Boton -> tarjetita con la vista rapida ------------------------------------------------------
  // «Ver ficha» no consulta nada. Al tocarlo consulta ESE RUC (1 consulta, como el menu) y se expande
  // ahi mismo: ● Activo · ● Habido · Ver +, y la alerta principal si la hay. «Ver +» abre el panel con
  // la ficha completa (ya en cache: no se cobra otra vez). Todo dato se pinta con textContent.
  const CSS = `<style>
    :host { all: initial; }
    .b { all: initial; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      font: 600 12px/1 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; color: #1a110a; background: #e8a04a;
      border: 1px solid #f0b56a; border-radius: 3px; padding: 6px 10px; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
    .b:hover { background: #f0b56a; } .b:focus-visible { outline: 2px solid #f3eadf; outline-offset: 1px; }
    svg { width: 12px; height: 12px; }
    .b.mal { background: #e5534b; border-color: #f07a72; color: #1a110a; } .b.mal:hover { background: #f07a72; }
    .t { box-sizing: border-box; min-width: 230px; max-width: 320px; display: grid; gap: 6px; padding: 9px 10px;
      font: 500 12.5px/1.35 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; color: #f3eadf;
      background: linear-gradient(135deg, #261d15, #1e1711); border: 1px solid #3d3024; border-left: 3px solid #e8a04a;
      border-radius: 4px; box-shadow: 0 10px 28px rgba(0,0,0,.45); }
    .fila { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .sem { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; white-space: nowrap; }
    .sem i { width: 9px; height: 9px; border-radius: 50%; background: #8b949e; display: inline-block; }
    .verde i { background: #4fbf7a; } .amarillo i, .ambar i { background: #e3b341; } .rojo i { background: #e5534b; }
    .rojo { color: #f08a83; }
    .sep { color: #75644f; }
    .sp { flex: 1; }
    .razon { color: #ad9a84; font-size: 11.5px; overflow-wrap: anywhere; }
    .alerta { color: #f08a83; background: #2e1914; border-left: 3px solid #e5534b; padding: 4px 7px; font-weight: 600; }
    .muted { color: #ad9a84; }
    .mas { all: initial; box-sizing: border-box; cursor: pointer; font: 700 12px/1 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
      color: #1a110a; background: #e8a04a; border-radius: 3px; padding: 5px 9px; }
    .mas:hover { background: #f0b56a; } .mas:focus-visible { outline: 2px solid #f3eadf; outline-offset: 1px; }
    .t.aviso { border-left-color: #e3b341; color: #f0c96a; background: linear-gradient(135deg, #2b2213, #1e1711); font-weight: 600; }
  </style>`;

  let host = null, raiz = null, reloj = null, rucActual = null, validoActual = true, fijo = false, rectActual = null;
  const quitar = () => {
    if (reloj) clearTimeout(reloj);
    reloj = null; rucActual = null; fijo = false;
    if (host) { host.remove(); host = null; raiz = null; }
  };
  const temporizar = ms => { if (reloj) clearTimeout(reloj); reloj = setTimeout(quitar, ms); };
  const nodo = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto) e.textContent = texto; return e; };
  const sinRobarSeleccion = e => e.preventDefault();               // tocar la tarjeta no deshace la seleccion

  // --- Contexto invalidado -----------------------------------------------------------------------
  // Si la extension se actualizo o se recargo con la pagina abierta, este script queda huerfano:
  // chrome.runtime.id desaparece y sendMessage lanza error. No se lanza nada: se avisa en ambar y se
  // quitan los listeners de este script viejo para que no vuelva a aparecer (la pagina recargada
  // trae el script nuevo).
  const AVISO_VIEJO = "Ficha RUC se actualizó · recarga la página (F5)";
  const vivo = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  class Caducado extends Error {}
  const caducado = e => e instanceof Caducado || /context invalidated|extension context/i.test(String((e && e.message) || e || ""));
  function enviar(mensaje) {
    if (!vivo()) return Promise.reject(new Caducado());
    try { return Promise.resolve(chrome.runtime.sendMessage(mensaje)); }      // puede invalidarse justo ahora
    catch (e) { return Promise.reject(caducado(e) ? new Caducado() : e); }
  }
  let apagado = false;
  function apagar() {                                                // quita los listeners del script viejo
    if (apagado) return;
    apagado = true;
    clearTimeout(espera);
    document.removeEventListener("selectionchange", revisar);
    document.removeEventListener("mousedown", alPresionar, true);
    document.removeEventListener("keydown", alTecla, true);
    window.removeEventListener("blur", quitar);
  }
  function avisarViejo(rect) {
    apagar();
    if (!host) {                                                     // la tarjetita ya se habia quitado: se vuelve a poner
      host = document.createElement("ficha-ruc-boton");
      host.style.cssText = "all: initial; position: absolute; z-index: 2147483647;";
      raiz = host.attachShadow({ mode: "closed" });
      raiz.innerHTML = CSS;
      (document.body || document.documentElement).append(host);
    }
    fijo = true;
    const t = nodo("div", "t aviso", AVISO_VIEJO); t.setAttribute("role", "alert");
    t.addEventListener("mousedown", sinRobarSeleccion);
    t.addEventListener("click", quitar);
    pintar(t);
    if (rect) ubicar(rect, 300);
    temporizar(10000);
    // se cierra con un clic fuera o Escape, una sola vez: no queda ningun listener puesto
    const cerrar = e => { if (e.type === "keydown" && e.key !== "Escape") return; quitar(); fin(); };
    const fin = () => { document.removeEventListener("mousedown", cerrar, true); document.removeEventListener("keydown", cerrar, true); };
    setTimeout(() => { document.addEventListener("mousedown", cerrar, true); document.addEventListener("keydown", cerrar, true); }, 0);
    setTimeout(fin, 10500);
  }
  // Envia y, si el contexto ya no existe, muestra el aviso. Devuelve la respuesta o undefined.
  async function enviarOAvisar(mensaje, rect) {
    try { return { r: await enviar(mensaje) }; }
    catch (e) { if (caducado(e)) { avisarViejo(rect); return null; } throw e; }
  }

  function ubicar(rect, ancho) {
    const x = Math.min(rect.right + window.scrollX - 4, window.scrollX + document.documentElement.clientWidth - ancho - 6);
    const abajo = rect.bottom + 34 < window.innerHeight;
    host.style.left = Math.max(window.scrollX + 4, x) + "px";
    host.style.top = (abajo ? rect.bottom + window.scrollY + 6 : rect.top + window.scrollY - 32) + "px";
  }

  function mostrar(ruc, valido, rect) {
    quitar();
    rucActual = ruc; validoActual = valido; rectActual = rect;
    host = document.createElement("ficha-ruc-boton");
    host.style.cssText = "all: initial; position: absolute; z-index: 2147483647;";
    raiz = host.attachShadow({ mode: "closed" });
    raiz.innerHTML = CSS + (valido
      ? `<button type="button" class="b" title="Ver la ficha de este RUC (Ficha RUC · Perú Sistemas Pro)">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
      Ver ficha</button>`
      : `<button type="button" class="b mal" title="Este número no cumple el dígito verificador de un RUC (Ficha RUC · Perú Sistemas Pro)">✕ RUC mal escrito</button>`);
    const b = raiz.querySelector("button");
    b.addEventListener("mousedown", sinRobarSeleccion);
    b.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      const r = rucActual;
      if (!vivo()) return avisarViejo(rect);
      if (!validoActual) { quitar(); enviarOAvisar({ tipo: "ruc_mal_escrito", ruc: r }, rect).catch(() => {}); return; }
      expandir(r, rect);
    });
    host.addEventListener("mouseenter", () => { if (reloj) clearTimeout(reloj); });
    host.addEventListener("mouseleave", () => temporizar(fijo ? 8000 : 4000));
    ubicar(rect, valido ? 96 : 140);
    (document.body || document.documentElement).append(host);
    temporizar(6000);                                                  // se va solo a los 6 s
  }

  function verMas(ruc) {
    const b = nodo("button", "mas", "Ver +");
    b.type = "button"; b.title = "Abrir la ficha completa en el panel";
    b.addEventListener("mousedown", sinRobarSeleccion);
    b.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      const rect = rectActual;
      if (!vivo()) return avisarViejo(rect);
      quitar();
      enviarOAvisar({ tipo: "ficha_desde_seleccion", ruc }, rect).catch(() => {});   // panel: usa lo ya consultado
    });
    return b;
  }

  function pintar(tarjeta) {
    if (!raiz) return;
    raiz.querySelectorAll(".b, .t").forEach(n => n.remove());
    raiz.append(tarjeta);
  }

  async function expandir(ruc, rect) {
    fijo = true;
    const t = nodo("div", "t"); t.setAttribute("role", "status");
    t.addEventListener("mousedown", sinRobarSeleccion);
    t.append(nodo("span", "muted", "Consultando…"));
    pintar(t);
    ubicar(rect, 240);
    temporizar(20000);
    let d;
    try {
      const x = await enviarOAvisar({ tipo: "vista_rapida", ruc }, rect);
      if (!x) return;                                                // contexto invalidado: ya se aviso
      d = x.r;
    } catch (_) { d = { ok: false, texto: "No pudimos consultar." }; }
    if (!host || rucActual !== ruc) return;                         // se cerro o cambio la seleccion
    const c = nodo("div", "t"); c.setAttribute("role", "status");
    c.addEventListener("mousedown", sinRobarSeleccion);
    if (!d || !d.ok) {
      const f = nodo("div", "fila"); f.append(nodo("span", "muted", (d && d.texto) || "No pudimos consultar."), nodo("span", "sp"), verMas(ruc));
      c.append(f);
    } else if (!d.encontrado) {
      const f = nodo("div", "fila"); f.append(nodo("span", "muted", "No figura en nuestros datos."), nodo("span", "sp"), verMas(ruc));
      c.append(f);
    } else {
      const sem = s => { const e = nodo("span", "sem " + (s.semaforo || "gris")); e.append(nodo("i"), document.createTextNode(s.nombre)); return e; };
      const f = nodo("div", "fila");
      f.append(sem(d.estado), nodo("span", "sep", "·"), sem(d.condicion), nodo("span", "sp"), verMas(ruc));
      if (d.razon) c.append(nodo("div", "razon", d.razon));
      c.append(f);
      if (d.alerta) c.append(nodo("div", "alerta", "⚠ " + d.alerta));
    }
    pintar(c);
    ubicar(rect, Math.min(320, c.getBoundingClientRect().width || 240));
    temporizar(15000);
  }

  let espera = null;
  function revisar() {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { if (!fijo) quitar(); return; }
      const r = rucDe(sel.toString());
      if (!r) { if (!fijo) quitar(); return; }
      if (r.ruc === rucActual && host) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return;
      mostrar(r.ruc, r.valido, rect);
    }, 180);
  }
  function alPresionar(e) { if (host && e.target !== host) quitar(); }
  function alTecla(e) { if (e.key === "Escape") quitar(); }
  document.addEventListener("selectionchange", revisar);
  document.addEventListener("mousedown", alPresionar, true);
  document.addEventListener("keydown", alTecla, true);
  window.addEventListener("blur", quitar);
})();
