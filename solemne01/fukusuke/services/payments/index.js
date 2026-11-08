// payments — inicio de pago, aviso firmado de Servipag, depósitos, cajero virtual y boleta (RF4, RF8).
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "payments";
const crypto = require("crypto");
const express = require("express");
const { createApp, finish, listen, h } = require("../../shared/service");
const { createSecretProvider } = require("../../shared/secrets");
const { createPool, tx } = require("../../shared/db");
const { serviceAuth, allowCallers, createJwks, userContext, requireUser, safeEqual } = require("../../shared/auth");
const { callService } = require("../../shared/http");
const { E } = require("../../shared/errors");
const log = require("../../shared/log");
const V = require("../../shared/validate");
const { sha256 } = require("../../shared/cifrado");

const ORDERS = process.env.ORDERS_URL || "http://orders:8082";
const CLIENTS = process.env.CLIENTS_URL || "http://clients:8083";
const SERVIPAG = process.env.SERVIPAG_URL || "http://servipag-sandbox:8090";
const MAIL = process.env.MAIL_URL || "http://mail-sandbox:8025";
const PUBLIC_URL = process.env.PUBLIC_URL || "https://localhost";
const TOLERANCIA_SEG = 300;
const iso = (v) => (v ? new Date(String(v).replace(" ", "T") + "Z").toISOString() : null);

function verificarFirma(secret, raw, header) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header || "");
  if (!m) return false;
  if (Math.abs(Date.now() / 1000 - Number(m[1])) > TOLERANCIA_SEG) return false;
  const esperado = crypto.createHmac("sha256", secret).update(`${m[1]}.${raw}`).digest("hex");
  return safeEqual(esperado, m[2]);
}

