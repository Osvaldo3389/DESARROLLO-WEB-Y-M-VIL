// Proveedor de correo de SANDBOX (simula una API transaccional). No forma parte del backend propio.
// POST /api/send con API key (solo envío) · GET / bandeja HTML para revisar correos en desarrollo.
process.env.SERVICE_NAME = "mail-sandbox";
const { createApp, finish, listen, h } = require("../../shared/service");
const { createSecretProvider } = require("../../shared/secrets");
const { safeEqual } = require("../../shared/auth");
const { E } = require("../../shared/errors");

async function main() {
  const secrets = createSecretProvider();
  const keys = [await secrets.obtener("mail-api-key-clients"), await secrets.obtener("mail-api-key-payments")];
  const mensajes = [];
  const app = createApp();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  app.post("/api/send", h(async (req, res) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!m || !keys.some((k) => safeEqual(k, m[1]))) throw E.unauthorized("API key inválida");
    const { to, subject, text } = req.body || {};
    if (typeof to !== "string" || typeof subject !== "string" || typeof text !== "string") throw E.badRequest();
    if (/rebota|noexiste/i.test(to)) throw E.unprocessable("Buzón inexistente", "MAILBOX_NOT_FOUND");
    mensajes.unshift({ id: mensajes.length + 1, to, subject, text, at: new Date().toISOString() });
    res.status(202).json({ id: mensajes[0].id, estado: "ENCOLADO" });
  }));
  app.get("/api/messages", (req, res) => res.json(mensajes.filter((x) => !req.query.to || x.to === req.query.to)));
  app.get("/", (req, res) => {
    res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Correo sandbox</title>
      <style>body{font-family:Arial;margin:24px;color:#111}div{border:1px solid #ccc;border-radius:8px;padding:12px;margin:10px 0}small{color:#555}a{word-break:break-all}</style>
      <h2>Bandeja de correo (sandbox de desarrollo)</h2>${mensajes.map((x) => `<div><small>${esc(x.at)} · para ${esc(x.to)}</small><h4>${esc(x.subject)}</h4>
      <p>${esc(x.text).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>")}</p></div>`).join("") || "<p>Sin correos.</p>"}`);
  });
  finish(app);
  listen(app, Number(process.env.PORT || 8025));
}
main().catch((e) => { console.error(e); process.exit(1); });
