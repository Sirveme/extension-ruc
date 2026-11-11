// node --test tests/boton.test.mjs — el script del boton valida igual que lib/ruc.js, y los sitios
// se convierten bien en patrones de permiso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { rucValido } from "../src/lib/ruc.js";
import { origenes } from "../src/lib/sitios.js";

// Carga boton.js en un entorno minimo y saca sus funciones internas (rucValido, rucDe).
function cargarBoton() {
  const fuente = readFileSync(new URL("../src/boton.js", import.meta.url), "utf8")
    .replace("(() => {", "(() => { globalThis.__exponer = () => ({ rucValido, rucDe });");
  const ctx = { window: {}, document: { addEventListener() {} }, chrome: {}, globalThis: null };
  ctx.globalThis = ctx; ctx.window.addEventListener = () => {};
  vm.createContext(ctx); vm.runInContext(fuente, ctx);
  return ctx.__exponer();
}
const B = cargarBoton();

test("misma validacion modulo 11 que lib/ruc.js", () => {
  for (let i = 0; i < 3000; i++) {
    const r = String(["10", "15", "17", "20"][i % 4]) + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
    assert.equal(B.rucValido(r), rucValido(r), r);
  }
});

test("el boton solo aparece si la seleccion ES un RUC (valido o mal escrito)", () => {
  const ok = r => ({ ruc: r, valido: true }), mal = r => ({ ruc: r, valido: false });
  const de = t => { const r = B.rucDe(t); return r && { ...r }; };   // objeto del vm -> de este contexto
  assert.deepEqual(de("10123456781"), ok("10123456781"));
  assert.deepEqual(de("  RUC: 10123456781 "), ok("10123456781"));
  assert.deepEqual(de("RUC N° 10123456781."), ok("10123456781"));
  assert.deepEqual(de("10123456782"), mal("10123456782"));     // digito errado: etiqueta «RUC mal escrito»
  assert.deepEqual(de("RUC: 20100070971"), mal("20100070971"));
  assert.equal(de("51987654321"), null);                       // 11 digitos sin prefijo de RUC: nada
  assert.equal(de("2010007097"), null);                        // 10 digitos: nada
  assert.equal(de("Proveedor Juan Pérez 10123456781"), null);  // texto con un RUC: para eso, el menu
  assert.equal(de("10123456781 y 10112233445"), null);         // dos RUC
  assert.equal(de("987654321"), null);
  assert.equal(de(""), null);
});

test("sitios -> patrones de permiso", () => {
  assert.deepEqual(origenes({ todos: true }), ["*://*/*"]);
  assert.deepEqual(origenes({ todos: false, sitios: ["mail.google.com", "https://outlook.office.com/mail/", "*.alerta.pe", "no es sitio", "mail.google.com"] }),
    ["*://mail.google.com/*", "*://*.mail.google.com/*", "*://outlook.office.com/*", "*://*.outlook.office.com/*", "*://alerta.pe/*", "*://*.alerta.pe/*"]);
  assert.deepEqual(origenes({ todos: false, sitios: ["127.0.0.1"] }), ["*://127.0.0.1/*"]);
  assert.deepEqual(origenes({ todos: false, sitios: [] }), []);
});
