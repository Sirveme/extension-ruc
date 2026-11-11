// node --test tests/acceso.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { textoDias } from "../src/lib/acceso.js";
import { enlaces, WA_CLUB, mensaje } from "../src/lib/api.js";

test("días de prueba, en español", () => {
  assert.equal(textoDias(15), "quedan 15 días");
  assert.equal(textoDias(1), "queda 1 día");
  assert.equal(textoDias(0), "termina hoy");
  assert.equal(textoDias(undefined), "quedan unos días");
});

test("muro de registro: WhatsApp del Club con el origen y el código; registro con vuelta a la extensión", () => {
  const e = enlaces("K7QM-4XPA");
  assert.equal(WA_CLUB, "51938246208");
  assert.ok(e.whatsapp.startsWith("https://wa.me/51938246208?text="));
  const texto = decodeURIComponent(e.whatsapp.split("?text=")[1]);
  assert.equal(texto, "Hola, quiero unirme al Club de Contadores. Vengo de la extensión Ficha RUC. #RUC-EXT · Código K7QM-4XPA");
  assert.doesNotMatch(texto, /llave|key|api|token|psp_live/i);
  const u = new URL(e.registro);
  assert.equal(u.origin + u.pathname, "https://club.perusistemas.pro/registro");
  assert.equal(u.searchParams.get("para"), "contador");
  assert.equal(u.searchParams.get("sig"), "/extension/vincular?c=K7QM-4XPA");
});

test("tope diario de la prueba: mensaje de hoy, no del mes", () => {
  const dia = mensaje({ status: 429, d: { error: { codigo: "cuota_agotada", periodo: "dia", reinicio: "2026-11-12", restante: 0 } } });
  assert.match(dia.texto, /tope de consultas de hoy/);
  const mes = mensaje({ status: 429, d: { error: { codigo: "cuota_agotada", periodo: "mes", reinicio: "2026-12-01", restante: 0 } } });
  assert.match(mes.texto, /cuota del mes.*01\/12\/2026/);
});
