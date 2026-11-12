// node --test tests/compartir.test.mjs — modo reservado y textos para compartir
import { test } from "node:test";
import assert from "node:assert/strict";
import { ocultarRuc, ocultarRazon, vista, textoFicha, asuntoCorreo, enlaceCorreo, enlaceWhatsapp, textoCopiar,
         lineasFirma, nombrePng, diaMes, OCULTO, PIE_FUENTE } from "../src/lib/compartir.js";

const X = {
  ruc: "20123456565", encontrado: true, razon_social: "BANCO DE LA NACION", domicilio: "AV. EJEMPLO 123",
  estado: { nombre: "ACTIVO", semaforo: "verde" }, condicion: { nombre: "NO HABIDO", semaforo: "rojo" },
  distrito: "SAN ISIDRO", provincia: "LIMA", departamento: "LIMA", datos_al: "2026-11-05",
  marcas: { ssco: { firme: "2026-01-10" } }, listas: [{ tipo: "riesgo", nombre: "Cobranza coactiva" }, { tipo: "info", nombre: "Buen contribuyente" }],
};

test("RUC: primeros 2 y últimos 3", () => {
  assert.equal(ocultarRuc("20123456565"), "20••••••565");
  assert.equal(ocultarRuc("10457812345"), "10••••••345");
});

test("razón social: primera palabra y el resto con puntos", () => {
  assert.equal(ocultarRazon("BANCO DE LA NACION"), "BANCO •• •• ••••••");
  assert.equal(ocultarRazon("PEREZ GARCIA JUAN"), "PEREZ •••••• ••••");
  assert.equal(ocultarRazon("  UNICA  "), "UNICA");
  assert.equal(ocultarRazon(""), "");
});

test("vista reservada: domicilio oculto, ubicación sin distrito; completa: todo", () => {
  const r = vista(X, true), c = vista(X, false);
  assert.deepEqual(r, { ruc: "20••••••565", razon: "BANCO •• •• ••••••", domicilio: OCULTO, ubicacion: "Lima · Lima" });
  assert.deepEqual(c, { ruc: "20123456565", razon: "BANCO DE LA NACION", domicilio: "AV. EJEMPLO 123", ubicacion: "San Isidro · Lima · Lima" });
});

test("texto para compartir: reservado no lleva RUC ni razón completos; alertas y estado completos", () => {
  const t = textoFicha(X, { reservado: true });
  assert.equal(t, ["RUC: 20••••••565", "Razón social: BANCO •• •• ••••••", "Estado: ACTIVO", "Condición: NO HABIDO",
    "Ubicación: Lima · Lima", "Alertas: ⚠️ Sin capacidad operativa · NO HABIDO · Cobranza coactiva", "Datos al 05/11"].join("\n"));
  assert.doesNotMatch(t, /20123456565|NACION|EJEMPLO|San Isidro/);
  const c = textoFicha(X, { reservado: false });
  assert.match(c, /RUC: 20123456565/); assert.match(c, /BANCO DE LA NACION/); assert.match(c, /San Isidro/);
  assert.doesNotMatch(c, /EJEMPLO/);                       // el domicilio no va en el texto
  assert.match(textoFicha({ ...X, marcas: {}, listas: [], condicion: { nombre: "HABIDO", semaforo: "verde" } }, { reservado: true }), /Alertas: ninguna/);
});

test("correo: asunto sin el RUC completo en modo reservado", () => {
  assert.equal(asuntoCorreo(X, true), "Ficha RUC");
  assert.equal(asuntoCorreo(X, false), "Ficha RUC 20123456565");
  const m = enlaceCorreo(X, { reservado: true });
  assert.ok(m.startsWith("mailto:?subject=Ficha%20RUC&body="));
  assert.doesNotMatch(decodeURIComponent(m), /20123456565/);
  assert.ok(enlaceWhatsapp(X, { reservado: true }).startsWith("https://wa.me/?text="));
  assert.doesNotMatch(decodeURIComponent(enlaceWhatsapp(X, { reservado: true })), /20123456565/);
});

test("copiar respeta la casilla", () => {
  assert.equal(textoCopiar(X, true), "20••••••565\tBANCO •• •• ••••••");
  assert.equal(textoCopiar(X, false), "20123456565\tBANCO DE LA NACION");
});

test("firma opcional, archivo y pie", () => {
  assert.deepEqual(lineasFirma({ nombre: "María Torres Quispe", cpc: "CPC 12345", telefono: "987 654 321" }),
    ["María Torres Quispe", "CPC 12345 · 987 654 321"]);
  assert.deepEqual(lineasFirma({ nombre: "", cpc: "", telefono: "" }), []);
  assert.deepEqual(lineasFirma(null), []);
  assert.equal(nombrePng(X, true), "ficha-ruc.png");
  assert.equal(nombrePng(X, false), "ficha-ruc-20123456565.png");
  assert.equal(diaMes("2026-11-05"), "05/11");
  assert.equal(PIE_FUENTE, "Fuente: Ficha RUC · Perú Sistemas Pro — software para contabilidad");
});

test("textos sin palabras prohibidas", () => {
  for (const t of [textoFicha(X, { reservado: true }), textoFicha(X, { reservado: false }), PIE_FUENTE])
    assert.doesNotMatch(t, /\b(llaves?|key|api|token|psp_live)\b/i);
});
