// Vitrina al pie de la ficha y de la tabla: tarjetas de colores que rotan cada 5 s.
// El contenido llega del servidor del Club como DATOS (nunca codigo) y se pinta con textContent.
// Si el servidor no responde, se usan las tarjetas incluidas aqui. No consume cuota.

export const REF = "ficha-ruc";
export const ROTAR_MS = 5000;

const COLOR = /^#[0-9a-f]{6}$/i;

export function conRef(url) {
  const u = new URL(url);
  u.searchParams.set("ref", REF);
  return u.toString();
}

// Incluidas en el paquete (respaldo sin conexion): enlace directo con ?ref=ficha-ruc.
export const INCLUIDAS = [
  { titulo: "Perú Sistemas Pro", texto: "¿Necesitas un sistema a medida?", emoji: "💡", color1: "#ff7a18", color2: "#d6246e", boton: "Escríbenos", enlace: "https://wa.me/51967317946" },
  { titulo: "TeAtiendo", texto: "Tu WhatsApp atiende solo, 24/7", emoji: "🤖", color1: "#6a3df0", color2: "#a347e8", boton: "Conócelo", enlace: "https://teatiendo.pro" },
  { titulo: "QueVendi", texto: "Vende y factura con tu voz", emoji: "🎤", color1: "#0fb5ae", color2: "#1f7ae0", boton: "Pruébalo", enlace: "https://quevendi.pro" },
  { titulo: "Curso IA sin Miedo", texto: "Solo para miembros del Club", emoji: "🎓", color1: "#ff6b6b", color2: "#f0932b", boton: "Ver el curso", enlace: "https://iasinmiedo.pro" },
  { titulo: "alerta.pe", texto: "Que no se te pase ninguna notificación", emoji: "🔔", color1: "#e94057", color2: "#8a2387", boton: "Conócelo", enlace: "https://alerta.pe" },
].map(t => ({ ...t, enlace: conRef(t.enlace) }));

const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Respuesta del servidor -> tarjetas seguras para pintar. Lo que no cumple, se descarta.
// `irA(id)` arma el enlace que cuenta el clic en el servidor (y redirige con ?ref=ficha-ruc).
export function limpiarTarjetas(json, irA) {
  const lista = json && Array.isArray(json.tarjetas) ? json.tarjetas : [];
  const out = [];
  for (const t of lista.slice(0, 12)) {
    if (!t || typeof t !== "object" || !Number.isInteger(t.id) || t.id <= 0) continue;
    const c = { titulo: texto(t.titulo, 40), texto: texto(t.texto, 70), emoji: texto(t.emoji, 8), boton: texto(t.boton, 20),
                color1: COLOR.test(t.color1 || "") ? t.color1 : null, color2: COLOR.test(t.color2 || "") ? t.color2 : null, enlace: irA(t.id) };
    if (c.titulo && c.texto && c.boton && c.color1 && c.color2) out.push(c);
  }
  return out;
}

// --- Carrusel (solo en paginas de la extension) --------------------------------------------------
// Rota cada 5 s alternando "desliza a la izquierda" y "sube". Pausa con el mouse encima o con foco.
// Puntos y flechas para navegar. Con prefers-reduced-motion, el CSS quita las transiciones.
export function montarVitrina(caja, tarjetas, abrir) {
  if (caja.__vitrina) caja.__vitrina.parar();
  const el = (tag, props = {}, ...hijos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") e.className = v; else if (k === "texto") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
    }
    e.append(...hijos.filter(Boolean));
    return e;
  };
  const ts = (tarjetas || []).filter(Boolean);
  if (!ts.length) { caja.replaceChildren(); caja.hidden = true; return; }
  let i = 0, paso = 0, reloj = null;
  const pistas = ts.map((t, n) => {
    const d = el("div", { class: "tarjeta" + (n === 0 ? " activa" : ""), role: "group", "aria-roledescription": "tarjeta",
      "aria-label": `${n + 1} de ${ts.length}: ${t.titulo}` },
      el("span", { class: "emoji " + (n % 2 ? "latido" : "rebote"), "aria-hidden": "true", texto: t.emoji }),
      el("span", { class: "txt" }, el("b", { texto: t.titulo }), el("span", { texto: t.texto })),
      el("button", { class: "ir", type: "button", texto: t.boton, onclick: () => abrir(t.enlace) }));
    d.style.background = `linear-gradient(120deg, ${t.color1}, ${t.color2})`;
    return d;
  });
  const puntos = ts.map((t, n) => el("button", { class: "punto" + (n === 0 ? " activo" : ""), type: "button",
    "aria-label": `Ver tarjeta ${n + 1}: ${t.titulo}`, onclick: () => ir(n) }));
  const flechas = ts.length > 1
    ? [el("button", { class: "flecha izq", type: "button", "aria-label": "Tarjeta anterior", texto: "‹", onclick: () => ir(i - 1) }),
       el("button", { class: "flecha der", type: "button", "aria-label": "Tarjeta siguiente", texto: "›", onclick: () => ir(i + 1) })]
    : [];
  const pista = el("div", { class: "pista" }, ...pistas);
  caja.replaceChildren(pista, ...flechas, ts.length > 1 ? el("div", { class: "puntos" }, ...puntos) : null);
  caja.hidden = false;

  function ir(n) {
    const sig = (n + ts.length) % ts.length;
    if (sig === i) return;
    const modo = paso++ % 2 ? "sube" : "desliza";       // alterna la transicion
    const viejo = pistas[i], nuevo = pistas[sig];
    pista.dataset.modo = modo;
    pistas.forEach(p => p.classList.remove("sale", "entra"));
    nuevo.classList.add("entra");
    void nuevo.offsetWidth;                               // aplica la posicion de entrada antes de animar
    viejo.classList.remove("activa"); viejo.classList.add("sale");
    nuevo.classList.remove("entra"); nuevo.classList.add("activa");
    puntos[i].classList.remove("activo"); puntos[sig].classList.add("activo");
    i = sig;
  }
  // Pausa con el mouse encima o con el foco dentro (los oyentes se ponen una sola vez por caja).
  if (!caja.__escucha) {
    caja.__escucha = true;
    caja.addEventListener("mouseenter", () => { caja.__pausa = true; });
    caja.addEventListener("mouseleave", () => { caja.__pausa = false; });
    caja.addEventListener("focusin", e => { caja.__pausa = e.target.matches(":focus-visible"); });   // teclado: pausa
    caja.addEventListener("focusout", e => { if (!caja.contains(e.relatedTarget)) caja.__pausa = caja.matches(":hover"); });
  }
  caja.__pausa = caja.matches(":hover");
  const programar = () => { clearInterval(reloj); if (ts.length > 1) reloj = setInterval(() => { if (!caja.__pausa && !document.hidden) ir(i + 1); }, ROTAR_MS); };
  programar();
  caja.__vitrina = { parar: () => clearInterval(reloj), ir, actual: () => i };
}
