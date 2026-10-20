// node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { rucValido, extraerRucs, motivoSinRuc, fecha, soles, digitoVerificador } from "../src/lib/ruc.js";

test("digito verificador como el backend", () => {
  assert.equal(digitoVerificador("1012345678"), 1);        // 10123456781 (Juan Pérez, ficticio)
  assert.ok(rucValido("10123456781"));
  assert.ok(rucValido("10112233445"));
  assert.ok(!rucValido("10123456782"));                     // digito errado
  assert.ok(!rucValido("30123456781"));                     // prefijo inexistente
  assert.ok(!rucValido("1012345678"));                      // 10 digitos
});

test("extrae RUC sueltos, valida, sin repetir y en orden", () => {
  const t = "Eres tercero retenedor del RUC 10123456781. Ver también 10112233445, 10123456781 y 10123456782.";
  assert.deepEqual(extraerRucs(t), ["10123456781", "10112233445"]);
});

test("no confunde numeros mas largos, telefonos ni comprobantes", () => {
  assert.deepEqual(extraerRucs("Cuenta 0011101234567810123 · Tel 987654321 · F001-00012345"), []);
  assert.deepEqual(extraerRucs("x10123456781x"), ["10123456781"]);     // letras alrededor: sí
  assert.deepEqual(extraerRucs("910123456781"), []);                   // parte de un número más largo: no
});

test("espacios duros y tope", () => {
  assert.deepEqual(extraerRucs("RUC: 10123456781"), ["10123456781"]);
  const muchos = Array.from({ length: 10 }, () => "10123456781 10112233445").join(" ");
  assert.equal(extraerRucs(muchos, 1).length, 1);
});

test("motivo cuando no hay RUC", () => {
  assert.equal(motivoSinRuc("DNI 12345678"), "dni");
  assert.equal(motivoSinRuc("10123456782"), "digito");
  assert.equal(motivoSinRuc("hola"), "nada");
});

test("formatos", () => {
  assert.equal(fecha("2026-10-10"), "10/10/2026");
  assert.equal(fecha(null), "");
  assert.match(soles(152340), /^S\/ 152,340\.00$/);
});
