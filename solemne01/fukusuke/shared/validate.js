// Validaciones de entrada (el servidor nunca confía en el navegador).
const { E } = require("./errors");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i;

const isUUID = (v) => typeof v === "string" && UUID.test(v);
const isEmail = (v) => typeof v === "string" && v.length <= 254 && EMAIL.test(v);
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isStr = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));

// RUN chileno: módulo 11
function normalizarRun(run) {
  return String(run || "").replace(/[.\s-]/g, "").toUpperCase();
}
function runValido(run) {
  const r = normalizarRun(run);
  if (!/^\d{7,8}[0-9K]$/.test(r)) return false;
  const cuerpo = r.slice(0, -1);
  const dv = r.slice(-1);
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const res = 11 - (suma % 11);
  const esperado = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return dv === esperado;
}
function enmascararRun(run) {
  const r = normalizarRun(run);
  const cuerpo = r.slice(0, -1);
  return `${cuerpo.slice(0, 2)}.***.***-${r.slice(-1)}`;
}

function requireUUID(v, campo = "id") {
  if (!isUUID(v)) throw E.badRequest(`${campo} mal formado`);
  return v.toLowerCase();
}

function assertObject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw E.badRequest("Cuerpo JSON requerido");
}

module.exports = { isUUID, isEmail, isInt, isStr, isDate, normalizarRun, runValido, enmascararRun, requireUUID, assertObject };
