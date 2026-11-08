// Datos iniciales.
//  - Base (siempre): la carta real del local (productos y precios del frontend) y las cuentas del personal
//    (administración, despacho y dueño). Los clientes y pedidos se crean usando la página.
//  - --demo: agrega datos de prueba FICTICIOS (cliente demo, 200 clientes y 1.000 pedidos históricos) que usan
//    las pruebas automáticas, la prueba de carga y el reporte del informe. No mezclar con datos reales.
// Uso: node scripts/seed.js [--reset] [--demo]   (herramienta de desarrollo con cuenta administradora de MySQL)
require("../shared/env");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { createSecretProvider } = require("../shared/secrets");
const { crearCifrador } = require("../shared/cifrado");
const { conexionAdmin } = require("./mysql-admin");

const CATEGORIAS = ["rolls", "temaki", "sashimi", "combos", "entradas", "bebidas"];
const PRODUCTOS = [
  ["California Roll", 5990, "rolls", "8 piezas", "img/california-roll.jpg", "Roll clásico relleno de kanikama, palta y pepino, cubierto con sésamo tostado. Disponible con o sin salsa acevichada."],
  ["Ebi Tempura Roll", 7490, "rolls", "8 piezas", "img/ebi-tempura.png", "Roll frito relleno de camarón tempura y palta, cubierto con salsa acevichada y ciboulette."],
  ["Sashimi Salmón", 8990, "sashimi", "10 láminas", "img/sashimi-salmon.jpg", "Finas láminas de salmón fresco, cortadas al momento. Se sirve con jengibre encurtido y salsa de soya."],
  ["Temaki Salmón", 4990, "temaki", "1 unidad", "img/temaki-salmon.jpg", "Cono de alga nori relleno de arroz, salmón, palta y cebollín. Ideal para llevar."],
  ["Combo Fukusuke 30 piezas", 15990, "combos", "30 piezas", "img/combo-fukusuke.jpg", "Selección de nuestros rolls más pedidos: California, Ebi Tempura y Acevichado. Ideal para compartir."],
  ["Gyozas de Cerdo", 4490, "entradas", "6 unidades", "img/gyozas.jpg", "Empanaditas japonesas rellenas de cerdo y vegetales, selladas a la plancha y servidas con salsa ponzu."],
  ["Roll Acevichado", 6990, "rolls", "8 piezas", "img/roll-acevichado.jpg", "Roll relleno de camarón y palta, bañado en salsa acevichada picante y cebollín."],
  ["Bebida Lata 350cc", 1490, "bebidas", "350cc", "img/bebida-lata.jpg", "Bebida a elección (línea Cola, Naranja o Lima-Limón) para acompañar tu pedido."],
  ["Jugo Natural", 1990, "bebidas", "300cc", "img/jugo-natural.jpg", "Jugo de naranja natural, exprimido al momento. Sin azúcar añadida."],
  ["Agua Mineral", 1490, "bebidas", "500cc", "img/agua-mineral.jpg", "Agua mineral con o sin gas, ideal para acompañar sushi."],
  ["Bebida Botella 1 L", 2490, "bebidas", "1 L", "img/bebida-1l.png", "Formato botella de 1 litro, ideal para compartir en pedidos familiares."],
];
const CALLES = ["Av. Pajaritos", "Av. Los Pajaritos", "5 de Abril", "Av. Américo Vespucio", "Camino a Rinconada", "Av. Esquina Blanca", "Av. Primera Transversal", "El Conquistador"];

function runFicticio(n) {
  const cuerpo = String(10000000 + n * 7919);
  let suma = 0; let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * mult; mult = mult === 7 ? 2 : mult + 1; }
  const res = 11 - (suma % 11);
  return cuerpo + (res === 11 ? "0" : res === 10 ? "K" : String(res));
}

