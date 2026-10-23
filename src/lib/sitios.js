// Sitios donde se activa el boton "Ver ficha" -> patrones de permiso de Chrome.
// "todos" -> todos los sitios web (http y https); si no, solo los dominios elegidos y sus
// subdominios. Se aceptan entradas como "mail.google.com", "https://outlook.office.com/mail"
// o "*.ejemplo.pe"; lo que no parece un dominio se descarta.
export function origenes(cfg) {
  if (cfg.todos) return ["*://*/*"];
  const dominios = (cfg.sitios || []).map(s => String(s).trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, "").replace(/[/:?#].*$/, "").replace(/^\*\./, ""))
    .filter(d => /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(d) || /^\d{1,3}(\.\d{1,3}){3}$/.test(d));
  return [...new Set(dominios)].flatMap(d => [`*://${d}/*`, ...(/^\d/.test(d) ? [] : [`*://*.${d}/*`])]);
}
