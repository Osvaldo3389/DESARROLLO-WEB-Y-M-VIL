// GraphQL Gateway PRIVADO — agregaciones de lectura G01 (resumenPedido) y G02 (colaDespacho).
// No accede a bases de datos: combina APIs internas con tokens de solo lectura.
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "graphql";
const DataLoader = require("dataloader");
const { buildSchema, parse, validate, execute, GraphQLError, Kind } = require("graphql");
const { createApp, finish, listen, h } = require("../shared/service");
const { createSecretProvider } = require("../shared/secrets");
const { serviceAuth, allowCallers, createJwks, verifyUserToken } = require("../shared/auth");
const { callService } = require("../shared/http");
const { E } = require("../shared/errors");
const { SDL, OPERACIONES } = require("./schema");

const ORDERS = process.env.ORDERS_URL || "http://orders:8082";
const INVENTORY = process.env.INVENTORY_URL || "http://inventory:8081";
const PAYMENTS = process.env.PAYMENTS_URL || "http://payments:8084";
const MAX_PROFUNDIDAD = 5;
const MAX_COSTO = 100;
const TIMEOUT_SUBSISTEMA = 2000;
const TIMEOUT_TOTAL = 3000;

// ---- límites: profundidad y costo (se aplican a toda operación, incluidas las registradas) ----
function analizar(doc) {
  const frags = {};
  doc.definitions.filter((d) => d.kind === Kind.FRAGMENT_DEFINITION).forEach((f) => { frags[f.name.value] = f; });
  let maxDepth = 0;
  let costo = 0;
  function walk(sel, depth, mult) {
    if (!sel) return;
    for (const s of sel.selections) {
      if (s.kind === Kind.FIELD) {
        if (s.name.value.startsWith("__")) throw E.badRequest("Introspección deshabilitada");
        const firstArg = (s.arguments || []).find((a) => a.name.value === "first");
        const m = firstArg && firstArg.value.kind === Kind.INT ? Number(firstArg.value.value) : firstArg ? 50 : 1;
        costo += mult;
        maxDepth = Math.max(maxDepth, depth);
        walk(s.selectionSet, depth + 1, s.selectionSet ? mult * (m > 1 ? Math.min(m, 50) / 10 : 1) : mult);
      } else if (s.kind === Kind.INLINE_FRAGMENT) walk(s.selectionSet, depth, mult);
      else if (s.kind === Kind.FRAGMENT_SPREAD) walk(frags[s.name.value] && frags[s.name.value].selectionSet, depth, mult);
    }
  }
  doc.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION).forEach((op) => walk(op.selectionSet, 1, 1));
  return { profundidad: maxDepth, costo: Math.ceil(costo) };
}

const norm = (q) => String(q).replace(/\s+/g, " ").trim();

