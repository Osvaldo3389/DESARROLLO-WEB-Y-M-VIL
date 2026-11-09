// API Gateway — único punto de entrada (HTTPS). Lista explícita de rutas, autenticación, roles,
// CSRF, rate limit, límites de cuerpo, timeouts, caché de carta y eliminación de cabeceras internas.
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "gateway";
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const { createSecretProvider } = require("../shared/secrets");
const { createJwks, verifyUserToken, safeEqual } = require("../shared/auth");
const log = require("../shared/log");
const ROUTES = require("./routes");

const DESTINOS = {
  auth: process.env.AUTH_URL || "http://auth:8086",
  inventory: process.env.INVENTORY_URL || "http://inventory:8081",
  orders: process.env.ORDERS_URL || "http://orders:8082",
  clients: process.env.CLIENTS_URL || "http://clients:8083",
  payments: process.env.PAYMENTS_URL || "http://payments:8084",
  analytics: process.env.ANALYTICS_URL || "http://analytics:8085",
  graphql: process.env.GRAPHQL_URL || "http://graphql:4000",
};
const FRONTEND = process.env.FRONTEND_URL || "http://frontend:80";
// Modo local: el gateway sirve directamente la carpeta del frontend (sus .php son HTML estático), sin Apache ni PHP
const FRONTEND_DIR = process.env.FRONTEND_DIR ? require("path").resolve(process.env.FRONTEND_DIR) : null;
const TIPOS = { ".php": "text/html; charset=utf-8", ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".map": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const WEBHOOK_CIDRS = (process.env.WEBHOOK_ALLOWED_CIDRS || "127.0.0.1/32,::1/128,172.16.0.0/12,10.0.0.0/8,192.168.0.0/16").split(",");
const HEADERS_SEGURIDAD = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'",
};