async function main() {
  const secrets = createSecretProvider();
  const pool = await createPool(secrets, "payments");
  const jwks = createJwks(process.env.AUTH_URL || "http://auth:8086");
  const ordToken = await secrets.obtener("payments-orders-token");
  const cliToken = await secrets.obtener("payments-clients-token");
  const servipagKey = await secrets.obtener("servipag-api-key");
  const webhookSecret = await secrets.obtener("servipag-webhook-secret");
  const mailKey = await secrets.obtener("mail-api-key-payments");
  const tokens = [
    { caller: "gateway", value: await secrets.obtener("gw-payments-token") },
    { caller: "graphql", value: await secrets.obtener("gql-payments-read") },
  ];

  const obtenerPedido = async (pedidoId, correlationId) => {
    const r = await callService(`${ORDERS}/internal/orders/${pedidoId}`, { token: ordToken, correlationId });
    if (r.status === 404) return null;
    if (r.status !== 200) throw E.unavailable("No fue posible consultar el pedido");
    return r.body;
  };

  // Marca PAGADO en orders; si falla queda en outbox y se reintenta
  async function marcarPagado(pedidoId) {
    try {
      const r = await callService(`${ORDERS}/internal/orders/${pedidoId}/estado`, { method: "PATCH", token: ordToken, body: { estado: "PAGADO" } });
      if (r.status !== 200) throw new Error(String(r.status));
      return true;
    } catch (e) {
      await pool.query("INSERT INTO outbox (event_id, tipo, payload) VALUES (?, 'MarcarPagado', ?)", [crypto.randomUUID(), JSON.stringify({ pedidoId })]);
      log.warn("orders no respondió; transición PAGADO en outbox", { pedidoId });
      return false;
    }
  }
  async function reintentarOutbox() {
    const [rows] = await pool.query("SELECT * FROM outbox WHERE enviado_en IS NULL AND intentos < 50 ORDER BY creado_en LIMIT 50");
    for (const ev of rows) {
      const p = typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload;
      try {
        const r = await callService(`${ORDERS}/internal/orders/${p.pedidoId}/estado`, { method: "PATCH", token: ordToken, body: { estado: "PAGADO" } });
        if (r.status !== 200) throw new Error();
        await pool.query("UPDATE outbox SET enviado_en = UTC_TIMESTAMP() WHERE event_id = ?", [ev.event_id]);
      } catch { await pool.query("UPDATE outbox SET intentos = intentos + 1 WHERE event_id = ?", [ev.event_id]); }
    }
  }
  setInterval(() => reintentarOutbox().catch(() => {}), Number(process.env.OUTBOX_INTERVAL_MS || 30000)).unref();

  // Aprobación común (Servipag o depósito): estado, boleta del cajero virtual, orders y correo
  async function aprobar(pagoId, transaccionExterna, correlationId) {
    const boleta = await tx(pool, async (conn) => {
      const [[pago]] = await conn.query("SELECT * FROM pagos WHERE pago_id = ? FOR UPDATE", [pagoId]);
      if (pago.estado === "APROBADO") return null;
      const [[otro]] = await conn.query("SELECT 1 FROM pagos WHERE pedido_id = ? AND estado = 'APROBADO'", [pago.pedido_id]);
      if (otro) throw E.conflict("El pedido ya tiene un pago aprobado", "YA_PAGADO");
      await conn.query("UPDATE pagos SET estado = 'APROBADO', transaccion_externa = COALESCE(?, transaccion_externa) WHERE pago_id = ?", [transaccionExterna, pagoId]);
      const pedido = await obtenerPedido(pago.pedido_id, correlationId);
      const items = pedido.items.filter((i) => i.estado === "VIGENTE").map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precioUnitario: i.precioUnitario, subtotal: i.subtotal }));
      const [f] = await conn.query("INSERT INTO folios () VALUES ()");
      const folio = `B-${String(f.insertId).padStart(6, "0")}`;
      await conn.query(`INSERT INTO boletas (folio, pago_id, pedido_id, cliente_id, fecha_emision, monto_total, cajero_id, metodo, items)
        VALUES (?,?,?,?, UTC_TIMESTAMP(), ?, 1, ?, ?)`, [folio, pagoId, pago.pedido_id, pago.cliente_id, pago.monto, pago.metodo, JSON.stringify(items)]);
      return { folio, pago, items };
    });
    if (!boleta) return null;
    await marcarPagado(boleta.pago.pedido_id);
    // RF8: boleta al correo del cliente (no bloquea la respuesta)
    (async () => {
      const c = await callService(`${CLIENTS}/internal/clients/${boleta.pago.cliente_id}/contacto`, { token: cliToken });
      if (c.status !== 200) return;
      const lineas = boleta.items.map((i) => `${i.cantidad} x ${i.nombre} = $${i.subtotal}`).join("\n");
      const r = await callService(`${MAIL}/api/send`, { method: "POST", token: mailKey, body: { to: c.body.email,
        subject: `Boleta ${boleta.folio} — Fukusuke Sushi-Delivery`, text: `Hola ${c.body.nombre}, gracias por tu compra.\n${lineas}\nTotal: $${boleta.pago.monto}\nCajero Virtual 01` } });
      if (r.status === 202) await pool.query("UPDATE boletas SET enviada_por_correo = 1 WHERE folio = ?", [boleta.folio]);
    })().catch(() => log.warn("boleta no enviada por correo", { folio: boleta.folio }));
    return boleta.folio;
  }

  const app = createApp();

  // R11 — aviso del proveedor: se necesita el cuerpo crudo para verificar la firma
  app.post("/webhooks/servipag", express.raw({ type: "application/json", limit: "8kb" }), serviceAuth(tokens), allowCallers("gateway"), h(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    if (!verificarFirma(webhookSecret, raw, req.headers["x-signature"])) throw E.unauthorized("Firma inválida");
    let ev;
    try { ev = JSON.parse(raw); } catch { throw E.badRequest("JSON mal formado"); }
    if (!V.isStr(ev.transaccionId, 3, 80) || !V.isUUID(ev.referencia) || !Number.isInteger(ev.monto) || !["APROBADO", "RECHAZADO"].includes(ev.estado)) throw E.badRequest("Aviso inválido");
    const [ins] = await pool.query("INSERT IGNORE INTO webhooks_procesados (transaccion_id) VALUES (?)", [ev.transaccionId]);
    if (!ins.affectedRows) return res.json({ recibido: true }); // duplicado: sin efectos
    try {
      const [[pago]] = await pool.query("SELECT * FROM pagos WHERE pago_id = ?", [ev.referencia]);
      if (!pago || pago.metodo !== "SERVIPAG") throw E.notFound("Pago no encontrado");
      if (pago.monto !== ev.monto) throw E.conflict("El monto no coincide con el pedido", "MONTO_DISTINTO");
      if (ev.estado === "APROBADO") await aprobar(pago.pago_id, ev.transaccionId, req.correlationId);
      else await pool.query("UPDATE pagos SET estado = 'RECHAZADO', transaccion_externa = ? WHERE pago_id = ? AND estado = 'PENDIENTE'", [ev.transaccionId, pago.pago_id]);
    } catch (e) {
      await pool.query("DELETE FROM webhooks_procesados WHERE transaccion_id = ?", [ev.transaccionId]);
      throw e;
    }
    res.json({ recibido: true });
  }));

  app.use(serviceAuth(tokens), userContext(jwks));

  // S10 — iniciar pago (idempotente). El monto lo entrega orders, nunca el navegador.
  app.post("/payments", allowCallers("gateway"), requireUser("CLIENTE"), h(async (req, res) => {
    const key = req.headers["idempotency-key"];
    if (!V.isUUID(key)) throw E.badRequest("Idempotency-Key (UUID) es obligatoria");
    V.assertObject(req.body);
    const { pedidoId, metodo } = req.body;
    V.requireUUID(pedidoId, "pedidoId");
    if (!["SERVIPAG", "DEPOSITO"].includes(metodo)) throw E.badRequest("Método de pago inválido");
    const reqHash = sha256(JSON.stringify({ pedidoId, metodo, sub: req.user.sub }));
    const [[previo]] = await pool.query("SELECT * FROM pagos WHERE idempotency_key = ?", [key]);
    if (previo) {
      if (previo.request_hash !== reqHash) throw E.conflict("La Idempotency-Key ya se usó con otra solicitud", "IDEMPOTENCY_CONFLICT");
      return res.status(201).json(typeof previo.respuesta === "string" ? JSON.parse(previo.respuesta) : previo.respuesta);
    }
    const pedido = await obtenerPedido(pedidoId, req.correlationId);
    if (!pedido || pedido.clienteId !== req.user.sub) throw E.notFound("Pedido no encontrado");
    if (pedido.estado !== "PENDIENTE_PAGO") throw E.conflict("El pedido no está pendiente de pago", "ESTADO_INVALIDO");
    const [[aprobado]] = await pool.query("SELECT 1 FROM pagos WHERE pedido_id = ? AND estado = 'APROBADO'", [pedidoId]);
    if (aprobado) throw E.conflict("El pedido ya fue pagado", "YA_PAGADO");

    const pagoId = crypto.randomUUID();
    let respuesta;
    let tokenProveedor = null;
    if (metodo === "SERVIPAG") {
      const r = await callService(`${SERVIPAG}/api/transacciones`, { method: "POST", token: servipagKey, timeoutMs: 8000, body: {
        monto: pedido.total, referencia: pagoId, urlRetorno: `${PUBLIC_URL}/boleta.php?pagoId=${pagoId}&pedidoId=${pedidoId}` } })
        .catch(() => ({ status: 502 }));
      if (r.status !== 201) throw E.badGateway("Servipag no está disponible, intenta nuevamente");
      tokenProveedor = r.body.token;
      respuesta = { pagoId, estado: "PENDIENTE", redirectUrl: r.body.redirectUrl };
    } else {
      respuesta = { pagoId, estado: "PENDIENTE", instruccionesDeposito: { banco: "Banco de prueba", cuenta: "Cuenta corriente 00-111-22222-3 (ficticia)", referencia: pagoId.slice(0, 8).toUpperCase(), monto: pedido.total } };
    }
    try {
      await pool.query(`INSERT INTO pagos (pago_id, pedido_id, cliente_id, metodo, estado, monto, token_proveedor, idempotency_key, request_hash, respuesta)
        VALUES (?,?,?,?, 'PENDIENTE', ?,?,?,?,?)`, [pagoId, pedidoId, req.user.sub, metodo, pedido.total, tokenProveedor, key, reqHash, JSON.stringify(respuesta)]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw E.conflict("Solicitud duplicada en curso", "IDEMPOTENCY_CONFLICT");
      throw e;
    }
    res.status(201).json(respuesta);
  }));

  // S12 — confirmación manual de depósito (ADMIN)
  app.post("/payments/:id/confirmacion", allowCallers("gateway"), requireUser("ADMIN"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    V.assertObject(req.body);
    const { numeroOperacion, fechaDeposito } = req.body;
    if (!V.isStr(numeroOperacion, 4, 40) || !V.isDate(fechaDeposito)) throw E.badRequest("numeroOperacion y fechaDeposito son obligatorios");
    const [[pago]] = await pool.query("SELECT * FROM pagos WHERE pago_id = ?", [id]);
    if (!pago) throw E.notFound("Pago no encontrado");
    if (pago.metodo !== "DEPOSITO" || pago.estado !== "PENDIENTE") throw E.conflict("El pago no es un depósito pendiente", "ESTADO_INVALIDO");
    try {
      await pool.query("INSERT INTO depositos_confirmados (numero_operacion, pago_id, fecha_deposito, confirmado_por) VALUES (?,?,?,?)",
        [numeroOperacion.trim(), id, fechaDeposito, req.user.sub]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw E.unprocessable("El número de operación ya fue utilizado", "OPERACION_USADA");
      throw e;
    }
    const folio = await aprobar(id, null, req.correlationId);
    res.json({ pagoId: id, estado: "APROBADO", folioBoleta: folio });
  }));

  // Lista de depósitos pendientes para P11 (ADMIN)
  app.get("/payments/pendientes", allowCallers("gateway"), requireUser("ADMIN"), h(async (req, res) => {
    const [rows] = await pool.query("SELECT pago_id, pedido_id, monto, creado_en FROM pagos WHERE metodo = 'DEPOSITO' AND estado = 'PENDIENTE' ORDER BY creado_en LIMIT 50");
    res.json(rows.map((r) => ({ pagoId: r.pago_id, pedidoId: r.pedido_id, monto: r.monto, referencia: r.pago_id.slice(0, 8).toUpperCase(), creadoEn: iso(r.creado_en) })));
  }));

  const boletaDTO = (b) => ({ folio: b.folio, fechaEmision: iso(b.fecha_emision), cajeroVirtual: "Cajero Virtual 01", pedidoId: b.pedido_id,
    items: typeof b.items === "string" ? JSON.parse(b.items) : b.items, total: b.monto_total, metodoPago: b.metodo });

  // S13 — boleta (dueño o ADMIN)
  app.get("/payments/:id/boleta", allowCallers("gateway"), requireUser("CLIENTE", "ADMIN"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    const [[pago]] = await pool.query("SELECT * FROM pagos WHERE pago_id = ?", [id]);
    if (!pago || (req.user.rol === "CLIENTE" && pago.cliente_id !== req.user.sub)) throw E.notFound("Pago no encontrado");
    if (pago.estado !== "APROBADO") throw E.conflict("El pago aún no está aprobado", "PAGO_NO_APROBADO");
    const [[b]] = await pool.query("SELECT * FROM boletas WHERE pago_id = ?", [id]);
    res.json(boletaDTO(b));
  }));

  // Interno (graphql, solo lectura): estado de pago de un pedido, con verificación de propiedad
  app.get("/internal/payments/by-order/:pedidoId", allowCallers("graphql"), requireUser("CLIENTE", "ADMIN"), h(async (req, res) => {
    const pedidoId = V.requireUUID(req.params.pedidoId, "pedidoId");
    const [rows] = await pool.query("SELECT p.*, b.folio FROM pagos p LEFT JOIN boletas b ON b.pago_id = p.pago_id WHERE p.pedido_id = ? ORDER BY (p.estado='APROBADO') DESC, p.creado_en DESC LIMIT 1", [pedidoId]);
    const p = rows[0];
    if (!p || (req.user.rol === "CLIENTE" && p.cliente_id !== req.user.sub)) return res.json(null);
    res.json({ pagoId: p.pago_id, estado: p.estado, metodo: p.metodo, folioBoleta: p.folio || null });
  }));

  finish(app);
  listen(app, Number(process.env.PORT || 8084));
}
main().catch((e) => { console.error(e); process.exit(1); });
