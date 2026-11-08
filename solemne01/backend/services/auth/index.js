// Auth Service — credenciales, emisión/rotación/revocación de tokens y JWKS pública.
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "auth";
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createApp, finish, listen, h } = require("../../shared/service");
const { createSecretProvider } = require("../../shared/secrets");
const { createPool, tx } = require("../../shared/db");
const { serviceAuth, allowCallers, userContext, requireUser, ISSUER, AUDIENCE } = require("../../shared/auth");
const { E } = require("../../shared/errors");
const { isEmail, isStr, isUUID, assertObject } = require("../../shared/validate");
const { sha256, tokenAleatorio } = require("../../shared/cifrado");

const ACCESS_TTL = 15 * 60;            // 15 min
const REFRESH_TTL = 7 * 24 * 3600;     // 7 días
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
const BCRYPT_COSTO = Number(process.env.BCRYPT_COST || 12);

async function main() {
  const secrets = createSecretProvider();
  const pool = await createPool(secrets, "auth");
  const privatePem = await secrets.obtener("auth-jwt-private-key");
  const privateKey = crypto.createPrivateKey(privatePem);
  const publicJwk = crypto.createPublicKey(privateKey).export({ format: "jwk" });
  const kid = sha256(JSON.stringify(publicJwk)).slice(0, 16);
  const tokens = [
    { caller: "gateway", value: await secrets.obtener("gw-auth-token") },
    { caller: "clients", value: await secrets.obtener("clients-auth-token") },
  ];

  const HASH_FICTICIO = bcrypt.hashSync(crypto.randomUUID(), BCRYPT_COSTO);
  const app = createApp();

  // JWKS pública (solo clave pública; la privada nunca sale del servicio)
  app.get("/.well-known/jwks.json", (req, res) => res.json({ keys: [{ ...publicJwk, kid, alg: "RS256", use: "sig" }] }));

  // Auth re-verifica el JWT del usuario con su propia clave pública (mismo control que los demás servicios con la JWKS)
  const publicKey = crypto.createPublicKey(privateKey);
  const jwksLocal = { getKey: async (k) => { if (k !== kid) throw E.unauthorized("Token con clave desconocida"); return publicKey; } };
  app.use(serviceAuth(tokens), userContext(jwksLocal));

  const cookie = (name, value, maxAge, pathAttr) =>
    `${name}=${value}; Path=${pathAttr}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

  function emitirAccess(c) {
    return jwt.sign({ rol: c.rol, nombre: c.nombre }, privateKey, {
      algorithm: "RS256", keyid: kid, subject: c.cuenta_id, issuer: ISSUER, audience: AUDIENCE, expiresIn: ACCESS_TTL,
    });
  }
  async function emitirRefresh(conn, cuentaId, familia) {
    const rt = tokenAleatorio(32);
    await conn.query("INSERT INTO refresh_tokens (token_hash, cuenta_id, familia, expira_en) VALUES (?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))",
      [sha256(rt), cuentaId, familia, REFRESH_TTL]);
    return rt;
  }
  function setSesion(res, at, rt) {
    res.setHeader("Set-Cookie", [cookie("fk_at", at, ACCESS_TTL, "/"), cookie("fk_rt", rt, REFRESH_TTL, "/api/v1/auth")]);
  }
  const leerCookie = (req, name) => {
    const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie || "");
    return m ? m[1] : null;
  };

  // R05 — S05 iniciar sesión
  app.post("/login", allowCallers("gateway"), h(async (req, res) => {
    assertObject(req.body);
    const { email, password } = req.body;
    if (!isEmail(email) || !isStr(password, 1, 200)) throw E.unauthorized("Credenciales inválidas");
    const [[c]] = await pool.query("SELECT * FROM cuentas WHERE email = ?", [email.toLowerCase()]);
    // mismo mensaje y costo de cómputo si la cuenta no existe (evita enumeración)
    const hash = c && c.password_hash ? c.password_hash : HASH_FICTICIO;
    if (c && c.bloqueado_hasta && new Date(c.bloqueado_hasta + "Z") > new Date()) throw E.tooMany("Cuenta bloqueada temporalmente. Intenta más tarde.");
    const ok = await bcrypt.compare(password, hash);
    if (!c || !ok || !c.password_hash) {
      if (c) {
        const intentos = c.intentos_fallidos + 1;
        await pool.query("UPDATE cuentas SET intentos_fallidos = ?, bloqueado_hasta = IF(? >= ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), NULL) WHERE cuenta_id = ?",
          [intentos >= MAX_INTENTOS ? 0 : intentos, intentos, MAX_INTENTOS, BLOQUEO_MIN, c.cuenta_id]);
        if (intentos >= MAX_INTENTOS) throw E.tooMany("Cuenta bloqueada temporalmente. Intenta más tarde.");
      }
      throw E.unauthorized("Credenciales inválidas");
    }
    if (!c.email_verificado) throw E.forbidden("Debes confirmar tu correo antes de ingresar");
    if (c.estado !== "ACTIVA") throw E.forbidden("Cuenta no habilitada");
    await pool.query("UPDATE cuentas SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE cuenta_id = ?", [c.cuenta_id]);
    const rt = await emitirRefresh(pool, c.cuenta_id, crypto.randomUUID());
    setSesion(res, emitirAccess(c), rt);
    res.json({ nombre: c.nombre, rol: c.rol });
  }));

  // R20 — renovar sesión con rotación; reutilización => revoca toda la familia
  app.post("/refresh", allowCallers("gateway"), h(async (req, res) => {
    const rt = leerCookie(req, "fk_rt");
    if (!rt) throw E.unauthorized("Sin sesión");
    const out = await tx(pool, async (conn) => {
      const [[t]] = await conn.query("SELECT * FROM refresh_tokens WHERE token_hash = ? FOR UPDATE", [sha256(rt)]);
      if (!t) throw E.unauthorized("Sesión inválida");
      if (t.revocado) {
        await conn.query("UPDATE refresh_tokens SET revocado = 1 WHERE familia = ?", [t.familia]);
        return { reuse: true };
      }
      if (new Date(t.expira_en + "Z") < new Date()) throw E.unauthorized("Sesión expirada");
      await conn.query("UPDATE refresh_tokens SET revocado = 1 WHERE token_hash = ?", [t.token_hash]);
      const [[c]] = await conn.query("SELECT * FROM cuentas WHERE cuenta_id = ?", [t.cuenta_id]);
      if (!c || c.estado !== "ACTIVA") throw E.unauthorized("Sesión inválida");
      const nuevo = await emitirRefresh(conn, c.cuenta_id, t.familia);
      return { c, nuevo };
    });
    if (out.reuse) throw E.unauthorized("Sesión revocada por reutilización de token");
    setSesion(res, emitirAccess(out.c), out.nuevo);
    res.json({ nombre: out.c.nombre, rol: out.c.rol });
  }));

  app.post("/logout", allowCallers("gateway"), h(async (req, res) => {
    const rt = leerCookie(req, "fk_rt");
    if (rt) await pool.query("UPDATE refresh_tokens SET revocado = 1 WHERE token_hash = ?", [sha256(rt)]);
    res.setHeader("Set-Cookie", [cookie("fk_at", "", 0, "/"), cookie("fk_rt", "", 0, "/api/v1/auth")]);
    res.status(204).end();
  }));

  // ---- Contratos internos (solo clients) ----
  app.post("/internal/accounts", allowCallers("clients"), h(async (req, res) => {
    assertObject(req.body);
    const { email, password, nombre } = req.body;
    if (!isEmail(email) || !isStr(nombre, 2, 120)) throw E.badRequest("Datos de cuenta inválidos");
    if (password !== null && password !== undefined && !isStr(password, 10, 200)) throw E.badRequest("Contraseña inválida");
    const cuentaId = crypto.randomUUID();
    const passwordHash = password ? await bcrypt.hash(password, BCRYPT_COSTO) : null;
    try {
      await pool.query("INSERT INTO cuentas (cuenta_id, email, nombre, password_hash, rol) VALUES (?,?,?,?, 'CLIENTE')",
        [cuentaId, email.toLowerCase(), nombre.trim(), passwordHash]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw E.conflict("Cuenta ya registrada");
      throw e;
    }
    res.status(201).json({ cuentaId });
  }));

  app.delete("/internal/accounts/:id", allowCallers("clients"), h(async (req, res) => {
    if (!isUUID(req.params.id)) throw E.badRequest();
    await pool.query("DELETE FROM cuentas WHERE cuenta_id = ? AND email_verificado = 0", [req.params.id]);
    res.status(204).end();
  }));

  app.post("/internal/accounts/:id/verify", allowCallers("clients"), h(async (req, res) => {
    if (!isUUID(req.params.id)) throw E.badRequest();
    const password = req.body && req.body.password;
    const [[c]] = await pool.query("SELECT cuenta_id, password_hash FROM cuentas WHERE cuenta_id = ?", [req.params.id]);
    if (!c) throw E.notFound();
    if (!c.password_hash && !isStr(password, 10, 200)) throw E.badRequest("Debes definir una contraseña de al menos 10 caracteres");
    const nuevoHash = !c.password_hash ? await bcrypt.hash(password, BCRYPT_COSTO) : c.password_hash;
    await pool.query("UPDATE cuentas SET email_verificado = 1, estado = 'ACTIVA', password_hash = ? WHERE cuenta_id = ?", [nuevoHash, c.cuenta_id]);
    res.json({ estado: "ACTIVO" });
  }));

  // ---- CU2 Mantenedor de usuarios del personal (S26–S28, solo ADMIN) ----
  const ROLES_PERSONAL = ["ADMIN", "DESPACHO", "DUENO"];
  const usuarioDTO = (c) => ({ cuentaId: c.cuenta_id, nombre: c.nombre, email: c.email, rol: c.rol, estado: c.estado, creadoEn: c.creado_en });
  const revocarSesiones = (conn, cuentaId) => conn.query("UPDATE refresh_tokens SET revocado = 1 WHERE cuenta_id = ? AND revocado = 0", [cuentaId]);

  // S26 — listar usuarios del personal (nunca devuelve hashes)
  app.get("/users", allowCallers("gateway"), requireUser("ADMIN"), h(async (req, res) => {
    const [rows] = await pool.query("SELECT cuenta_id, nombre, email, rol, estado, creado_en FROM cuentas WHERE rol IN ('ADMIN','DESPACHO','DUENO') ORDER BY rol, nombre");
    res.json({ items: rows.map(usuarioDTO) });
  }));

  // S27 — crear usuario del personal con contraseña inicial definida por el administrador (hash bcrypt; no se devuelve)
  app.post("/users", allowCallers("gateway"), requireUser("ADMIN"), h(async (req, res) => {
    assertObject(req.body);
    const { nombre, email, rol, password } = req.body;
    const err = [];
    if (!isStr(nombre, 2, 120)) err.push("nombre");
    if (!isEmail(email)) err.push("email");
    if (!ROLES_PERSONAL.includes(rol)) err.push("rol");
    if (!isStr(password, 10, 200)) err.push("password");
    if (err.length) throw E.badRequest("Datos de usuario inválidos", { campos: err });
    const cuentaId = crypto.randomUUID();
    try {
      await pool.query("INSERT INTO cuentas (cuenta_id, email, nombre, password_hash, rol, email_verificado, estado) VALUES (?,?,?,?,?,1,'ACTIVA')",
        [cuentaId, email.toLowerCase(), nombre.trim(), await bcrypt.hash(password, BCRYPT_COSTO), rol]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw E.conflict("Ya existe una cuenta con ese correo");
      throw e;
    }
    const [[c]] = await pool.query("SELECT * FROM cuentas WHERE cuenta_id = ?", [cuentaId]);
    res.status(201).json(usuarioDTO(c));
  }));

  // S28 — cambiar rol o habilitar/deshabilitar; deshabilitar revoca todas las sesiones de esa cuenta
  app.patch("/users/:id", allowCallers("gateway"), requireUser("ADMIN"), h(async (req, res) => {
    if (!isUUID(req.params.id)) throw E.badRequest("id inválido");
    assertObject(req.body);
    const { rol, estado } = req.body;
    if (rol === undefined && estado === undefined) throw E.badRequest("Indica rol o estado");
    if (rol !== undefined && !ROLES_PERSONAL.includes(rol)) throw E.badRequest("Rol inválido");
    if (estado !== undefined && !["ACTIVA", "BLOQUEADA"].includes(estado)) throw E.badRequest("Estado inválido");
    if (req.params.id === req.user.sub) throw E.conflict("No puedes cambiar el rol ni deshabilitar tu propia cuenta");
    const out = await tx(pool, async (conn) => {
      const [[c]] = await conn.query("SELECT * FROM cuentas WHERE cuenta_id = ? AND rol IN ('ADMIN','DESPACHO','DUENO') FOR UPDATE", [req.params.id]);
      if (!c) throw E.notFound("Usuario no encontrado");
      const nuevoRol = rol || c.rol;
      const nuevoEstado = estado || c.estado;
      if (c.rol === "ADMIN" && (nuevoRol !== "ADMIN" || nuevoEstado !== "ACTIVA")) {
        const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM cuentas WHERE rol = 'ADMIN' AND estado = 'ACTIVA' AND cuenta_id <> ?", [c.cuenta_id]);
        if (n === 0) throw E.conflict("Debe quedar al menos un administrador activo");
      }
      await conn.query("UPDATE cuentas SET rol = ?, estado = ? WHERE cuenta_id = ?", [nuevoRol, nuevoEstado, c.cuenta_id]);
      if (nuevoEstado !== "ACTIVA" || nuevoRol !== c.rol) await revocarSesiones(conn, c.cuenta_id);
      return { ...c, rol: nuevoRol, estado: nuevoEstado };
    });
    res.json(usuarioDTO(out));
  }));

  // ---- Contratos internos para CU3 (solo clients) ----
  // Estado de varias cuentas de cliente (para el listado del mantenedor)
  app.get("/internal/accounts", allowCallers("clients"), h(async (req, res) => {
    const ids = String(req.query.ids || "").split(",").filter(Boolean);
    if (!ids.length || ids.length > 100 || !ids.every(isUUID)) throw E.badRequest("ids inválidos");
    const [rows] = await pool.query("SELECT cuenta_id, estado, email_verificado FROM cuentas WHERE rol = 'CLIENTE' AND cuenta_id IN (?)", [ids]);
    res.json(rows.map((r) => ({ cuentaId: r.cuenta_id, estado: r.estado, emailVerificado: !!r.email_verificado })));
  }));

  // Habilitar/deshabilitar o renombrar una cuenta de cliente; deshabilitar revoca sus sesiones
  app.patch("/internal/accounts/:id", allowCallers("clients"), h(async (req, res) => {
    if (!isUUID(req.params.id)) throw E.badRequest();
    assertObject(req.body);
    const { estado, nombre } = req.body;
    if (estado !== undefined && !["ACTIVA", "BLOQUEADA"].includes(estado)) throw E.badRequest("Estado inválido");
    if (nombre !== undefined && !isStr(nombre, 2, 120)) throw E.badRequest("Nombre inválido");
    const out = await tx(pool, async (conn) => {
      const [[c]] = await conn.query("SELECT * FROM cuentas WHERE cuenta_id = ? AND rol = 'CLIENTE' FOR UPDATE", [req.params.id]);
      if (!c) throw E.notFound();
      // reactivar una cuenta que nunca confirmó su correo la deja PENDIENTE (RF11 se mantiene)
      const nuevoEstado = estado === undefined ? c.estado : estado === "ACTIVA" && !c.email_verificado ? "PENDIENTE" : estado;
      await conn.query("UPDATE cuentas SET estado = ?, nombre = ? WHERE cuenta_id = ?", [nuevoEstado, nombre ? nombre.trim() : c.nombre, c.cuenta_id]);
      if (nuevoEstado !== "ACTIVA") await revocarSesiones(conn, c.cuenta_id);
      return nuevoEstado;
    });
    res.json({ cuentaId: req.params.id, estado: out });
  }));

  // Anonimizar la cuenta de un cliente que pidió eliminar sus datos (S25): sin correo real, sin contraseña, sin sesiones
  app.post("/internal/accounts/:id/anonimizar", allowCallers("clients"), h(async (req, res) => {
    if (!isUUID(req.params.id)) throw E.badRequest();
    await tx(pool, async (conn) => {
      const [[c]] = await conn.query("SELECT cuenta_id FROM cuentas WHERE cuenta_id = ? AND rol = 'CLIENTE' FOR UPDATE", [req.params.id]);
      if (!c) throw E.notFound();
      await conn.query("UPDATE cuentas SET email = ?, nombre = 'Cliente eliminado', password_hash = NULL, estado = 'BLOQUEADA' WHERE cuenta_id = ?",
        [`eliminado-${c.cuenta_id}@fukusuke.invalid`, c.cuenta_id]);
      await revocarSesiones(conn, c.cuenta_id);
    });
    res.status(204).end();
  }));

  finish(app);
  listen(app, Number(process.env.PORT || 8086));
}

main().catch((e) => { console.error(e); process.exit(1); });