// ---------- utilidades ----------
const compilar = (r) => {
  const keys = [];
  const re = new RegExp("^" + r.path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
  return { ...r, re, keys, params: keys.length };
};
const RUTAS = ROUTES.map(compilar).sort((a, b) => a.params - b.params);

function buscarRuta(method, pathname) {
  const candidatas = RUTAS.filter((r) => r.re.test(pathname));
  if (!candidatas.length) return { ruta: null, permitidos: [] };
  const ruta = candidatas.find((r) => r.method === method);
  return { ruta, permitidos: [...new Set(candidatas.map((r) => r.method))] };
}
function leerCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
function ipEnCidr(ip, cidr) {
  ip = ip.replace(/^::ffff:/, "");
  const [base, bits] = cidr.split("/");
  if (ip.includes(":") || base.includes(":")) return ip === base;
  const toInt = (x) => x.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
  const mask = bits === "0" ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}
function enviar(res, status, body, headers = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(data);
}
const errorJson = (code, message) => ({ error: { code, message } });

// rate limit de ventana fija en memoria
const ventanas = new Map();
function permitir(clave, limite, ventanaSeg) {
  const ahora = Date.now();
  const v = ventanas.get(clave);
  if (!v || ahora > v.reinicio) { ventanas.set(clave, { n: 1, reinicio: ahora + ventanaSeg * 1000 }); return true; }
  v.n += 1;
  return v.n <= limite;
}
setInterval(() => { const a = Date.now(); for (const [k, v] of ventanas) if (a > v.reinicio) ventanas.delete(k); }, 60000).unref();

const cache = new Map();

async function main() {
  const secrets = createSecretProvider();
  const jwks = createJwks(DESTINOS.auth);
  const tokens = {};
  for (const s of Object.keys(DESTINOS)) tokens[s] = await secrets.obtener(`gw-${s}-token`);
  const webhookSecret = await secrets.obtener("servipag-webhook-secret");

  async function manejarApi(req, res, url, correlationId, cookiesReq) {
    const { ruta, permitidos } = buscarRuta(req.method, url.pathname);
    if (!ruta) {
      if (permitidos.length) return enviar(res, 405, errorJson("METHOD_NOT_ALLOWED", "Método no permitido"), { Allow: permitidos.join(", ") });
      return enviar(res, 404, errorJson("NOT_FOUND", "Ruta no encontrada"));
    }
    req.routeId = ruta.id;
    const params = {};
    const m = ruta.re.exec(url.pathname);
    ruta.keys.forEach((k, i) => { params[k] = m[i + 1]; });
    const ip = req.socket.remoteAddress || "";

    // ---- autenticación según política ----
    let user = null;
    if (ruta.access === "webhook") {
      if (!WEBHOOK_CIDRS.some((c) => ipEnCidr(ip, c))) return enviar(res, 403, errorJson("FORBIDDEN", "Origen no permitido"));
    } else if (ruta.access === "jwt" || ruta.access === "optional") {
      const at = cookiesReq.fk_at;
      if (at) {
        try { user = await verifyUserToken(at, jwks); } catch (e) {
          if (ruta.access === "jwt") return enviar(res, e.status || 401, errorJson(e.code || "UNAUTHORIZED", e.message));
        }
      }
      if (ruta.access === "jwt") {
        if (!user) return enviar(res, 401, errorJson("UNAUTHORIZED", "Debes iniciar sesión"));
        if (ruta.roles && !ruta.roles.includes(user.rol)) return enviar(res, 403, errorJson("FORBIDDEN", "No autorizado"));
      }
    }
    req.rol = user ? user.rol : "ANONIMO";

    // ---- rate limit ----
    if (ruta.rate) {
      const [lim, win, tipo] = ruta.rate;
      const clave = `${ruta.id}:${tipo === "user" && user ? user.sub : ip}`;
      if (!permitir(clave, lim, win)) return enviar(res, 429, errorJson("TOO_MANY_REQUESTS", "Demasiadas solicitudes, intenta en un momento"), { "Retry-After": String(win) });
    }

    // ---- CSRF (doble envío: cabecera = cookie) ----
    if (ruta.csrf) {
      const h = req.headers["x-csrf-token"];
      if (!h || !cookiesReq.fk_csrf || !safeEqual(String(h), cookiesReq.fk_csrf)) return enviar(res, 403, errorJson("CSRF", "Token anti-CSRF inválido"));
    }
    if (ruta.idempotency && !req.headers["idempotency-key"]) return enviar(res, 400, errorJson("BAD_REQUEST", "Falta Idempotency-Key"));

    // ---- caché de carta (solo anónimo) ----
    const cacheKey = ruta.cacheSec && !user ? `${ruta.id}:${url.pathname}${url.search}` : null;
    if (cacheKey) {
      const c = cache.get(cacheKey);
      if (c && c.exp > Date.now()) return enviar(res, c.status, c.body, { "X-Cache": "HIT" });
    }

    // ---- cuerpo ----
    const maxBytes = (ruta.maxKb || 8) * 1024;
    let body = null;
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const ct = req.headers["content-type"] || "";
      if (!ct.startsWith("application/json")) return enviar(res, 415, errorJson("UNSUPPORTED_MEDIA_TYPE", "Se requiere application/json"));
      const chunks = [];
      let total = 0;
      for await (const ch of req) {
        total += ch.length;
        if (total > maxBytes) return enviar(res, 413, errorJson("PAYLOAD_TOO_LARGE", "Cuerpo demasiado grande"));
        chunks.push(ch);
      }
      body = Buffer.concat(chunks);
      if (ruta.access === "webhook") {
        const firma = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(req.headers["x-signature"] || "");
        const ok = firma && Math.abs(Date.now() / 1000 - Number(firma[1])) <= 300 &&
          safeEqual(crypto.createHmac("sha256", webhookSecret).update(`${firma[1]}.${body.toString("utf8")}`).digest("hex"), firma[2]);
        if (!ok) return enviar(res, 401, errorJson("UNAUTHORIZED", "Firma inválida"));
      }
    }

    // ---- reenvío al destino interno (solo cabeceras permitidas) ----
    const destinoPath = ruta.targetPath.replace(/:(\w+)/g, (_, k) => encodeURIComponent(decodeURIComponent(params[k])));
    const headers = { Authorization: `Bearer ${tokens[ruta.target]}`, "X-Correlation-Id": correlationId };
    if (body) headers["Content-Type"] = "application/json";
    if (user) headers["X-User-Token"] = user.token;
    if (ruta.idempotency) headers["Idempotency-Key"] = String(req.headers["idempotency-key"]).slice(0, 64);
    if (ruta.access === "webhook") headers["X-Signature"] = req.headers["x-signature"];
    if (ruta.cookies) headers.Cookie = ruta.cookies.filter((c) => cookiesReq[c]).map((c) => `${c}=${cookiesReq[c]}`).join("; ");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ruta.timeoutMs || 2500);
    let r;
    try {
      r = await fetch(`${DESTINOS[ruta.target]}${destinoPath}${url.search}`, { method: req.method, headers, body, signal: ctrl.signal, redirect: "manual" });
    } catch (e) {
      return enviar(res, e.name === "AbortError" ? 504 : 503, errorJson(e.name === "AbortError" ? "GATEWAY_TIMEOUT" : "SERVICE_UNAVAILABLE", "Servicio no disponible"));
    } finally { clearTimeout(timer); }
    const data = Buffer.from(await r.arrayBuffer());
    const out = {};
    if (r.headers.get("content-type")) out["Content-Type"] = r.headers.get("content-type");
    if (ruta.idempotency && r.headers.get("idempotent-replayed")) out["Idempotent-Replayed"] = "true";
    if (ruta.setCookie) {
      const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
      if (sc.length) out["Set-Cookie"] = [...(res.getHeader("Set-Cookie") || []), ...sc];
    }
    if (cacheKey && r.status === 200) cache.set(cacheKey, { status: 200, body: data, exp: Date.now() + ruta.cacheSec * 1000 });
    if (cacheKey) out["X-Cache"] = "MISS";
    res.writeHead(r.status, out);
    res.end(data);
  }

  // Frontend PHP (solo GET/HEAD) servido detrás del gateway: mismo origen que la API
  async function manejarFrontend(req, res, url) {
    if (!["GET", "HEAD"].includes(req.method)) return enviar(res, 405, errorJson("METHOD_NOT_ALLOWED", "Método no permitido"));
    if (url.pathname.includes("..")) return enviar(res, 400, errorJson("BAD_REQUEST", "Ruta inválida"));
    if (FRONTEND_DIR) return servirEstatico(req, res, url);
    try {
      const r = await fetch(`${FRONTEND}${url.pathname === "/" ? "/index.php" : url.pathname}${url.search}`, { method: req.method, redirect: "manual" });
      const out = {};
      ["content-type", "cache-control", "last-modified", "etag", "location"].forEach((hh) => { if (r.headers.get(hh)) out[hh] = r.headers.get(hh); });
      res.writeHead(r.status, out);
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch {
      enviar(res, 503, errorJson("SERVICE_UNAVAILABLE", "Frontend no disponible"));
    }
  }

  function servirEstatico(req, res, url) {
    const path = require("path");
    const fs = require("fs");
    const noEncontrado = () => { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); res.end(req.method === "HEAD" ? undefined : "<h1>404</h1><p>Página no encontrada</p>"); };
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { return enviar(res, 400, errorJson("BAD_REQUEST", "Ruta inválida")); }
    if (rel === "/") rel = "/index.php";
    if (rel.split("/").some((seg) => seg.startsWith(".")) || rel.includes("\\") || rel.includes("\0")) return noEncontrado();
    const archivo = path.resolve(FRONTEND_DIR, "." + rel);
    if (!archivo.startsWith(FRONTEND_DIR + path.sep)) return noEncontrado();
    const tipo = TIPOS[path.extname(archivo).toLowerCase()];
    let st;
    try { st = fs.statSync(archivo); } catch { return noEncontrado(); }
    if (!st.isFile() || !tipo) return noEncontrado();
    res.writeHead(200, { "Content-Type": tipo, "Content-Length": st.size, "Cache-Control": "no-cache", "Last-Modified": st.mtime.toUTCString() });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(archivo).on("error", () => res.destroy()).pipe(res);
  }

  async function handler(req, res) {
    const t0 = Date.now();
    const correlationId = crypto.randomUUID();
    Object.entries(HEADERS_SEGURIDAD).forEach(([k, v]) => res.setHeader(k, v));
    res.setHeader("X-Correlation-Id", correlationId);
    res.on("finish", () => log.info("req", { route: req.routeId || (req.url.startsWith("/api/") ? "-" : "frontend"), method: req.method,
      path: req.url.split("?")[0], status: res.statusCode, rol: req.rol, ms: Date.now() - t0, correlationId }));
    try {
      const url = new URL(req.url, "https://localhost");
      const cookiesReq = leerCookies(req);
      // cookie anti-CSRF (no HttpOnly para que el frontend la copie a la cabecera)
      if (!cookiesReq.fk_csrf) res.setHeader("Set-Cookie", [`fk_csrf=${crypto.randomBytes(24).toString("base64url")}; Path=/; Secure; SameSite=Strict`]);
      if (url.pathname === "/health") return enviar(res, 200, { status: "ok" });
      if (url.pathname.startsWith("/api/")) return await manejarApi(req, res, url, correlationId, cookiesReq);
      return await manejarFrontend(req, res, url);
    } catch (e) {
      log.error("error en gateway", { msg: e.message, correlationId });
      if (!res.headersSent) enviar(res, 500, errorJson("INTERNAL", "Error interno"));
    }
  }

  const port = Number(process.env.PORT || 8443);
  const host = process.env.HOST || "0.0.0.0";
  if (process.env.TLS === "off") {
    http.createServer(handler).listen(port, host, () => log.info("escuchando (HTTP, solo pruebas)", { port }));
  } else {
    const server = https.createServer({ cert: await secrets.obtener("tls-gateway-cert"), key: await secrets.obtener("tls-gateway-key"), minVersion: "TLSv1.2" }, handler);
    server.headersTimeout = 10000;
    server.requestTimeout = 15000;
    server.listen(port, host, () => log.info("escuchando (HTTPS)", { host, port }));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
