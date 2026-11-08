// Cliente HTTP interno con timeout, token de servicio y propagación de identidad verificada.
const { E } = require("./errors");

async function callService(url, { method = "GET", token, userToken, body, timeoutMs = 2000, correlationId, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (userToken) h["X-User-Token"] = userToken;
  if (correlationId) h["X-Correlation-Id"] = correlationId;
  if (body !== undefined) h["Content-Type"] = "application/json";
  try {
    const r = await fetch(url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: r.status, body: json };
  } catch (err) {
    throw E.unavailable(`Dependencia no disponible (${new URL(url).host})`);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callService };
