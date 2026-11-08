// Identidad: tokens de servicio (quién llama) + JWT de usuario (en nombre de quién).
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { E } = require("./errors");

const ISSUER = "fukusuke-auth";
const AUDIENCE = "fukusuke-api";

// ---- JWKS (clave pública de Auth Service) ----
function createJwks(authUrl, ttlMs = 10 * 60 * 1000) {
  let keys = new Map();
  let fetchedAt = 0;
  async function refresh() {
    const r = await fetch(`${authUrl}/.well-known/jwks.json`);
    if (!r.ok) throw new Error("JWKS no disponible");
    const j = await r.json();
    const m = new Map();
    for (const k of j.keys) m.set(k.kid, crypto.createPublicKey({ key: k, format: "jwk" }));
    keys = m;
    fetchedAt = Date.now();
  }
  return {
    async getKey(kid) {
      if (!keys.has(kid) || Date.now() - fetchedAt > ttlMs) {
        try { await refresh(); } catch (e) { if (!keys.size) throw E.unavailable("No se pudo validar la sesión"); }
      }
      const key = keys.get(kid);
      if (!key) throw E.unauthorized("Token con clave desconocida");
      return key;
    },
  };
}

async function verifyUserToken(token, jwks) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || decoded.header.alg !== "RS256") throw E.unauthorized("Token inválido");
  const key = await jwks.getKey(decoded.header.kid);
  try {
    const p = jwt.verify(token, key, { algorithms: ["RS256"], issuer: ISSUER, audience: AUDIENCE });
    return { sub: p.sub, rol: p.rol, nombre: p.nombre, token };
  } catch (err) {
    const e = E.unauthorized(err.name === "TokenExpiredError" ? "Sesión expirada" : "Token inválido");
    if (err.name === "TokenExpiredError") e.code = "TOKEN_EXPIRED";
    throw e;
  }
}

// ---- Tokens de servicio ----
function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// tokens: [{ caller: 'gateway', value: '...' }, ...]
function serviceAuth(tokens) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const m = /^Bearer (.+)$/.exec(h);
    if (!m) return next(E.unauthorized("Falta credencial de servicio"));
    const t = tokens.find((x) => safeEqual(x.value, m[1]));
    if (!t) return next(E.unauthorized("Credencial de servicio inválida"));
    req.caller = t.caller;
    next();
  };
}

const allowCallers = (...callers) => (req, res, next) =>
  callers.includes(req.caller) ? next() : next(E.forbidden("Llamador no autorizado para esta operación"));

// Lee X-User-Token (JWT ya validado por el gateway) y lo re-verifica con la JWKS
function userContext(jwks) {
  return async (req, res, next) => {
    const t = req.headers["x-user-token"];
    if (!t) { req.user = null; return next(); }
    try { req.user = await verifyUserToken(t, jwks); next(); } catch (e) { next(e); }
  };
}

const requireUser = (...roles) => (req, res, next) => {
  if (!req.user) return next(E.unauthorized());
  if (roles.length && !roles.includes(req.user.rol)) return next(E.forbidden());
  next();
};

module.exports = { ISSUER, AUDIENCE, createJwks, verifyUserToken, serviceAuth, allowCallers, userContext, requireUser, safeEqual };
