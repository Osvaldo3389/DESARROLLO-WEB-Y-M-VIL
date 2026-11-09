// Utilidades de prueba: cliente HTTPS con cookies (como un navegador), registro de evidencias y acceso a datos de prueba.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const BASE = process.env.BASE_URL || "https://localhost:8443";
const SECRETS = process.env.SECRETS_DIR || path.join(__dirname, "..", "secrets");
const secreto = (ref) => fs.readFileSync(path.join(SECRETS, ref), "utf8").trim();
const evidencias = [];
const resultados = [];

class Navegador {
  constructor(nombre) { this.nombre = nombre; this.cookies = {}; }
  cookieHeader() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; "); }
  guardarCookies(r) {
    for (const c of r.headers.getSetCookie()) {
      const [kv, ...attrs] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i).trim(); const v = kv.slice(i + 1).trim();
      const maxAge = attrs.find((a) => /max-age=0/i.test(a));
      if (maxAge || v === "") delete this.cookies[k]; else this.cookies[k] = v;
    }
  }
  async req(method, ruta, { body, headers = {}, raw, sinCsrf, registrar = true } = {}) {
    if (!this.cookies.fk_csrf && method !== "GET") await this.req("GET", "/api/v1/products?page=1&size=1", { registrar: false });
    const h = { ...headers };
    if (body !== undefined || raw !== undefined) h["Content-Type"] = h["Content-Type"] || "application/json";
    if (method !== "GET" && !sinCsrf && this.cookies.fk_csrf) h["X-CSRF-Token"] = this.cookies.fk_csrf;
    const ck = this.cookieHeader();
    if (ck) h.Cookie = ck;
    const t0 = Date.now();
    const r = await fetch(BASE + ruta, { method, headers: h, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
    this.guardarCookies(r);
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* no json */ }
    const out = { status: r.status, body: json, headers: r.headers, ms: Date.now() - t0, correlationId: r.headers.get("x-correlation-id") };
    if (registrar) evidencias.push({ quien: this.nombre, method, ruta: ruta.length > 90 ? ruta.slice(0, 87) + "..." : ruta, status: r.status, resumen: resumir(json, text) });
    return out;
  }
  async login(email, password) {
    const r = await this.req("POST", "/api/v1/auth/login", { body: { email, password } });
    if (r.status !== 200) throw new Error(`login ${email} → ${r.status}`);
    return r;
  }
}

function resumir(json, text) {
  const s = json ? JSON.stringify(json) : text || "";
  return s.length > 160 ? s.slice(0, 157) + "..." : s;
}

function registrar(id, caso, esperado, obtenido, ok) {
  resultados.push({ id, caso, esperado, obtenido, ok: !!ok });
}

let pool;
async function db() {
  if (!pool) {
    require("../shared/env");
    const cfg = { user: process.env.DB_ROOT_USER || "root", dateStrings: true };
    if (process.env.DB_ROOT_SOCKET) cfg.socketPath = process.env.DB_ROOT_SOCKET;
    else { cfg.host = process.env.DB_HOST || "127.0.0.1"; cfg.port = Number(process.env.DB_PORT || 3306); cfg.password = process.env.DB_ROOT_PASSWORD || ""; }
    pool = mysql.createPool(cfg);
  }
  return pool;
}

async function correoDe(destinatario) {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`http://127.0.0.1:8025/api/messages?to=${encodeURIComponent(destinatario)}`).then((x) => x.json());
    if (r.length) return r[0];
    await new Promise((s) => setTimeout(s, 250));
  }
  return null;
}

function firmarWebhook(obj) {
  const body = JSON.stringify(obj);
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secreto("servipag-webhook-secret")).update(`${ts}.${body}`).digest("hex");
  return { body, header: `t=${ts},v1=${sig}` };
}

function runValido(n) {
  const cuerpo = String(n);
  let suma = 0; let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * mult; mult = mult === 7 ? 2 : mult + 1; }
  const res = 11 - (suma % 11);
  return `${cuerpo.slice(0, -6)}.${cuerpo.slice(-6, -3)}.${cuerpo.slice(-3)}-${res === 11 ? "0" : res === 10 ? "K" : String(res)}`;
}

function guardar() {
  const dir = path.join(__dirname, "resultados");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "resultados.json"), JSON.stringify({ fecha: new Date().toISOString(), resultados, evidencias }, null, 2));
}
const espera = (ms) => new Promise((s) => setTimeout(s, ms));

module.exports = { BASE, Navegador, registrar, secreto, db, correoDe, firmarWebhook, runValido, guardar, espera, evidencias, resultados };
