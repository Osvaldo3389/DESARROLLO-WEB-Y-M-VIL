// clients — registro, perfil, direcciones (cifradas), verificación de correo (RF11) y contacto.
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "clients";
const crypto = require("crypto");
const { createApp, finish, listen, h } = require("../../shared/service");
const { createSecretProvider } = require("../../shared/secrets");
const { createPool, tx } = require("../../shared/db");
const { serviceAuth, allowCallers, createJwks, userContext, requireUser } = require("../../shared/auth");
const { callService } = require("../../shared/http");
const { E } = require("../../shared/errors");
const log = require("../../shared/log");
const V = require("../../shared/validate");
const { crearCifrador, sha256, tokenAleatorio } = require("../../shared/cifrado");

const SEXOS = ["F", "M", "X"];
const AUTH = process.env.AUTH_URL || "http://auth:8086";
const MAIL = process.env.MAIL_URL || "http://mail-sandbox:8025";
const PUBLIC_URL = process.env.PUBLIC_URL || "https://localhost";

async function main() {
  const secrets = createSecretProvider();
  const pool = await createPool(secrets, "clients");
  const jwks = createJwks(AUTH);
  const cif = crearCifrador(await secrets.obtener("rut-encryption-key"));
  const clientsAuthToken = await secrets.obtener("clients-auth-token");
  const mailKey = await secrets.obtener("mail-api-key-clients");
  const tokens = [
    { caller: "gateway", value: await secrets.obtener("gw-clients-token") },
    { caller: "orders", value: await secrets.obtener("orders-clients-token") },
    { caller: "payments", value: await secrets.obtener("payments-clients-token") },
  ];

  // Envío de correo con reintentos (si el proveedor falla el registro no se pierde)
  async function encolarCorreo(destinatario, asunto, cuerpo) {
    const id = crypto.randomUUID();
    await pool.query("INSERT INTO correos_pendientes (correo_id, destinatario, asunto, cuerpo) VALUES (?,?,?,?)", [id, destinatario, asunto, cuerpo]);
    enviarPendientes().catch(() => {});
  }
  async function enviarPendientes() {
    const [rows] = await pool.query("SELECT * FROM correos_pendientes WHERE enviado = 0 AND intentos < 3 ORDER BY creado_en LIMIT 20");
    for (const c of rows) {
      try {
        const r = await callService(`${MAIL}/api/send`, { method: "POST", token: mailKey, body: { to: c.destinatario, subject: c.asunto, text: c.cuerpo }, timeoutMs: 3000 });
        if (r.status !== 202) throw new Error(`mail ${r.status}`);
        await pool.query("UPDATE correos_pendientes SET enviado = 1, cuerpo = '[enviado]' WHERE correo_id = ?", [c.correo_id]);
      } catch (e) {
        await pool.query("UPDATE correos_pendientes SET intentos = intentos + 1 WHERE correo_id = ?", [c.correo_id]);
        log.warn("correo no enviado, se reintentará", { correoId: c.correo_id });
      }
    }
  }
  setInterval(() => enviarPendientes().catch(() => {}), Number(process.env.MAIL_RETRY_MS || 30000)).unref();

  // Retención: mensajes de contacto 12 meses; tokens de verificación usados o vencidos se eliminan
  const retencion = () => Promise.all([
    pool.query("DELETE FROM mensajes_contacto WHERE recibido_en < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 12 MONTH)"),
    pool.query("DELETE FROM tokens_verificacion WHERE usado = 1 OR expira_en < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)"),
  ]).catch(() => {});
  retencion();
  setInterval(retencion, 24 * 3600 * 1000).unref();

  const app = createApp();
  app.use(serviceAuth(tokens), userContext(jwks));

  function validarRegistro(b, esPresencial) {
    V.assertObject(b);
    const err = [];
    if (!V.runValido(b.run)) err.push("run");
    if (!V.isStr(b.nombre, 2, 120)) err.push("nombre");
    if (!V.isEmail(b.email)) err.push("email");
    if (!esPresencial && !V.isStr(b.password, 10, 200)) err.push("password");
    if (!V.isStr(b.telefono, 8, 20) || !/^\+?[\d\s]{8,20}$/.test(b.telefono)) err.push("telefono");
    if (!V.isDate(b.fechaNacimiento)) err.push("fechaNacimiento");
    if (!SEXOS.includes(b.sexo)) err.push("sexo");
    const d = b.direccion || {};
    if (!V.isStr(d.calle, 2, 120) || !V.isStr(String(d.numero || ""), 1, 20) || !V.isStr(d.comuna, 2, 60) || !V.isStr(d.provincia, 2, 60) || !V.isStr(d.region, 2, 60)) err.push("direccion");
    if (err.length) throw E.badRequest("Datos de registro inválidos", { campos: err });
  }

  // S03 — registro (anónimo) o registro presencial (ADMIN, sin contraseña)
  app.post("/clients", allowCallers("gateway"), h(async (req, res) => {
    if (req.user && req.user.rol !== "ADMIN") throw E.forbidden("Ya tienes una cuenta");
    const presencial = !!(req.user && req.user.rol === "ADMIN");
    const b = req.body;
    validarRegistro(b, presencial);
    const runNorm = V.normalizarRun(b.run);
    const runHash = cif.hash(runNorm);
    const [[dup]] = await pool.query("SELECT 1 FROM clientes WHERE run_hash = ?", [runHash]);
    if (dup) throw E.conflict("No fue posible registrar con esos datos");

    const r = await callService(`${AUTH}/internal/accounts`, { method: "POST", token: clientsAuthToken, correlationId: req.correlationId,
      body: { email: b.email, nombre: b.nombre, password: presencial ? null : b.password } });
    if (r.status === 409) throw E.conflict("No fue posible registrar con esos datos");
    if (r.status !== 201) throw E.unavailable("No fue posible crear la cuenta");
    const cuentaId = r.body.cuentaId;
    const token = tokenAleatorio(32);
    try {
      await tx(pool, async (conn) => {
        await conn.query(`INSERT INTO clientes (cliente_id, cuenta_id, run_cifrado, run_hash, nombre, email, telefono_cifrado, fecha_nac_cifrada, sexo_cifrado)
          VALUES (?,?,?,?,?,?,?,?,?)`, [cuentaId, cuentaId, cif.cifrar(runNorm), runHash, b.nombre.trim(), b.email.toLowerCase(),
          cif.cifrar(b.telefono), cif.cifrar(b.fechaNacimiento), cif.cifrar(b.sexo)]);
        const d = b.direccion;
        await conn.query(`INSERT INTO direcciones (direccion_id, cliente_id, calle_cifrada, numero_cifrado, comuna, provincia, region) VALUES (?,?,?,?,?,?,?)`,
          [crypto.randomUUID(), cuentaId, cif.cifrar(d.calle.trim()), cif.cifrar(String(d.numero).trim()), d.comuna.trim(), d.provincia.trim(), d.region.trim()]);
        await conn.query("INSERT INTO tokens_verificacion (token_hash, cuenta_id, expira_en, requiere_password) VALUES (?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR), ?)",
          [sha256(token), cuentaId, presencial ? 1 : 0]);
      });
    } catch (e) {
      // compensación: se elimina la cuenta recién creada en Auth
      await callService(`${AUTH}/internal/accounts/${cuentaId}`, { method: "DELETE", token: clientsAuthToken }).catch(() => {});
      if (e.code === "ER_DUP_ENTRY") throw E.conflict("No fue posible registrar con esos datos");
      throw e;
    }
    const enlace = `${PUBLIC_URL}/registro.php?verificar=${token}`;
    await encolarCorreo(b.email, "Confirma tu correo — Fukusuke Sushi-Delivery",
      `Hola ${b.nombre}. Para activar tu cuenta abre este enlace (vence en 24 horas): ${enlace}`);
    res.status(201).json({ clienteId: cuentaId, email: b.email.toLowerCase(), estado: "PENDIENTE_VERIFICACION" });
  }));

  // S04 — confirmar correo con token de un solo uso
  app.post("/email-verification", allowCallers("gateway"), h(async (req, res) => {
    V.assertObject(req.body);
    const { token, password } = req.body;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw E.badRequest("Token mal formado");
    const fila = await tx(pool, async (conn) => {
      const [[t]] = await conn.query("SELECT * FROM tokens_verificacion WHERE token_hash = ? FOR UPDATE", [sha256(token)]);
      if (!t || t.usado || new Date(t.expira_en + "Z") < new Date()) throw E.gone("El enlace venció o ya fue utilizado");
      if (t.requiere_password && !V.isStr(password, 10, 200)) throw E.badRequest("Debes definir una contraseña de al menos 10 caracteres");
      const r = await callService(`${AUTH}/internal/accounts/${t.cuenta_id}/verify`, { method: "POST", token: clientsAuthToken,
        body: t.requiere_password ? { password } : {} });
      if (r.status !== 200) throw E.unavailable("No fue posible activar la cuenta");
      await conn.query("UPDATE tokens_verificacion SET usado = 1 WHERE token_hash = ?", [t.token_hash]);
      return t;
    });
    res.json({ estado: "ACTIVO", cuentaId: fila.cuenta_id });
  }));

  // S20 — perfil propio (RUN enmascarado) y direcciones para elegir entrega
  app.get("/clients/me", allowCallers("gateway"), requireUser("CLIENTE"), h(async (req, res) => {
    const [[c]] = await pool.query("SELECT * FROM clientes WHERE cliente_id = ?", [req.user.sub]);
    if (!c) throw E.notFound();
    const [dirs] = await pool.query("SELECT * FROM direcciones WHERE cliente_id = ? ORDER BY creado_en", [c.cliente_id]);
    res.json({
      nombre: c.nombre, email: c.email, run: V.enmascararRun(cif.descifrar(c.run_cifrado)),
      direcciones: dirs.map((d) => ({ direccionId: d.direccion_id, calle: cif.descifrar(d.calle_cifrada), numero: cif.descifrar(d.numero_cifrado), comuna: d.comuna })),
    });
  }));

  // S14 — contacto
  app.post("/contact", allowCallers("gateway"), h(async (req, res) => {
    V.assertObject(req.body);
    const { nombre, email, asunto, mensaje } = req.body;
    if (!V.isStr(nombre, 2, 120) || !V.isEmail(email) || !V.isStr(asunto, 2, 120) || !V.isStr(mensaje, 2, 1000)) throw E.badRequest("Revisa los campos del formulario");
    await pool.query("INSERT INTO mensajes_contacto (contacto_id, nombre, email, asunto, mensaje) VALUES (?,?,?,?,?)",
      [crypto.randomUUID(), nombre.trim(), email.toLowerCase(), asunto.trim(), mensaje.trim()]);
    res.status(201).end();
  }));

  // Interno (orders): dirección de entrega, verificando que pertenece al cliente
  app.get("/internal/clients/:id/addresses/:dirId", allowCallers("orders"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    const dirId = V.requireUUID(req.params.dirId, "direccionId");
    const [[d]] = await pool.query("SELECT * FROM direcciones WHERE direccion_id = ? AND cliente_id = ?", [dirId, id]);
    if (!d) throw E.notFound("Dirección no encontrada");
    res.json({ calle: cif.descifrar(d.calle_cifrada), numero: cif.descifrar(d.numero_cifrado), comuna: d.comuna, provincia: d.provincia, region: d.region });
  }));

  // Interno (payments): destinatario para enviar la boleta
  app.get("/internal/clients/:id/contacto", allowCallers("payments"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    const [[c]] = await pool.query("SELECT nombre, email FROM clientes WHERE cliente_id = ?", [id]);
    if (!c) throw E.notFound();
    res.json({ nombre: c.nombre, email: c.email });
  }));

  finish(app);
  listen(app, Number(process.env.PORT || 8083));
}
main().catch((e) => { console.error(e); process.exit(1); });
