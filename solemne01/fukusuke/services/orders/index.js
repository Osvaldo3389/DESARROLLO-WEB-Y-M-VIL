// orders — ciclo de vida del pedido, anulaciones (RF3), cola y estados de despacho (RF13). Autoridad del estado.
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "orders";
const crypto = require("crypto");
const { createApp, finish, listen, h } = require("../../shared/service");
const { createSecretProvider } = require("../../shared/secrets");
const { createPool, tx } = require("../../shared/db");
const { serviceAuth, allowCallers, createJwks, userContext, requireUser } = require("../../shared/auth");
const { callService } = require("../../shared/http");
const { E } = require("../../shared/errors");
const log = require("../../shared/log");
const V = require("../../shared/validate");

const INVENTORY = process.env.INVENTORY_URL || "http://inventory:8081";
const CLIENTS = process.env.CLIENTS_URL || "http://clients:8083";
const ANALYTICS = process.env.ANALYTICS_URL || "http://analytics:8085";
const COBERTURA = (process.env.COBERTURA_COMUNAS || "Maipú").split(",").map((s) => s.trim().toLowerCase());
const iso = (v) => (v ? new Date(String(v).replace(" ", "T") + "Z").toISOString() : null);
const TRANSICIONES = { PAGADO: ["EN_PREPARACION"], EN_PREPARACION: ["EN_CAMINO"], EN_CAMINO: ["ENTREGADO"] };

