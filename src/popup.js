import { extraerRucs, motivoSinRuc } from "./lib/ruc.js";

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
  const rucs = extraerRucs(texto);
  if (!rucs.length) {
    const m = motivoSinRuc(texto);
    $("r").innerHTML = "";
    const d = document.createElement("div");
    d.className = "msg err";
    d.textContent = m === "dni" ? "Por ahora la ficha es solo por RUC (11 dígitos)."
      : m === "digito" ? "Ese número no es un RUC válido: revisa los dígitos." : "No encontramos ningún RUC válido.";
    $("r").append(d);
    return;
  }
  chrome.sidePanel.open({ windowId: ventana });                    // dentro del gesto, sin await antes
  chrome.runtime.sendMessage({ tipo: "pegar", texto }).then(() => window.close());
});
