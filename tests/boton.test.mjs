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
    .replace("(() => {", "(() => { globalThis.__exponer = () => ({ rucValido, rucDe, vivo, enviar, caducado, AVISO_VIEJO });");
  const ctx = { window: {}, document: { addEventListener() {} }, chrome: {}, globalThis: null };
  ctx.globalThis = ctx; ctx.window.addEventListener = () => {};
  vm.createContext(ctx); vm.runInContext(fuente, ctx);
  return { ...ctx.__exponer(), ctx };
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

test("contexto invalidado (extension actualizada con la pagina abierta): no lanza, avisa", async () => {
  const { ctx } = B;
  ctx.chrome = {};                                              // sin runtime
  assert.equal(B.vivo(), false);
  await assert.rejects(B.enviar({ tipo: "vista_rapida", ruc: "20100070970" }), e => B.caducado(e));
  ctx.chrome = { runtime: {} };                                 // runtime sin id: contexto invalidado
  assert.equal(B.vivo(), false);
  await assert.rejects(B.enviar({ tipo: "x" }), e => B.caducado(e));
  ctx.chrome = { get runtime() { throw new Error("Extension context invalidated."); } };   // hasta leerlo falla
  assert.equal(B.vivo(), false);
  // vivo al verificar, pero se invalida justo al enviar
  ctx.chrome = { runtime: { id: "abc", sendMessage() { throw new Error("Extension context invalidated."); } } };
  assert.equal(B.vivo(), true);
  await assert.rejects(B.enviar({ tipo: "x" }), e => B.caducado(e));
  ctx.chrome = { runtime: { id: "abc", sendMessage: () => Promise.reject(new Error("Extension context invalidated.")) } };
  await assert.rejects(B.enviar({ tipo: "x" }), e => B.caducado(e));
  // normal: devuelve la respuesta; otro error no se confunde con contexto invalidado
  ctx.chrome = { runtime: { id: "abc", sendMessage: m => Promise.resolve({ ok: true, eco: m.tipo }) } };
  assert.deepEqual({ ...(await B.enviar({ tipo: "vista_rapida" })) }, { ok: true, eco: "vista_rapida" });
  ctx.chrome = { runtime: { id: "abc", sendMessage: () => Promise.reject(new Error("Could not establish connection")) } };
  await assert.rejects(B.enviar({ tipo: "x" }), e => !B.caducado(e));
  assert.equal(B.AVISO_VIEJO, "Ficha RUC se actualizó · recarga la página (F5)");
  assert.doesNotMatch(B.AVISO_VIEJO, /(llaves?|key|api|token|psp_live)/i);
});
