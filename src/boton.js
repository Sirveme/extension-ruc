// Boton flotante "Ver ficha" junto a una seleccion que ES un RUC valido. Si la seleccion parece un
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

  let host = null, reloj = null, rucActual = null, validoActual = true;
  const quitar = () => {
    if (reloj) clearTimeout(reloj);
    reloj = null; rucActual = null;
    if (host) { host.remove(); host = null; }
  };

  function mostrar(ruc, valido, rect) {
    quitar();
    rucActual = ruc; validoActual = valido;
    host = document.createElement("ficha-ruc-boton");
    host.style.cssText = "all: initial; position: absolute; z-index: 2147483647;";
    const raiz = host.attachShadow({ mode: "closed" });
    raiz.innerHTML = `<style>
      button { all: initial; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
        font: 600 12px/1 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; color: #1a110a; background: #e8a04a;
        border: 1px solid #f0b56a; border-radius: 3px; padding: 6px 10px; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
      button:hover { background: #f0b56a; } button:focus-visible { outline: 2px solid #1a110a; outline-offset: 1px; }
      svg { width: 12px; height: 12px; }
      button.mal { background: #e5534b; border-color: #f07a72; color: #1a110a; }
      button.mal:hover { background: #f07a72; }
    </style>` + (valido
      ? `<button type="button" title="Ver la ficha de este RUC (Ficha RUC · Perú Sistemas Pro)">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
      Ver ficha</button>`
      : `<button type="button" class="mal" title="Este número no cumple el dígito verificador de un RUC (Ficha RUC · Perú Sistemas Pro)">✕ RUC mal escrito</button>`);
    raiz.querySelector("button").addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      const r = rucActual, v = validoActual;
      quitar();
      chrome.runtime.sendMessage({ tipo: v ? "ficha_desde_seleccion" : "ruc_mal_escrito", ruc: r });   // solo ese numero
    });
    // Debajo y al final de la seleccion; si no cabe, encima. Coordenadas del documento.
    const x = Math.min(rect.right + window.scrollX - 4, window.scrollX + document.documentElement.clientWidth - (valido ? 96 : 140));
    const abajo = rect.bottom + 34 < window.innerHeight;
    host.style.left = Math.max(window.scrollX + 4, x) + "px";
    host.style.top = (abajo ? rect.bottom + window.scrollY + 6 : rect.top + window.scrollY - 32) + "px";
    (document.body || document.documentElement).append(host);
    reloj = setTimeout(quitar, 6000);                                    // se va solo a los 6 s
  }

  let espera = null;
  function revisar() {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { quitar(); return; }
      const r = rucDe(sel.toString());
      if (!r) { quitar(); return; }
      if (r.ruc === rucActual && host) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return;
      mostrar(r.ruc, r.valido, rect);
    }, 180);
  }
  document.addEventListener("selectionchange", revisar);
  document.addEventListener("mousedown", e => { if (host && e.target !== host) quitar(); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape") quitar(); }, true);
  window.addEventListener("blur", quitar);
})();
