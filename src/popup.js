import { analizarTexto, motivoSinRuc, textoInvalido } from "./lib/ruc.js";

const $ = id => document.getElementById(id);
let ventana = null;
chrome.windows.getCurrent().then(w => { ventana = w.id; });          // antes del clic: el panel se abre en el gesto

(async () => {
  const est = await chrome.runtime.sendMessage({ tipo: "cuota" });
  $("sinLlave").hidden = est.tieneLlave;
  if (est.cuota && est.cuota.restante !== null) $("cuota").textContent = `${est.cuota.restante} de ${est.cuota.limite} consultas este mes`;
  $("texto").focus();
})();

$("ver").addEventListener("click", () => {
  const texto = $("texto").value;
  const { rucs, invalidos } = analizarTexto(texto);
  if (!rucs.length) {                                   // nada que consultar: se dice por que, RUC por RUC
    const m = motivoSinRuc(texto);
    const lineas = invalidos.length ? invalidos.slice(0, 6).map(textoInvalido)
      : [m === "dni" ? "Por ahora la ficha es solo por RUC (11 dígitos)." : "No encontramos ningún RUC en lo que pegaste."];
    if (invalidos.length > 6) lineas.push(`…y ${invalidos.length - 6} más.`);
    $("r").replaceChildren(...lineas.map(t => Object.assign(document.createElement("div"), { className: "msg err", textContent: t })));
    return;
  }
  chrome.sidePanel.open({ windowId: ventana });                    // dentro del gesto, sin await antes
  chrome.runtime.sendMessage({ tipo: "pegar", texto }).then(() => window.close());
});
