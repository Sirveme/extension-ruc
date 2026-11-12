// node --test tests/vitrina.test.mjs — vitrina: solo datos, respaldo incluido, ?ref=ficha-ruc
import { test } from "node:test";
import assert from "node:assert/strict";
import { INCLUIDAS, limpiarTarjetas, conRef, REF, ROTAR_MS } from "../src/lib/vitrina.js";

const irA = id => `https://club.perusistemas.pro/api/v1/vitrina/ir/${id}`;

test("tarjetas incluidas en el paquete: las 5, con ?ref=ficha-ruc y https", () => {
  assert.deepEqual(INCLUIDAS.map(t => t.titulo), ["Perú Sistemas Pro", "TeAtiendo", "QueVendi", "Curso IA sin Miedo", "alerta.pe"]);
  assert.equal(INCLUIDAS[0].enlace, "https://wa.me/51967317946?ref=ficha-ruc");
  for (const t of INCLUIDAS) {
    assert.ok(t.enlace.startsWith("https://") && new URL(t.enlace).searchParams.get("ref") === REF, t.enlace);
    assert.match(t.color1, /^#[0-9a-f]{6}$/i); assert.match(t.color2, /^#[0-9a-f]{6}$/i);
    assert.ok(t.emoji && t.texto && t.boton);
    assert.doesNotMatch(`${t.titulo} ${t.texto} ${t.boton}`, /\b(llaves?|key|api|token|psp_live)\b/i);
  }
  assert.equal(ROTAR_MS, 5000);
});

test("del servidor: solo datos válidos; el enlace siempre pasa por el conteo", () => {
  const ts = limpiarTarjetas({ tarjetas: [
    { id: 3, titulo: "TeAtiendo", texto: "Tu WhatsApp atiende solo, 24/7", emoji: "🤖", color1: "#6a3df0", color2: "#a347e8", boton: "Conócelo", enlace: "javascript:alert(1)" },
    { id: 4, titulo: "Mal color", texto: "x", emoji: "", color1: "red;background:url(x)", color2: "#000000", boton: "Ir" },
    { id: "5", titulo: "Id texto", texto: "x", color1: "#000000", color2: "#000000", boton: "Ir" },
    { id: 6, titulo: "<img src=x onerror=alert(1)>", texto: "y".repeat(200), color1: "#000000", color2: "#111111", boton: "Ir" },
    { id: 7, titulo: "", texto: "sin título", color1: "#000000", color2: "#111111", boton: "Ir" },
  ] }, irA);
  assert.equal(ts.length, 2);
  assert.equal(ts[0].enlace, irA(3));                       // nunca el enlace que venga en los datos
  assert.equal(ts[1].titulo, "<img src=x onerror=alert(1)>"); // se pinta con textContent: queda como texto
  assert.equal(ts[1].texto.length, 70);                      // recortado
  assert.deepEqual(limpiarTarjetas(null, irA), []);
  assert.deepEqual(limpiarTarjetas({ tarjetas: "no" }, irA), []);
});

test("conRef reemplaza un ref anterior", () => {
  assert.equal(conRef("https://teatiendo.pro/?ref=otro&x=1"), "https://teatiendo.pro/?ref=ficha-ruc&x=1");
});
