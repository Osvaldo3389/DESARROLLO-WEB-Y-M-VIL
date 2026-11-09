// inventory — carta, categorías, precio vigente y disponibilidad (autoridad del precio).
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "inventory";
const crypto = require("crypto");
const { createApp, finish, listen, h } = require("../../shared/service");
const { createSecretProvider } = require("../../shared/secrets");
const { createPool } = require("../../shared/db");
const { serviceAuth, allowCallers, createJwks, userContext, requireUser } = require("../../shared/auth");
const { E } = require("../../shared/errors");
const { isUUID, isInt, isStr, assertObject, requireUUID } = require("../../shared/validate");

const CATEGORIAS = ["rolls", "temaki", "sashimi", "combos", "entradas", "bebidas"];

async function main() {
  const secrets = createSecretProvider();
  const pool = await createPool(secrets, "inventory");
  const jwks = createJwks(process.env.AUTH_URL || "http://auth:8086");
  const tokens = [
    { caller: "gateway", value: await secrets.obtener("gw-inventory-token") },
    { caller: "orders", value: await secrets.obtener("orders-inventory-token") },
    { caller: "graphql", value: await secrets.obtener("gql-inventory-read") },
  ];
  const app = createApp();
  app.use(serviceAuth(tokens), userContext(jwks));

  // DTO público: sin datos internos
  const dtoPublico = (p) => ({ id: p.producto_id, nombre: p.nombre, descripcion: p.descripcion, formato: p.formato, categoria: p.categoria, precio: p.precio, imagen: p.imagen });
  const dtoAdmin = (p) => ({ ...dtoPublico(p), disponible: !!p.disponible });
  const SELECT = "SELECT p.*, c.nombre AS categoria FROM productos p JOIN categorias c ON c.categoria_id = p.categoria_id";

  // S01 — carta (solo disponibles). ADMIN puede pedir todos=true para P11.
  app.get("/products", allowCallers("gateway"), h(async (req, res) => {
    const { categoria } = req.query;
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const size = req.query.size === undefined ? 50 : Number(req.query.size);
    if (categoria !== undefined && !CATEGORIAS.includes(categoria)) throw E.badRequest("Categoría inválida");
    if (!isInt(page, 1, 1000) || !isInt(size, 1, 50)) throw E.badRequest("Paginación inválida");
    const todos = req.query.todos === "true" && req.user && req.user.rol === "ADMIN";
    const where = [];
    const args = [];
    if (!todos) where.push("p.disponible = 1");
    if (categoria) { where.push("c.nombre = ?"); args.push(categoria); }
    const w = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM productos p JOIN categorias c ON c.categoria_id = p.categoria_id${w}`, args);
    const [rows] = await pool.query(`${SELECT}${w} ORDER BY c.categoria_id, p.nombre LIMIT ? OFFSET ?`, [...args, size, (page - 1) * size]);
    res.json({ items: rows.map(todos ? dtoAdmin : dtoPublico), page, total });
  }));

  // S02 — detalle
  app.get("/products/:id", allowCallers("gateway"), h(async (req, res) => {
    const id = requireUUID(req.params.id);
    const [[p]] = await pool.query(`${SELECT} WHERE p.producto_id = ?`, [id]);
    const esAdmin = req.user && req.user.rol === "ADMIN";
    if (!p || (!p.disponible && !esAdmin)) throw E.notFound("Producto no encontrado");
    res.json(esAdmin ? dtoAdmin(p) : dtoPublico(p));
  }));

  function validarProducto(b) {
    assertObject(b);
    const errores = [];
    if (!isStr(b.nombre, 2, 80)) errores.push("nombre");
    if (!isStr(b.descripcion, 2, 400)) errores.push("descripcion");
    if (b.formato !== undefined && !isStr(b.formato, 0, 30)) errores.push("formato");
    if (!isInt(b.categoriaId, 1, CATEGORIAS.length)) errores.push("categoriaId");
    if (!isInt(b.precio, 1, 1000000)) errores.push("precio");
    if (!isStr(b.imagen, 1, 200) || !/^(\/|img\/)[\w\-./]+$/.test(b.imagen)) errores.push("imagen");
    if (typeof b.disponible !== "boolean") errores.push("disponible");
    if (errores.length) throw E.badRequest("Datos de producto inválidos", { campos: errores });
  }

  // S15 — crear producto (ADMIN, re-verificado aquí además del gateway)
  app.post("/products", allowCallers("gateway"), requireUser("ADMIN"), h(async (req, res) => {
    validarProducto(req.body);
    const id = crypto.randomUUID();
    const b = req.body;
    try {
      await pool.query("INSERT INTO productos (producto_id, nombre, descripcion, formato, categoria_id, precio, imagen, disponible) VALUES (?,?,?,?,?,?,?,?)",
        [id, b.nombre.trim(), b.descripcion.trim(), (b.formato || "").trim(), b.categoriaId, b.precio, b.imagen, b.disponible ? 1 : 0]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw E.conflict("Ya existe un producto con ese nombre");
      throw e;
    }
    res.status(201).json({ id });
  }));

  // S16 — reemplazar producto / disponibilidad (no existe DELETE: el historial lo referencia)
  app.put("/products/:id", allowCallers("gateway"), requireUser("ADMIN"), h(async (req, res) => {
    const id = requireUUID(req.params.id);
    validarProducto(req.body);
    const b = req.body;
    let r;
    try {
      [r] = await pool.query("UPDATE productos SET nombre=?, descripcion=?, formato=?, categoria_id=?, precio=?, imagen=?, disponible=? WHERE producto_id=?",
        [b.nombre.trim(), b.descripcion.trim(), (b.formato || "").trim(), b.categoriaId, b.precio, b.imagen, b.disponible ? 1 : 0, id]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw E.conflict("Ya existe un producto con ese nombre");
      throw e;
    }
    if (!r.affectedRows) throw E.notFound("Producto no encontrado");
    const [[p]] = await pool.query(`${SELECT} WHERE p.producto_id = ?`, [id]);
    res.json(dtoAdmin(p));
  }));

  // Interno (orders): precio vigente y disponibilidad
  app.post("/internal/availability", allowCallers("orders"), h(async (req, res) => {
    assertObject(req.body);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : null;
    if (!ids || !ids.length || ids.length > 50 || !ids.every(isUUID)) throw E.badRequest("ids inválidos");
    const [rows] = await pool.query("SELECT producto_id, nombre, precio, disponible FROM productos WHERE producto_id IN (?)", [ids]);
    res.json(rows.map((p) => ({ productoId: p.producto_id, nombre: p.nombre, precio: p.precio, disponible: !!p.disponible })));
  }));

  // Interno (graphql, solo lectura): datos públicos por lote (DataLoader)
  app.get("/internal/products", allowCallers("graphql"), h(async (req, res) => {
    const ids = String(req.query.ids || "").split(",").filter(Boolean);
    if (!ids.length || ids.length > 50 || !ids.every(isUUID)) throw E.badRequest("ids inválidos");
    const [rows] = await pool.query("SELECT producto_id, nombre, imagen FROM productos WHERE producto_id IN (?)", [ids]);
    res.json(rows.map((p) => ({ id: p.producto_id, nombre: p.nombre, imagen: p.imagen })));
  }));

  finish(app);
  listen(app, Number(process.env.PORT || 8081));
}
main().catch((e) => { console.error(e); process.exit(1); });
