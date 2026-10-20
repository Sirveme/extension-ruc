// node --test tests/llave.test.mjs     (con LLAVE_PANEL=<llave creada en el panel de ensayo> prueba
// tambien una llave REAL generada por /panel/llaves)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarLlave, FORMATO } from "../src/lib/llave.js";

const EJEMPLO = "psp_live_1a2b3c4d_Q0tLc3R1dmF6eV9wcnVlYmFfZXhhbXBsZQ";   // misma forma que nueva_llave()

test("acepta el formato del panel y la API", () => {
  assert.deepEqual(normalizarLlave(EJEMPLO), { ok: true, llave: EJEMPLO });
});

test("tolera lo que se cuela al copiar", () => {
  for (const pegado of [`  ${EJEMPLO}\n`, `Bearer ${EJEMPLO}`, `Authorization: Bearer ${EJEMPLO}`, `"${EJEMPLO}"`,
                        EJEMPLO.slice(0, 30) + "\n" + EJEMPLO.slice(30)])
    assert.equal(normalizarLlave(pegado).llave, EJEMPLO, JSON.stringify(pegado));
});

test("solo el prefijo (lo que lista el panel): mensaje exacto", () => {
  for (const p of ["psp_live_1a2b3c4d", "psp_live_1a2b3c4d…", "psp_live_1a2b3c4d..."]) {
    const r = normalizarLlave(p);
    assert.equal(r.ok, false); assert.equal(r.motivo, "prefijo", p);
    assert.match(r.texto, /solo el prefijo/);
  }
});

test("incompleta, ajena y vacia", () => {
  assert.equal(normalizarLlave("psp_live_1a2b3c4d_corta").motivo, "incompleta");
  assert.equal(normalizarLlave("sk-algo-de-otro-lado").motivo, "formato");
  assert.equal(normalizarLlave("   ").motivo, "vacia");
});

test("llave REAL creada en /panel/llaves (esquema de ensayo)", { skip: !process.env.LLAVE_PANEL }, () => {
  const real = process.env.LLAVE_PANEL;
  assert.ok(FORMATO.test(real), "la llave del panel cumple el formato");
  assert.equal(normalizarLlave(real).llave, real);
  assert.equal(normalizarLlave(real.split("_").slice(0, 3).join("_")).motivo, "prefijo");
});
