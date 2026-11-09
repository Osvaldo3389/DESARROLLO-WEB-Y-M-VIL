// Arranque común de microservicios: JSON acotado, correlationId, logs, /health y errores genéricos.
const crypto = require("crypto");
const express = require("express");
const log = require("./log");
const { HttpError } = require("./errors");

function createApp({ jsonLimit = "16kb" } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use((req, res, next) => {
    req.correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
    res.setHeader("X-Correlation-Id", req.correlationId);
    const t0 = Date.now();
    res.on("finish", () => log.info("req", { method: req.method, path: req.route ? req.baseUrl + req.route.path : req.path,
      status: res.statusCode, caller: req.caller, rol: req.user && req.user.rol, ms: Date.now() - t0, correlationId: req.correlationId }));
    next();
  });
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  const json = express.json({ limit: jsonLimit, strict: true });
  // los avisos firmados (/webhooks/*) se leen crudos para verificar la firma HMAC
  app.use((req, res, next) => (req.path.startsWith("/webhooks/") ? next() : json(req, res, next)));
  return app;
}

function finish(app) {
  app.use((req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.too.large") return res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Cuerpo demasiado grande" } });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: { code: "BAD_REQUEST", message: "JSON mal formado" } });
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
    }
    log.error("error no controlado", { msg: err.message, correlationId: req.correlationId });
    res.status(500).json({ error: { code: "INTERNAL", message: "Error interno" } });
  });
  return app;
}

function listen(app, port) {
  const host = process.env.HOST || "0.0.0.0";
  return app.listen(port, host, () => log.info("escuchando", { host, port }));
}

// envuelve handlers async
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { createApp, finish, listen, h };
