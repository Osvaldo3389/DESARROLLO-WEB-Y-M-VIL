// analytics — proyección de ventas para RF9/CU8 alimentada por eventos (sin datos personales).
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "analytics";
const { createApp, finish, listen, h } = require("../../shared/service");
const { createSecretProvider } = require("../../shared/secrets");
const { createPool, tx } = require("../../shared/db");
const { serviceAuth, allowCallers, createJwks, userContext, requireUser } = require("../../shared/auth");
const { E } = require("../../shared/errors");
const V = require("../../shared/validate");

const TIPOS = ["PedidoPagado", "AjusteVenta", "PedidoEntregado"];

async function main() {
  const secrets = createSecretProvider();
  const pool = await createPool(secrets, "analytics");
  const jwks = createJwks(process.env.AUTH_URL || "http://auth:8086");
  const tokens = [
    { caller: "gateway", value: await secrets.obtener("gw-analytics-token") },
    { caller: "orders", value: await secrets.obtener("analytics-ingest-token") },
  ];
  const app = createApp({ jsonLimit: "32kb" });
  app.use(serviceAuth(tokens), userContext(jwks));

  // Ingesta idempotente de eventos (solo orders). Campos permitidos: ids, fecha, comuna, ítems y montos.
  app.post("/internal/events", allowCallers("orders"), h(async (req, res) => {
    const ev = req.body || {};
    if (!V.isUUID(ev.eventId) || !TIPOS.includes(ev.tipo) || !V.isDate(ev.fecha) || !V.isStr(ev.comuna, 1, 60) || !Number.isInteger(ev.total) || !Array.isArray(ev.items)) {
      throw E.badRequest("Evento inválido");
    }
    await tx(pool, async (conn) => {
      const [ins] = await conn.query("INSERT IGNORE INTO eventos_procesados (event_id) VALUES (?)", [ev.eventId]);
      if (!ins.affectedRows || ev.tipo === "PedidoEntregado") return;
      const pedidos = ev.tipo === "PedidoPagado" ? 1 : Number(ev.pedidos || 0);
      await conn.query(`INSERT INTO ventas_diarias (fecha, comuna, total, pedidos) VALUES (?,?,?,?)
        ON DUPLICATE KEY UPDATE total = total + VALUES(total), pedidos = pedidos + VALUES(pedidos)`, [ev.fecha, ev.comuna, ev.total, pedidos]);
      for (const it of ev.items) {
        if (!V.isUUID(it.productoId) || !V.isStr(it.nombre, 1, 80) || !Number.isInteger(it.cantidad) || !Number.isInteger(it.subtotal)) continue;
        await conn.query(`INSERT INTO ventas_producto (fecha, producto_id, nombre, unidades, monto) VALUES (?,?,?,?,?)
          ON DUPLICATE KEY UPDATE unidades = unidades + VALUES(unidades), monto = monto + VALUES(monto), nombre = VALUES(nombre)`,
          [ev.fecha, it.productoId, it.nombre, it.cantidad, it.subtotal]);
      }
    });
    res.status(202).json({ recibido: true });
  }));

  // S19 — reporte de ventas por período (DUENO / ADMIN)
  app.get("/reports/sales", allowCallers("gateway"), requireUser("DUENO", "ADMIN"), h(async (req, res) => {
    const { desde, hasta } = req.query;
    if (!V.isDate(desde) || !V.isDate(hasta)) throw E.badRequest("desde y hasta deben tener formato AAAA-MM-DD");
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000;
    if (dias < 0 || dias > 366) throw E.badRequest("Rango inválido (máximo 366 días)");
    const [porDia] = await pool.query("SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, SUM(total) AS total, SUM(pedidos) AS pedidos FROM ventas_diarias WHERE fecha BETWEEN ? AND ? GROUP BY fecha ORDER BY fecha", [desde, hasta]);
    const [porComuna] = await pool.query("SELECT comuna, SUM(total) AS total, SUM(pedidos) AS pedidos FROM ventas_diarias WHERE fecha BETWEEN ? AND ? GROUP BY comuna ORDER BY total DESC", [desde, hasta]);
    const [top] = await pool.query("SELECT nombre, SUM(unidades) AS unidades, SUM(monto) AS monto FROM ventas_producto WHERE fecha BETWEEN ? AND ? GROUP BY producto_id, nombre ORDER BY unidades DESC LIMIT 10", [desde, hasta]);
    const totalVentas = porDia.reduce((a, d) => a + Number(d.total), 0);
    const cantidadPedidos = porDia.reduce((a, d) => a + Number(d.pedidos), 0);
    res.json({
      desde, hasta, totalVentas, cantidadPedidos, ticketPromedio: cantidadPedidos ? Math.round(totalVentas / cantidadPedidos) : 0,
      porDia: porDia.map((d) => ({ fecha: d.fecha, total: Number(d.total), pedidos: Number(d.pedidos) })),
      porComuna: porComuna.map((d) => ({ comuna: d.comuna, total: Number(d.total), pedidos: Number(d.pedidos) })),
      topProductos: top.map((t) => ({ nombre: t.nombre, unidades: Number(t.unidades), monto: Number(t.monto) })),
    });
  }));

  finish(app);
  listen(app, Number(process.env.PORT || 8085));
}
main().catch((e) => { console.error(e); process.exit(1); });
