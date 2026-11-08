// Simulador de la pasarela Servipag (SANDBOX). Conserva el contrato: crear transacción con clave del
// comercio, página de pago, aviso (webhook) FIRMADO con HMAC al gateway y redirección de retorno.
process.env.SERVICE_NAME = "servipag-sandbox";
const crypto = require("crypto");
const https = require("https");
const express = require("express");
const { createApp, finish, listen, h } = require("../../shared/service");
const { createSecretProvider } = require("../../shared/secrets");
const { safeEqual } = require("../../shared/auth");
const { E } = require("../../shared/errors");
const log = require("../../shared/log");

const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://gateway:8443/api/v1/payments/webhooks/servipag";
const PUBLIC_URL = process.env.SERVIPAG_PUBLIC_URL || "http://localhost:8090";

async function main() {
  const secrets = createSecretProvider();
  const apiKey = await secrets.obtener("servipag-api-key");
  const webhookSecret = await secrets.obtener("servipag-webhook-secret");
  const ca = await secrets.obtener("tls-ca-cert");
  const trx = new Map();
  const app = createApp();
  app.use(express.urlencoded({ extended: false, limit: "4kb" }));

  app.post("/api/transacciones", h(async (req, res) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!m || !safeEqual(apiKey, m[1])) throw E.unauthorized("Clave de comercio inválida");
    const { monto, referencia, urlRetorno } = req.body || {};
    if (!Number.isInteger(monto) || monto <= 0 || typeof referencia !== "string" || typeof urlRetorno !== "string") throw E.badRequest();
    const token = crypto.randomBytes(12).toString("hex");
    trx.set(token, { monto, referencia, urlRetorno, transaccionId: `SP-${Date.now()}-${token.slice(0, 6)}`, estado: "CREADA" });
    res.status(201).json({ token, redirectUrl: `${PUBLIC_URL}/pagar/${token}` });
  }));

  function enviarAviso(t, estado, monto = t.monto) {
    const body = JSON.stringify({ transaccionId: t.transaccionId, referencia: t.referencia, monto, estado });
    const ts = Math.floor(Date.now() / 1000);
    const firma = crypto.createHmac("sha256", webhookSecret).update(`${ts}.${body}`).digest("hex");
    const url = new URL(WEBHOOK_URL);
    return new Promise((resolve) => {
      const req = https.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: "POST", ca,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "X-Signature": `t=${ts},v1=${firma}` } }, (r) => {
        r.resume(); r.on("end", () => resolve(r.statusCode));
      });
      req.on("error", (e) => { log.warn("aviso no entregado", { err: e.message }); resolve(0); });
      req.end(body);
    });
  }

  app.get("/pagar/:token", (req, res) => {
    const t = trx.get(req.params.token);
    if (!t) return res.status(404).send("Transacción no encontrada");
    res.type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Servipag (sandbox)</title>
      <style>body{font-family:Arial;background:#f3f4f6;color:#111;display:flex;justify-content:center;padding:40px}
      .c{background:#fff;border:1px solid #ccc;border-radius:12px;padding:28px;max-width:420px;width:100%}button{width:100%;padding:12px;margin-top:10px;border-radius:8px;border:0;font-size:16px;cursor:pointer}
      .ok{background:#111;color:#fff}.no{background:#e5e7eb}</style><div class="c"><h2>Servipag · sandbox</h2>
      <p>Comercio: <b>Fukusuke Sushi-Delivery</b></p><p>Monto a pagar: <b>$${t.monto.toLocaleString("es-CL")}</b></p>
      <p style="font-size:12px;color:#555">Entorno de pruebas: no se usan medios de pago reales.</p>
      <form method="post" action="/pagar/${req.params.token}/aprobar"><button class="ok">Pagar</button></form>
      <form method="post" action="/pagar/${req.params.token}/rechazar"><button class="no">Cancelar / rechazar</button></form></div>`);
  });

  app.post("/pagar/:token/:accion", h(async (req, res) => {
    const t = trx.get(req.params.token);
    if (!t || !["aprobar", "rechazar"].includes(req.params.accion)) throw E.notFound();
    const estado = req.params.accion === "aprobar" ? "APROBADO" : "RECHAZADO";
    t.estado = estado;
    const status = await enviarAviso(t, estado);
    log.info("aviso enviado", { estado, status });
    if (req.headers.accept && req.headers.accept.includes("application/json")) return res.json({ estado, avisoStatus: status, transaccionId: t.transaccionId });
    res.redirect(303, `${t.urlRetorno}&estado=${estado}`);
  }));

  finish(app);
  listen(app, Number(process.env.PORT || 8090));
}
main().catch((e) => { console.error(e); process.exit(1); });
