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
