// Logger JSON. Nunca registra cuerpos, cookies, tokens, RUN ni direcciones.
const SERVICE = process.env.SERVICE_NAME || "service";
const PROHIBIDOS = /(password|token|cookie|authorization|secret)|^(run|calle|numero|email|telefono|direccion)$/i;

function limpiar(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = PROHIBIDOS.test(k) ? "[omitido]" : v;
  return out;
}

function log(level, msg, extra = {}) {
  if (process.env.LOG_LEVEL === "silent") return;
  const line = { ts: new Date().toISOString(), level, service: SERVICE, msg, ...limpiar(extra) };
  process.stdout.write(JSON.stringify(line) + "\n");
}

module.exports = {
  info: (m, e) => log("info", m, e),
  warn: (m, e) => log("warn", m, e),
  error: (m, e) => log("error", m, e),
};