async function main() {
  const secrets = createSecretProvider();
  const jwks = createJwks(process.env.AUTH_URL || "http://auth:8086");
  const tk = {
    orders: await secrets.obtener("gql-orders-read"),
    inventory: await secrets.obtener("gql-inventory-read"),
    payments: await secrets.obtener("gql-payments-read"),
  };
  const schema = buildSchema(SDL);
  const registradas = {};
  for (const [nombre, def] of Object.entries(OPERACIONES)) {
    const doc = parse(def.query);
    const errs = validate(schema, doc);
    if (errs.length) throw new Error(`Operación ${nombre} inválida: ${errs[0].message}`);
    const a = analizar(doc);
    if (a.profundidad > MAX_PROFUNDIDAD || a.costo > MAX_COSTO) throw new Error(`Operación ${nombre} excede límites`);
    registradas[nombre] = { ...def, doc, normalizada: norm(def.query) };
  }

  // ---- adaptadores a subsistemas (REST interno, solo lectura) ----
  const adaptadores = (ctx) => ({
    getPedido: (id) => callService(`${ORDERS}/orders/${id}`, { token: tk.orders, userToken: ctx.user.token, timeoutMs: TIMEOUT_SUBSISTEMA, correlationId: ctx.correlationId }),
    getCola: (first, after) => callService(`${ORDERS}/orders/dispatch-queue?first=${first}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      { token: tk.orders, userToken: ctx.user.token, timeoutMs: TIMEOUT_SUBSISTEMA, correlationId: ctx.correlationId }),
    getPago: (pedidoId) => callService(`${PAYMENTS}/internal/payments/by-order/${pedidoId}`, { token: tk.payments, userToken: ctx.user.token, timeoutMs: TIMEOUT_SUBSISTEMA, correlationId: ctx.correlationId }),
  });
  // DataLoader: una sola llamada por lote de productos (evita N+1)
  const crearLoader = (ctx) => new DataLoader(async (ids) => {
    ctx.llamadasInventario = (ctx.llamadasInventario || 0) + 1;
    const r = await callService(`${INVENTORY}/internal/products?ids=${ids.join(",")}`, { token: tk.inventory, timeoutMs: TIMEOUT_SUBSISTEMA, correlationId: ctx.correlationId })
      .catch(() => ({ status: 503 }));
    if (r.status !== 200) return ids.map(() => new GraphQLError("Inventario no disponible", { extensions: { code: "INVENTORY_UNAVAILABLE" } }));
    const m = new Map(r.body.map((p) => [p.id, p]));
    return ids.map((id) => m.get(id) || null);
  }, { maxBatchSize: 50 });

  const conProducto = (ctx, productoId, base) => ({ ...base, producto: () => ctx.loader.load(productoId) });

  const root = {
    // G01
    resumenPedido: async ({ pedidoId }, ctx) => {
      if (!["CLIENTE", "ADMIN"].includes(ctx.user.rol)) throw new GraphQLError("No autorizado", { extensions: { code: "FORBIDDEN" } });
      if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) throw new GraphQLError("pedidoId mal formado", { extensions: { code: "BAD_REQUEST" } });
      const api = adaptadores(ctx);
      const pagoP = api.getPago(pedidoId).catch(() => ({ status: 503 })); // en paralelo
      let r;
      try { r = await api.getPedido(pedidoId); } catch { throw new GraphQLError("Pedidos no disponible", { extensions: { code: "ORDERS_UNAVAILABLE" } }); }
      if (r.status === 404) throw new GraphQLError("Pedido no encontrado", { extensions: { code: "NOT_FOUND" } });
      if (r.status !== 200) throw new GraphQLError("Pedidos no disponible", { extensions: { code: "ORDERS_UNAVAILABLE" } });
      const p = r.body;
      return {
        pedidoId: p.pedidoId, estado: p.estado, total: p.total, creadoEn: p.creadoEn,
        items: p.items.map((i) => conProducto(ctx, i.productoId, { cantidad: i.cantidad, precioUnitario: i.precioUnitario, subtotal: i.subtotal, estado: i.estado })),
        pago: async () => {
          const rp = await pagoP;
          if (rp.status !== 200) throw new GraphQLError("Pagos no disponible", { extensions: { code: "PAYMENTS_UNAVAILABLE" } });
          return rp.body;
        },
      };
    },
    // G02
    colaDespacho: async ({ first, after }, ctx) => {
      if (!["DESPACHO", "ADMIN"].includes(ctx.user.rol)) throw new GraphQLError("No autorizado", { extensions: { code: "FORBIDDEN" } });
      if (first < 1 || first > 50) throw new GraphQLError("first debe estar entre 1 y 50", { extensions: { code: "BAD_REQUEST" } });
      let r;
      try { r = await adaptadores(ctx).getCola(first, after); } catch { throw new GraphQLError("Pedidos no disponible", { extensions: { code: "ORDERS_UNAVAILABLE" } }); }
      if (r.status !== 200) throw new GraphQLError("Pedidos no disponible", { extensions: { code: "ORDERS_UNAVAILABLE" } });
      return {
        hasNextPage: r.body.hasNextPage, endCursor: r.body.endCursor,
        edges: r.body.edges.map((e) => ({ ...e, items: e.items.map((i) => conProducto(ctx, i.productoId, { cantidad: i.cantidad })) })),
      };
    },
  };

  const app = createApp();
  app.use(serviceAuth([{ caller: "gateway", value: await secrets.obtener("gw-graphql-token") }]));

  app.post("/graphql", allowCallers("gateway"), h(async (req, res) => {
    const t = req.headers["x-user-token"];
    if (!t) throw E.unauthorized();
    const user = await verifyUserToken(t, jwks);
    const { operationName, variables, query } = req.body || {};
    const op = registradas[operationName];
    // Solo operaciones registradas (persisted queries). Una consulta libre distinta se rechaza.
    if (!op || (query !== undefined && norm(query) !== op.normalizada)) {
      return res.status(400).json({ errors: [{ message: "Operación no permitida", extensions: { code: "OPERATION_NOT_ALLOWED" } }] });
    }
    if (!op.roles.includes(user.rol)) {
      return res.status(403).json({ errors: [{ message: "No autorizado para esta operación", extensions: { code: "FORBIDDEN" } }] });
    }
    const ctx = { user, correlationId: req.correlationId };
    ctx.loader = crearLoader(ctx);
    const exec = execute({ schema, document: op.doc, rootValue: root, contextValue: ctx, variableValues: variables || {}, operationName });
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ errors: [new GraphQLError("Tiempo de respuesta excedido", { extensions: { code: "TIMEOUT" } })] }), TIMEOUT_TOTAL));
    const result = await Promise.race([exec, timeout]);
    const out = { data: result.data === undefined ? null : result.data };
    if (result.errors && result.errors.length) out.errors = result.errors.map((e) => ({ message: e.message, path: e.path, extensions: { code: (e.extensions && e.extensions.code) || "INTERNAL" } }));
    out.extensions = { llamadasInventario: ctx.llamadasInventario || 0 };
    res.json(out);
  }));

  finish(app);
  listen(app, Number(process.env.PORT || 4000));
}
main().catch((e) => { console.error(e); process.exit(1); });