async function main() {
  const secrets = createSecretProvider();
  const pool = await createPool(secrets, "orders");
  const jwks = createJwks(process.env.AUTH_URL || "http://auth:8086");
  const invToken = await secrets.obtener("orders-inventory-token");
  const cliToken = await secrets.obtener("orders-clients-token");
  const anaToken = await secrets.obtener("analytics-ingest-token");
  const tokens = [
    { caller: "gateway", value: await secrets.obtener("gw-orders-token") },
    { caller: "payments", value: await secrets.obtener("payments-orders-token") },
    { caller: "graphql", value: await secrets.obtener("gql-orders-read") },
  ];

  // ---------- utilidades ----------
  async function cargarPedido(conn, id, lock = false) {
    const [[p]] = await conn.query(`SELECT * FROM pedidos WHERE pedido_id = ?${lock ? " FOR UPDATE" : ""}`, [id]);
    if (!p) return null;
    const [items] = await conn.query("SELECT * FROM detalles WHERE pedido_id = ? ORDER BY nombre_producto", [id]);
    p.items = items;
    return p;
  }
  const dto = (p, verMotivo = true) => ({
    pedidoId: p.pedido_id, estado: p.estado, total: p.total, creadoEn: iso(p.creado_en), pagadoEn: iso(p.pagado_en), comuna: p.envio_comuna,
    items: p.items.map((i) => ({
      itemId: i.detalle_id, productoId: i.producto_id, nombre: i.nombre_producto, cantidad: i.cantidad,
      precioUnitario: i.precio_unitario, subtotal: i.estado === "VIGENTE" ? i.cantidad * i.precio_unitario : 0, estado: i.estado,
      ...(verMotivo && i.motivo_anulacion ? { motivo: i.motivo_anulacion } : {}),
    })),
  });
  // Propiedad: CLIENTE solo ve lo suyo; si no, 404 (no revela existencia)
  function verificarAcceso(p, user) {
    if (!p) throw E.notFound("Pedido no encontrado");
    if (user.rol === "ADMIN") return;
    if (user.rol === "CLIENTE" && p.cliente_id === user.sub) return;
    throw E.notFound("Pedido no encontrado");
  }
  async function recalcular(conn, pedidoId) {
    const [[{ total }]] = await conn.query("SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total FROM detalles WHERE pedido_id = ? AND estado = 'VIGENTE'", [pedidoId]);
    await conn.query("UPDATE pedidos SET total = ? WHERE pedido_id = ?", [Number(total), pedidoId]);
    return Number(total);
  }
  async function consultarInventario(ids, correlationId) {
    const r = await callService(`${INVENTORY}/internal/availability`, { method: "POST", token: invToken, body: { ids }, timeoutMs: 2000, correlationId });
    if (r.status !== 200) throw E.unavailable("No fue posible validar disponibilidad");
    return new Map(r.body.map((x) => [x.productoId, x]));
  }
  async function encolarEvento(conn, tipo, payload) {
    await conn.query("INSERT INTO outbox (event_id, tipo, payload) VALUES (?,?,?)", [crypto.randomUUID(), tipo, JSON.stringify(payload)]);
  }
  const eventoVenta = (p, tipo) => ({
    pedidoId: p.pedido_id, fecha: (p.pagado_en || p.creado_en).slice(0, 10), comuna: p.envio_comuna, total: p.total,
    items: p.items.filter((i) => i.estado === "VIGENTE").map((i) => ({ productoId: i.producto_id, nombre: i.nombre_producto, cantidad: i.cantidad, subtotal: i.cantidad * i.precio_unitario })),
    tipo,
  });

  // Outbox → analytics (reintentos; consistencia eventual). Vacía la cola por lotes de 100 en cada ciclo
  // (máx. 2.000 eventos por ciclo) y nunca corre dos ciclos a la vez.
  let despachando = false;
  async function despacharOutbox() {
    if (despachando) return;
    despachando = true;
    try {
      for (let lote = 0; lote < 20; lote++) {
        const [rows] = await pool.query("SELECT * FROM outbox WHERE enviado_en IS NULL AND intentos < 20 ORDER BY creado_en LIMIT 100");
        let fallo = false;
        for (const ev of rows) {
          try {
            const payload = typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload;
            const r = await callService(`${ANALYTICS}/internal/events`, { method: "POST", token: anaToken, body: { eventId: ev.event_id, tipo: ev.tipo, ...payload }, timeoutMs: 3000 });
            if (r.status !== 202) throw new Error(String(r.status));
            await pool.query("UPDATE outbox SET enviado_en = UTC_TIMESTAMP() WHERE event_id = ?", [ev.event_id]);
          } catch (e) {
            await pool.query("UPDATE outbox SET intentos = intentos + 1 WHERE event_id = ?", [ev.event_id]);
            log.warn("evento pendiente para analytics", { eventId: ev.event_id });
            fallo = true;
            break;
          }
        }
        if (fallo || rows.length < 100) break;
      }
    } finally {
      despachando = false;
    }
  }
  setInterval(() => despacharOutbox().catch(() => {}), Number(process.env.OUTBOX_INTERVAL_MS || 30000)).unref();
  setTimeout(() => despacharOutbox().catch(() => {}), 2000).unref();

  // Retención: a los 12 meses los pedidos cerrados conservan solo la comuna (para reportes)
  const retencion = () => pool.query(`UPDATE pedidos SET envio_calle = NULL, envio_numero = NULL
    WHERE creado_en < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 12 MONTH) AND estado IN ('ENTREGADO','ANULADO') AND envio_calle IS NOT NULL`).catch(() => {});
  retencion();
  setInterval(retencion, 24 * 3600 * 1000).unref();

  const app = createApp();
  app.use(serviceAuth(tokens), userContext(jwks));

  // S06 — crear pedido (total calculado en servidor con precios de inventory)
  app.post("/orders", allowCallers("gateway"), requireUser("CLIENTE"), h(async (req, res) => {
    V.assertObject(req.body);
    const { items, direccionId } = req.body;
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) throw E.badRequest("El pedido debe tener entre 1 y 30 ítems");
    const agrupado = new Map();
    for (const it of items) {
      if (!it || !V.isUUID(it.productoId) || !V.isInt(it.cantidad, 1, 20)) throw E.badRequest("Cada ítem requiere productoId válido y cantidad entre 1 y 20");
      agrupado.set(it.productoId.toLowerCase(), (agrupado.get(it.productoId.toLowerCase()) || 0) + it.cantidad);
    }
    for (const c of agrupado.values()) if (c > 20) throw E.badRequest("Máximo 20 unidades por producto");
    V.requireUUID(direccionId, "direccionId");

    const rd = await callService(`${CLIENTS}/internal/clients/${req.user.sub}/addresses/${direccionId}`, { token: cliToken, correlationId: req.correlationId });
    if (rd.status === 404) throw E.notFound("Dirección no encontrada");
    if (rd.status !== 200) throw E.unavailable("No fue posible obtener la dirección");
    const dir = rd.body;
    if (!COBERTURA.includes(dir.comuna.trim().toLowerCase())) throw E.unprocessable("La dirección está fuera del radio de despacho (3 km desde el local en Maipú)", "FUERA_DE_COBERTURA");

    const inv = await consultarInventario([...agrupado.keys()], req.correlationId);
    const noDisp = [...agrupado.keys()].filter((id) => !inv.has(id) || !inv.get(id).disponible);
    if (noDisp.length) throw E.conflict("Hay productos que no están disponibles", "PRODUCTO_NO_DISPONIBLE");

    const pedidoId = crypto.randomUUID();
    await tx(pool, async (conn) => {
      let total = 0;
      for (const [pid, cant] of agrupado) total += inv.get(pid).precio * cant;
      await conn.query(`INSERT INTO pedidos (pedido_id, cliente_id, estado, total, creado_en, direccion_id, envio_calle, envio_numero, envio_comuna)
        VALUES (?,?, 'PENDIENTE_PAGO', ?, UTC_TIMESTAMP(3), ?,?,?,?)`, [pedidoId, req.user.sub, total, direccionId, dir.calle, dir.numero, dir.comuna]);
      for (const [pid, cant] of agrupado) {
        const p = inv.get(pid);
        await conn.query("INSERT INTO detalles (detalle_id, pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (?,?,?,?,?,?)",
          [crypto.randomUUID(), pedidoId, pid, p.nombre, cant, p.precio]);
      }
    });
    const p = await cargarPedido(pool, pedidoId);
    res.status(201).json(dto(p));
  }));

  // S07 — modificar cantidad (dueño, pedido pendiente)
  app.put("/orders/:id/items/:itemId", allowCallers("gateway"), requireUser("CLIENTE"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    const itemId = V.requireUUID(req.params.itemId, "itemId");
    V.assertObject(req.body);
    if (!V.isInt(req.body.cantidad, 1, 20)) throw E.badRequest("cantidad debe estar entre 1 y 20");
    const p0 = await cargarPedido(pool, id);
    verificarAcceso(p0, req.user);
    const it0 = p0.items.find((i) => i.detalle_id === itemId);
    if (!it0 || it0.estado !== "VIGENTE") throw E.notFound("Ítem no encontrado");
    const inv = await consultarInventario([it0.producto_id], req.correlationId);
    if (!inv.get(it0.producto_id) || !inv.get(it0.producto_id).disponible) throw E.conflict("Producto no disponible", "PRODUCTO_NO_DISPONIBLE");
    await tx(pool, async (conn) => {
      const p = await cargarPedido(conn, id, true);
      if (p.estado !== "PENDIENTE_PAGO") throw E.conflict("El pedido ya no se puede modificar", "ESTADO_INVALIDO");
      await conn.query("UPDATE detalles SET cantidad = ? WHERE detalle_id = ? AND pedido_id = ?", [req.body.cantidad, itemId, id]);
      await recalcular(conn, id);
    });
    res.json(dto(await cargarPedido(pool, id)));
  }));

  // S08 — anulación lógica con motivo (dueño en PENDIENTE_PAGO; ADMIN también después del pago)
  app.patch("/orders/:id/items/:itemId/anulacion", allowCallers("gateway"), requireUser("CLIENTE", "ADMIN"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    const itemId = V.requireUUID(req.params.itemId, "itemId");
    V.assertObject(req.body);
    if (!V.isStr(req.body.motivo, 5, 200)) throw E.badRequest("El motivo debe tener entre 5 y 200 caracteres");
    await tx(pool, async (conn) => {
      const p = await cargarPedido(conn, id, true);
      verificarAcceso(p, req.user);
      const it = p.items.find((i) => i.detalle_id === itemId);
      if (!it) throw E.notFound("Ítem no encontrado");
      if (it.estado === "ANULADO") throw E.conflict("El ítem ya está anulado", "ESTADO_INVALIDO");
      if (req.user.rol === "CLIENTE" && p.estado !== "PENDIENTE_PAGO") throw E.conflict("Pedido pagado: solo el administrador puede anular", "ESTADO_INVALIDO");
      if (["ANULADO", "ENTREGADO"].includes(p.estado)) throw E.conflict("El pedido no admite anulaciones", "ESTADO_INVALIDO");
      await conn.query("UPDATE detalles SET estado='ANULADO', motivo_anulacion=?, anulado_en=UTC_TIMESTAMP(), anulado_por=? WHERE detalle_id=?",
        [req.body.motivo.trim(), req.user.sub, itemId]);
      const total = await recalcular(conn, id);
      const eraPagado = p.estado !== "PENDIENTE_PAGO";
      if (total === 0) await conn.query("UPDATE pedidos SET estado = 'ANULADO' WHERE pedido_id = ?", [id]);
      if (eraPagado) {
        await encolarEvento(conn, "AjusteVenta", { pedidoId: id, fecha: (p.pagado_en || p.creado_en).slice(0, 10), comuna: p.envio_comuna,
          total: -(it.cantidad * it.precio_unitario), pedidos: total === 0 ? -1 : 0,
          items: [{ productoId: it.producto_id, nombre: it.nombre_producto, cantidad: -it.cantidad, subtotal: -(it.cantidad * it.precio_unitario) }] });
      }
    });
    res.json(dto(await cargarPedido(pool, id)));
  }));

  // S17 — cola de despacho en orden de llegada (pagadoEn asc). Lectura también para GraphQL (G02).
  app.get("/orders/dispatch-queue", allowCallers("gateway", "graphql"), requireUser("DESPACHO", "ADMIN"), h(async (req, res) => {
    const first = req.query.first === undefined ? 20 : Number(req.query.first);
    if (!V.isInt(first, 1, 50)) throw E.badRequest("first debe estar entre 1 y 50");
    let cursorSql = "";
    const args = [];
    if (req.query.after) {
      const [ts, pid] = Buffer.from(String(req.query.after), "base64url").toString().split("|");
      if (!ts || !V.isUUID(pid)) throw E.badRequest("Cursor inválido");
      cursorSql = " AND (pagado_en > ? OR (pagado_en = ? AND pedido_id > ?))";
      args.push(ts, ts, pid);
    }
    const [rows] = await pool.query(`SELECT * FROM pedidos WHERE estado IN ('PAGADO','EN_PREPARACION','EN_CAMINO')${cursorSql}
      ORDER BY pagado_en ASC, pedido_id ASC LIMIT ?`, [...args, first + 1]);
    const page = rows.slice(0, first);
    const ids = page.map((r) => r.pedido_id);
    const [items] = ids.length ? await pool.query("SELECT * FROM detalles WHERE estado = 'VIGENTE' AND pedido_id IN (?)", [ids]) : [[]];
    const edges = page.map((p) => ({
      pedidoId: p.pedido_id, estado: p.estado, pagadoEn: iso(p.pagado_en), calle: p.envio_calle, numero: p.envio_numero, comuna: p.envio_comuna,
      items: items.filter((i) => i.pedido_id === p.pedido_id).map((i) => ({ productoId: i.producto_id, nombre: i.nombre_producto, cantidad: i.cantidad })),
    }));
    const last = page[page.length - 1];
    res.json({ edges, hasNextPage: rows.length > first, endCursor: last ? Buffer.from(`${last.pagado_en}|${last.pedido_id}`).toString("base64url") : null });
  }));

  // S09 — consultar pedido (dueño o ADMIN). Lectura también para GraphQL (G01).
  app.get("/orders/:id", allowCallers("gateway", "graphql"), requireUser("CLIENTE", "ADMIN"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    const p = await cargarPedido(pool, id);
    verificarAcceso(p, req.user);
    res.json(dto(p));
  }));

  // S18 — avanzar estado de despacho; EN_PREPARACION imprime la orden de despacho
  app.patch("/orders/:id/estado", allowCallers("gateway"), requireUser("DESPACHO", "ADMIN"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    V.assertObject(req.body);
    const { estado, chofer } = req.body;
    if (!["EN_PREPARACION", "EN_CAMINO", "ENTREGADO"].includes(estado)) throw E.badRequest("Estado inválido");
    if (chofer !== undefined && !V.isStr(chofer, 2, 80)) throw E.badRequest("Chofer inválido");
    const orden = await tx(pool, async (conn) => {
      const p = await cargarPedido(conn, id, true);
      if (!p) throw E.notFound("Pedido no encontrado");
      if (!(TRANSICIONES[p.estado] || []).includes(estado)) throw E.conflict(`Transición no permitida: ${p.estado} → ${estado}`, "TRANSICION_INVALIDA");
      await conn.query("UPDATE pedidos SET estado = ? WHERE pedido_id = ?", [estado, id]);
      if (estado === "EN_PREPARACION") {
        await conn.query("INSERT INTO ordenes_despacho (orden_id, pedido_id, impresa_en, estado) VALUES (?,?, UTC_TIMESTAMP(), 'EN_PREPARACION')", [crypto.randomUUID(), id]);
      } else {
        await conn.query("UPDATE ordenes_despacho SET estado = ?, chofer = COALESCE(?, chofer) WHERE pedido_id = ?", [estado, chofer || null, id]);
      }
      if (estado === "ENTREGADO") await encolarEvento(conn, "PedidoEntregado", { pedidoId: id, fecha: p.pagado_en.slice(0, 10), comuna: p.envio_comuna, total: 0, items: [] });
      const [[o]] = await conn.query("SELECT * FROM ordenes_despacho WHERE pedido_id = ?", [id]);
      return o;
    });
    res.json({ pedidoId: id, estado, ordenDespacho: { ordenId: orden.orden_id, impresaEn: iso(orden.impresa_en), chofer: orden.chofer } });
  }));

  // ---- Contratos internos (payments) ----
  app.get("/internal/orders/:id", allowCallers("payments"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    const p = await cargarPedido(pool, id);
    if (!p) throw E.notFound();
    res.json({ ...dto(p, false), clienteId: p.cliente_id });
  }));

  // Solo payments y solo hacia PAGADO (idempotente)
  app.patch("/internal/orders/:id/estado", allowCallers("payments"), h(async (req, res) => {
    const id = V.requireUUID(req.params.id);
    if (!req.body || req.body.estado !== "PAGADO") throw E.forbidden("payments solo puede marcar PAGADO");
    const p = await tx(pool, async (conn) => {
      const ped = await cargarPedido(conn, id, true);
      if (!ped) throw E.notFound();
      if (ped.estado !== "PENDIENTE_PAGO") return ped; // ya procesado
      await conn.query("UPDATE pedidos SET estado = 'PAGADO', pagado_en = UTC_TIMESTAMP(3) WHERE pedido_id = ?", [id]);
      const actualizado = await cargarPedido(conn, id);
      await encolarEvento(conn, "PedidoPagado", eventoVenta(actualizado, "PedidoPagado"));
      return actualizado;
    });
    despacharOutbox().catch(() => {});
    res.json({ pedidoId: id, estado: p.estado });
  }));

  finish(app);
  listen(app, Number(process.env.PORT || 8082));
}
main().catch((e) => { console.error(e); process.exit(1); });