async function main() {
  const reset = process.argv.includes("--reset");
  const secrets = createSecretProvider();
  const cif = crearCifrador(await secrets.obtener("rut-encryption-key"));
  const db = await conexionAdmin(secrets, { dateStrings: true });

  if (reset) {
    await db.query(`SET FOREIGN_KEY_CHECKS=0;
      TRUNCATE fk_analytics.eventos_procesados; TRUNCATE fk_analytics.ventas_diarias; TRUNCATE fk_analytics.ventas_producto;
      TRUNCATE fk_payments.boletas; TRUNCATE fk_payments.pagos; TRUNCATE fk_payments.depositos_confirmados; TRUNCATE fk_payments.webhooks_procesados; TRUNCATE fk_payments.outbox; TRUNCATE fk_payments.folios;
      TRUNCATE fk_orders.detalles; TRUNCATE fk_orders.ordenes_despacho; TRUNCATE fk_orders.outbox; TRUNCATE fk_orders.pedidos;
      TRUNCATE fk_clients.direcciones; TRUNCATE fk_clients.tokens_verificacion; TRUNCATE fk_clients.mensajes_contacto; TRUNCATE fk_clients.correos_pendientes; TRUNCATE fk_clients.clientes;
      TRUNCATE fk_auth.refresh_tokens; TRUNCATE fk_auth.cuentas; TRUNCATE fk_inventory.productos; TRUNCATE fk_inventory.categorias;
      SET FOREIGN_KEY_CHECKS=1;`);
  }
  const demo = process.argv.includes("--demo");

  // Carta real del local (solo si el inventario está vacío; después se administra desde el panel)
  const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM fk_inventory.productos");
  if (n === 0) {
    for (let i = 0; i < CATEGORIAS.length; i++) await db.query("INSERT IGNORE INTO fk_inventory.categorias VALUES (?,?)", [i + 1, CATEGORIAS[i]]);
    for (const [nombre, precio, cat, formato, imagen, desc] of PRODUCTOS) {
      await db.query("INSERT INTO fk_inventory.productos (producto_id, nombre, descripcion, formato, categoria_id, precio, imagen, disponible) VALUES (?,?,?,?,?,?,?,1)",
        [crypto.randomUUID(), nombre, desc, formato, CATEGORIAS.indexOf(cat) + 1, precio, imagen]);
    }
  }
  const [productos] = await db.query("SELECT producto_id AS id, nombre, precio FROM fk_inventory.productos ORDER BY nombre");

  // Personal del local
  const personal = [
    ["admin@fukusuke.cl", "Administración Fukusuke", "ADMIN", "seed-admin-password"],
    ["despacho@fukusuke.cl", "Encargado de Despacho", "DESPACHO", "seed-despacho-password"],
    ["dueno@fukusuke.cl", "Dueño Fukusuke", "DUENO", "seed-dueno-password"],
  ];
  for (const [email, nombre, rol, ref] of personal) {
    const [[{ existe }]] = await db.query("SELECT COUNT(*) AS existe FROM fk_auth.cuentas WHERE email = ?", [email]);
    if (existe) continue;
    await db.query("INSERT INTO fk_auth.cuentas (cuenta_id, email, nombre, password_hash, rol, email_verificado, estado) VALUES (?,?,?,?,?,1,'ACTIVA')",
      [crypto.randomUUID(), email, nombre, bcrypt.hashSync(await secrets.obtener(ref), 12), rol]);
  }

  console.log(`Base lista: carta (${productos.length} productos) y cuentas del local (admin, despacho, dueño).`);
  console.log("  contraseñas: ver secrets/seed-admin-password, seed-despacho-password, seed-dueno-password (no se imprimen)");
  if (!demo) {
    console.log("  Sin datos ficticios: los clientes y pedidos se crean usando la página.");
    await db.end();
    return;
  }
  const [[{ yaDemo }]] = await db.query("SELECT COUNT(*) AS yaDemo FROM fk_auth.cuentas WHERE email = 'cliente.demo@example.com'");
  if (yaDemo) { console.log("Los datos ficticios de prueba ya estaban cargados."); await db.end(); return; }

  // ---- Datos FICTICIOS de prueba (--demo) ----
  // Clientes: 1 demo + 200 de prueba (misma contraseña de prueba, un solo hash)
  const hashCliente = bcrypt.hashSync(await secrets.obtener("seed-cliente-password"), 12);
  const clientes = [];
  for (let i = 0; i <= 200; i++) {
    const id = crypto.randomUUID();
    const email = i === 0 ? "cliente.demo@example.com" : `cliente${String(i).padStart(3, "0")}@example.com`;
    const nombre = i === 0 ? "Camila Rojas" : `Cliente de prueba ${i}`;
    const run = runFicticio(i + 1);
    const dirId = crypto.randomUUID();
    const calle = CALLES[i % CALLES.length];
    const numero = String(100 + (i * 37) % 3900);
    await db.query("INSERT INTO fk_auth.cuentas (cuenta_id, email, nombre, password_hash, rol, email_verificado, estado) VALUES (?,?,?,?, 'CLIENTE', 1, 'ACTIVA')", [id, email, nombre, hashCliente]);
    await db.query(`INSERT INTO fk_clients.clientes (cliente_id, cuenta_id, run_cifrado, run_hash, nombre, email, telefono_cifrado, fecha_nac_cifrada, sexo_cifrado) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, id, cif.cifrar(run), cif.hash(run), nombre, email, cif.cifrar(`+56 9 ${String(10000000 + i).slice(0, 4)} ${String(1000 + i)}`), cif.cifrar("1995-05-10"), cif.cifrar(i % 2 ? "M" : "F")]);
    await db.query("INSERT INTO fk_clients.direcciones (direccion_id, cliente_id, calle_cifrada, numero_cifrado, comuna, provincia, region) VALUES (?,?,?,?, 'Maipú', 'Santiago', 'Metropolitana')",
      [dirId, id, cif.cifrar(calle), cif.cifrar(numero)]);
    clientes.push({ id, dirId, calle, numero });
  }

  // 1.000 pedidos históricos pagados/entregados en los últimos 30 días + eventos en el outbox
  for (let k = 0; k < 1000; k++) {
    const c = clientes[1 + (k % 200)];
    const pid = crypto.randomUUID();
    const dias = k % 30;
    const pagado = new Date(Date.now() - dias * 86400000 - (k % 600) * 60000).toISOString().replace("T", " ").replace("Z", "");
    const lineas = [productos[k % productos.length], productos[(k * 3 + 1) % productos.length]];
    const cant = [1 + (k % 3), 1];
    const items = lineas.map((p, i) => ({ productoId: p.id, nombre: p.nombre, cantidad: cant[i], subtotal: p.precio * cant[i], precio: p.precio }));
    const total = items.reduce((a, it) => a + it.subtotal, 0);
    await db.query(`INSERT INTO fk_orders.pedidos (pedido_id, cliente_id, estado, total, creado_en, pagado_en, direccion_id, envio_calle, envio_numero, envio_comuna)
      VALUES (?,?, 'ENTREGADO', ?, ?, ?, ?, ?, ?, 'Maipú')`, [pid, c.id, total, pagado, pagado, c.dirId, c.calle, c.numero]);
    for (const it of items) {
      await db.query("INSERT INTO fk_orders.detalles (detalle_id, pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (?,?,?,?,?,?)",
        [crypto.randomUUID(), pid, it.productoId, it.nombre, it.cantidad, it.precio]);
    }
    await db.query("INSERT INTO fk_orders.outbox (event_id, tipo, payload) VALUES (?, 'PedidoPagado', ?)", [crypto.randomUUID(),
      JSON.stringify({ pedidoId: pid, fecha: pagado.slice(0, 10), comuna: "Maipú", total, tipo: "PedidoPagado",
        items: items.map(({ productoId, nombre, cantidad, subtotal }) => ({ productoId, nombre, cantidad, subtotal })) })]);
  }
  await db.end();
  console.log("Datos FICTICIOS de prueba cargados: 201 clientes (cliente.demo@example.com, cliente001..200@example.com) y 1.000 pedidos históricos.");
  console.log("  contraseña de los clientes de prueba: secrets/seed-cliente-password (no se imprime)");
}
main().catch((e) => { console.error("seed falló:", e.message); process.exit(1); });
