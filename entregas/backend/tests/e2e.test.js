// Pruebas de integración y seguridad contra el backend levantado (a través del API Gateway).
// Ejecutar con el sistema levantado (npm run start:bg):  npm test
const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const H = require("./helpers");

const ROOT = path.join(__dirname, "..");
const pass = (ref) => H.secreto(ref);
const estado = {};

describe("Fukusuke backend — integración y seguridad", { concurrency: false }, () => {
  const anon = new H.Navegador("VISITANTE");
  const clienteA = new H.Navegador("CLIENTE A");
  const clienteB = new H.Navegador("CLIENTE B");
  const admin = new H.Navegador("ADMIN");
  const despacho = new H.Navegador("DESPACHO");
  const dueno = new H.Navegador("DUENO");

  after(async () => { H.guardar(); (await H.db()).end(); });

  it("preparación: sesiones del personal y del cliente demo", async () => {
    const [[{ demo }]] = await (await H.db()).query("SELECT COUNT(*) AS demo FROM fk_auth.cuentas WHERE email = 'cliente001@example.com'");
    assert.ok(demo, "Faltan los datos ficticios de prueba: ejecuta  npm run seed:demo  antes de  npm test");
    await admin.login("admin@fukusuke.cl", pass("seed-admin-password"));
    await despacho.login("despacho@fukusuke.cl", pass("seed-despacho-password"));
    await dueno.login("dueno@fukusuke.cl", pass("seed-dueno-password"));
    await clienteB.login("cliente001@example.com", pass("seed-cliente-password"));
    const r = await anon.req("GET", "/api/v1/products?size=50");
    estado.productos = r.body.items;
    assert.equal(r.status, 200);
  });

  it("V1 — acceso anónimo a la carta devuelve solo campos públicos", async () => {
    const r = await anon.req("GET", "/api/v1/products?categoria=rolls");
    const campos = Object.keys(r.body.items[0]).sort().join(",");
    const ok = r.status === 200 && !("disponible" in r.body.items[0]);
    H.registrar("V1", "Acceso anónimo a la carta", "200, solo campos públicos", `${r.status}; campos: ${campos}`, ok);
    assert.ok(ok);
  });

  it("T02 — registro con RUN válido (201), duplicado (409) e inválido (400)", async () => {
    const email = `qa.${Date.now()}@example.com`;
    estado.nuevoEmail = email;
    const run = H.runValido(20000000 + (Date.now() % 7000000));
    const base = { run, nombre: "Prueba Integración", email, password: "ClaveSegura2026", telefono: "+56 9 5555 1234",
      fechaNacimiento: "1999-03-21", sexo: "F", direccion: { calle: "Av. Pajaritos", numero: "2020", comuna: "Maipú", provincia: "Santiago", region: "Metropolitana" } };
    const r1 = await anon.req("POST", "/api/v1/clients", { body: base });
    const r2 = await anon.req("POST", "/api/v1/clients", { body: { ...base, email: `otro.${email}` } });
    const r3 = await anon.req("POST", "/api/v1/clients", { body: { ...base, run: "12.345.678-0", email: `x.${email}` } });
    const ok = r1.status === 201 && r1.body.estado === "PENDIENTE_VERIFICACION" && !("run" in r1.body) && r2.status === 409 && r3.status === 400;
    H.registrar("T02", "Registro (RF5/RF6)", "201; RUN duplicado 409; RUN inválido 400", `${r1.status} / ${r2.status} / ${r3.status}`, ok);
    assert.ok(ok);
  });

  it("T03 — verificación de correo: enlace válido (200), reutilizado (410) y vencido (410)", async () => {
    const correo = await H.correoDe(estado.nuevoEmail);
    const token = /verificar=([A-Za-z0-9_-]+)/.exec(correo.text)[1];
    const sinVerificar = await clienteA.req("POST", "/api/v1/auth/login", { body: { email: estado.nuevoEmail, password: "ClaveSegura2026" } });
    const r1 = await anon.req("POST", "/api/v1/clients/email-verification", { body: { token } });
    const r2 = await anon.req("POST", "/api/v1/clients/email-verification", { body: { token } });
    // segundo registro con token vencido (se adelanta la fecha de expiración en la BD de prueba)
    const email2 = `qa2.${Date.now()}@example.com`;
    await anon.req("POST", "/api/v1/clients", { body: { run: H.runValido(30000000 + (Date.now() % 9000000)), nombre: "Prueba Vencida", email: email2, password: "ClaveSegura2026",
      telefono: "+56 9 5555 9999", fechaNacimiento: "2000-01-01", sexo: "M", direccion: { calle: "5 de Abril", numero: "10", comuna: "Maipú", provincia: "Santiago", region: "Metropolitana" } } });
    const token2 = /verificar=([A-Za-z0-9_-]+)/.exec((await H.correoDe(email2)).text)[1];
    await (await H.db()).query("UPDATE fk_clients.tokens_verificacion SET expira_en = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) WHERE token_hash = SHA2(?, 256)", [token2]);
    const r3 = await anon.req("POST", "/api/v1/clients/email-verification", { body: { token: token2 } });
    const ok = sinVerificar.status === 403 && r1.status === 200 && r2.status === 410 && r3.status === 410;
    H.registrar("T03", "Verificación de correo (RF11)", "login sin verificar 403; enlace 200; reutilizado 410; vencido 410",
      `${sinVerificar.status}; ${r1.status}; ${r2.status}; ${r3.status}`, ok);
    assert.ok(ok);
    await clienteA.login(estado.nuevoEmail, "ClaveSegura2026");
    const me = await clienteA.req("GET", "/api/v1/clients/me");
    estado.dirA = me.body.direcciones[0].direccionId;
    estado.runEnmascarado = me.body.run;
  });

  it("V2 — operación protegida sin sesión → 401 en el gateway (no llega a orders)", async () => {
    const r = await anon.req("POST", "/api/v1/orders", { body: { items: [], direccionId: estado.dirA } });
    await H.espera(200);
    const llego = execSync(`grep -c "${r.correlationId}" ${ROOT}/.run/logs/orders.log || true`).toString().trim();
    const ok = r.status === 401 && llego === "0";
    H.registrar("V2", "Operación protegida sin sesión", "401; orders no recibe la solicitud", `${r.status}; registros en orders: ${llego}`, ok);
    assert.ok(ok);
  });

  it("T04 — el total lo calcula el servidor; precios enviados por el navegador se ignoran", async () => {
    const [p1, p2] = [estado.productos.find((p) => p.nombre === "California Roll"), estado.productos.find((p) => p.nombre === "Bebida Lata 350cc")];
    const r = await clienteA.req("POST", "/api/v1/orders", { body: { items: [{ productoId: p1.id, cantidad: 2, precio: 1 }, { productoId: p2.id, cantidad: 1, precio: 1 }], total: 3, direccionId: estado.dirA },
      headers: { "Idempotency-Key": crypto.randomUUID() } });
    const esperado = p1.precio * 2 + p2.precio;
    estado.pedidoA = r.body;
    const ok = r.status === 201 && r.body.total === esperado && r.body.estado === "PENDIENTE_PAGO";
    H.registrar("T04", "Crear pedido (S06)", `201; total ${esperado} (precio enviado = 1 se ignora)`, `${r.status}; total ${r.body.total}; ${r.body.estado}`, ok);
    assert.ok(ok);
  });

  it("T16 — reintento del mismo pedido con la misma Idempotency-Key: mismo pedido, sin duplicar", async () => {
    const p = estado.productos.find((x) => x.nombre === "California Roll");
    const body = { items: [{ productoId: p.id, cantidad: 1 }], direccionId: estado.dirA };
    const clave = crypto.randomUUID();
    const dbp = await H.db();
    const contar = async () => (await dbp.query("SELECT COUNT(*) AS n FROM fk_orders.pedidos"))[0][0].n;
    const antes = await contar();
    const r1 = await clienteA.req("POST", "/api/v1/orders", { body, headers: { "Idempotency-Key": clave } });
    const r2 = await clienteA.req("POST", "/api/v1/orders", { body, headers: { "Idempotency-Key": clave } });
    const despues = await contar();
    const r3 = await clienteA.req("POST", "/api/v1/orders", { body: { ...body, items: [{ productoId: p.id, cantidad: 2 }] }, headers: { "Idempotency-Key": clave } });
    const r4 = await clienteA.req("POST", "/api/v1/orders", { body });
    const ok = r1.status === 201 && r2.status === 200 && r2.body.pedidoId === r1.body.pedidoId && r2.headers.get("idempotent-replayed") === "true" &&
      despues === antes + 1 && r3.status === 409 && r3.body.error.code === "IDEMPOTENCY_CONFLICT" && r4.status === 400;
    H.registrar("T16", "Reintento de pedido sin duplicación (S06)", "1.º 201; reintento 200 mismo pedidoId (Idempotent-Replayed); 1 pedido creado; misma clave con otro contenido 409; sin clave 400",
      `${r1.status}; ${r2.status} ${r2.body.pedidoId === r1.body.pedidoId ? "mismo pedidoId" : "OTRO pedidoId"}; pedidos ${antes}→${despues}; ${r3.status}; ${r4.status}`, ok);
    assert.ok(ok);
  });

  it("V12 — sesión expirada: el gateway responde 401 TOKEN_EXPIRED antes de llegar a orders", async () => {
    // token con la firma real del Auth Service pero ya vencido (la clave se lee de secrets/, nunca se imprime)
    const real = jwt.decode(clienteA.cookies.fk_at);
    const clave = crypto.createPrivateKey(H.secreto("auth-jwt-private-key"));
    const kid = crypto.createHash("sha256").update(JSON.stringify(crypto.createPublicKey(clave).export({ format: "jwk" }))).digest("hex").slice(0, 16);
    const ahora = Math.floor(Date.now() / 1000);
    const vencido = jwt.sign({ rol: real.rol, nombre: real.nombre, iat: ahora - 960, exp: ahora - 60 }, clave,
      { algorithm: "RS256", keyid: kid, subject: real.sub, issuer: real.iss, audience: real.aud });
    const expirado = new H.Navegador("CLIENTE A (sesión expirada)");
    expirado.cookies = { fk_at: vencido, fk_csrf: clienteA.cookies.fk_csrf };
    const r = await expirado.req("GET", `/api/v1/orders/${estado.pedidoA.pedidoId}`);
    await H.espera(200);
    const llego = execSync(`grep -c "${r.correlationId}" ${ROOT}/.run/logs/orders.log || true`).toString().trim();
    const ok = r.status === 401 && r.body.error.code === "TOKEN_EXPIRED" && !("pedidoId" in r.body) && llego === "0";
    H.registrar("V12", "Sesión expirada", "401 TOKEN_EXPIRED en el gateway; orders no recibe la solicitud; sin datos del pedido",
      `${r.status} ${r.body.error ? r.body.error.code : ""}; registros en orders: ${llego}`, ok);
    assert.ok(ok);
  });

  it("T05 — S07 cambia cantidad y S08 anula con motivo conservando el ítem", async () => {
    const it0 = estado.pedidoA.items.find((i) => i.nombre === "California Roll");
    const itB = estado.pedidoA.items.find((i) => i.nombre === "Bebida Lata 350cc");
    const r1 = await clienteA.req("PUT", `/api/v1/orders/${estado.pedidoA.pedidoId}/items/${it0.itemId}`, { body: { cantidad: 3 } });
    const r0 = await clienteA.req("PATCH", `/api/v1/orders/${estado.pedidoA.pedidoId}/items/${itB.itemId}/anulacion`, { body: { motivo: "" } });
    const r2 = await clienteA.req("PATCH", `/api/v1/orders/${estado.pedidoA.pedidoId}/items/${itB.itemId}/anulacion`, { body: { motivo: "Me equivoqué de bebida" } });
    const anulado = r2.body.items.find((i) => i.itemId === itB.itemId);
    const ok = r1.status === 200 && r1.body.total === it0.precioUnitario * 3 + itB.precioUnitario && r0.status === 400 &&
      r2.status === 200 && anulado.estado === "ANULADO" && anulado.motivo === "Me equivoqué de bebida" && r2.body.total === it0.precioUnitario * 3;
    estado.pedidoA = r2.body;
    H.registrar("T05", "Modificar cantidad y anular con motivo (RF3)", "200; motivo vacío 400; ítem ANULADO con motivo y total recalculado",
      `${r1.status}; ${r0.status}; ${r2.status}; ítem ${anulado.estado}; total ${r2.body.total}`, ok);
    assert.ok(ok);
  });

  it("V4 — un cliente no puede ver el pedido de otro (404 sin datos)", async () => {
    const r = await clienteB.req("GET", `/api/v1/orders/${estado.pedidoA.pedidoId}`);
    const propio = await clienteA.req("GET", `/api/v1/orders/${estado.pedidoA.pedidoId}`);
    const ok = r.status === 404 && !JSON.stringify(r.body).includes(estado.pedidoA.pedidoId) && propio.status === 200;
    H.registrar("V4", "Pedido ajeno", "dueño 200; otro cliente 404 sin datos", `dueño ${propio.status}; ajeno ${r.status}`, ok);
    assert.ok(ok);
  });

  it("V6 — pago con datos alterados: monto ignorado, aviso sin firma 401, monto distinto 409", async () => {
    const key = crypto.randomUUID();
    const r = await clienteA.req("POST", "/api/v1/payments", { body: { pedidoId: estado.pedidoA.pedidoId, metodo: "SERVIPAG", monto: 1 }, headers: { "Idempotency-Key": key } });
    const rRepetida = await clienteA.req("POST", "/api/v1/payments", { body: { pedidoId: estado.pedidoA.pedidoId, metodo: "SERVIPAG" }, headers: { "Idempotency-Key": key } });
    const [[pago]] = await (await H.db()).query("SELECT monto FROM fk_payments.pagos WHERE pago_id = ?", [r.body.pagoId]);
    estado.pagoA = r.body;
    const sinFirma = await anon.req("POST", "/api/v1/payments/webhooks/servipag", { raw: JSON.stringify({ transaccionId: "SP-FALSO-1", referencia: r.body.pagoId, monto: 1, estado: "APROBADO" }) });
    const w = H.firmarWebhook({ transaccionId: "SP-FALSO-2", referencia: r.body.pagoId, monto: 1, estado: "APROBADO" });
    const montoMalo = await anon.req("POST", "/api/v1/payments/webhooks/servipag", { raw: w.body, headers: { "X-Signature": w.header } });
    const ped = await clienteA.req("GET", `/api/v1/orders/${estado.pedidoA.pedidoId}`);
    const ok = r.status === 201 && pago.monto === estado.pedidoA.total && rRepetida.status === 201 && rRepetida.body.pagoId === r.body.pagoId &&
      sinFirma.status === 401 && montoMalo.status === 409 && ped.body.estado === "PENDIENTE_PAGO";
    H.registrar("V6", "Pago con datos alterados", "monto = total del pedido; reintento idempotente; sin firma 401; monto distinto 409; pedido sigue PENDIENTE_PAGO",
      `monto ${pago.monto}; reintento mismo pagoId; ${sinFirma.status}; ${montoMalo.status}; ${ped.body.estado}`, ok);
    assert.ok(ok);
  });

  it("T06 + V8 — pago aprobado en sandbox → PAGADO, boleta y aviso duplicado sin efecto", async () => {
    const token = /\/pagar\/([0-9a-f]+)/.exec(estado.pagoA.redirectUrl)[1];
    const r = await fetch(`http://127.0.0.1:8090/pagar/${token}/aprobar`, { method: "POST", headers: { Accept: "application/json" } }).then((x) => x.json());
    H.evidencias.push({ quien: "SERVIPAG (sandbox)", method: "POST", ruta: "/api/v1/payments/webhooks/servipag (firmado)", status: r.avisoStatus, resumen: `transaccion ${r.transaccionId} ${r.estado}` });
    await H.espera(300);
    const ped = await clienteA.req("GET", `/api/v1/orders/${estado.pedidoA.pedidoId}`);
    // reenvío del mismo aviso (mismo transaccionId)
    const w = H.firmarWebhook({ transaccionId: r.transaccionId, referencia: estado.pagoA.pagoId, monto: estado.pedidoA.total, estado: "APROBADO" });
    const dup = await anon.req("POST", "/api/v1/payments/webhooks/servipag", { raw: w.body, headers: { "X-Signature": w.header } });
    const [[{ n }]] = await (await H.db()).query("SELECT COUNT(*) n FROM fk_payments.boletas WHERE pago_id = ?", [estado.pagoA.pagoId]);
    const bol = await clienteA.req("GET", `/api/v1/payments/${estado.pagoA.pagoId}/boleta`);
    estado.folioA = bol.body.folio;
    const correo = await H.correoDe(estado.nuevoEmail);
    const ok1 = r.avisoStatus === 200 && ped.body.estado === "PAGADO" && bol.status === 200 && bol.body.cajeroVirtual === "Cajero Virtual 01";
    const ok2 = dup.status === 200 && n === 1;
    H.registrar("T06", "Pago Servipag sandbox (RF4/CU6)", "aviso 200; pedido PAGADO; boleta del cajero virtual",
      `aviso ${r.avisoStatus}; ${ped.body.estado}; boleta ${bol.body.folio}`, ok1);
    H.registrar("V8", "Aviso de pago duplicado", "200 sin nueva boleta", `${dup.status}; boletas del pago: ${n}`, ok2);
    H.registrar("T06b", "Boleta enviada por correo (RF8)", "correo con la boleta en la bandeja del cliente", correo && /Boleta/.test(correo.subject) ? `recibido: ${correo.subject}` : "no recibido", correo && /Boleta/.test(correo.subject));
    assert.ok(ok1 && ok2);
  });

  it("T08 — boleta y G01: dueño 200; otro cliente NOT_FOUND; DataLoader en una llamada", async () => {
    const vars = { operationName: "ResumenPedido", variables: { pedidoId: estado.pedidoA.pedidoId } };
    const g1 = await clienteA.req("POST", "/api/v1/graphql", { body: vars });
    const g2 = await clienteB.req("POST", "/api/v1/graphql", { body: vars });
    const b2 = await clienteB.req("GET", `/api/v1/payments/${estado.pagoA.pagoId}/boleta`);
    const d = g1.body.data && g1.body.data.resumenPedido;
    const ok = g1.status === 200 && d && d.pago.folioBoleta === estado.folioA && d.items.every((i) => i.producto && i.producto.nombre) &&
      g1.body.extensions.llamadasInventario === 1 && g2.body.data.resumenPedido === null && g2.body.errors[0].extensions.code === "NOT_FOUND" && b2.status === 404;
    H.registrar("T08", "Boleta propia vs ajena (RF8, S13, G01)", "G01 con folio y productos (1 llamada a inventory); ajeno NOT_FOUND; S13 ajeno 404",
      `folio ${d && d.pago.folioBoleta}; llamadas inventory ${g1.body.extensions.llamadasInventario}; ajeno ${g2.body.errors[0].extensions.code}; S13 ${b2.status}`, ok);
    assert.ok(ok);
  });

  const OP = `OP-${Date.now()}`;
  it("T07 — depósito: CLIENTE no confirma (403), ADMIN sí (200), operación repetida 422", async () => {
    const p = estado.productos.find((x) => x.nombre === "Temaki Salmón");
    const ped = await clienteA.req("POST", "/api/v1/orders", { body: { items: [{ productoId: p.id, cantidad: 1 }], direccionId: estado.dirA }, headers: { "Idempotency-Key": crypto.randomUUID() } });
    const pago = await clienteA.req("POST", "/api/v1/payments", { body: { pedidoId: ped.body.pedidoId, metodo: "DEPOSITO" }, headers: { "Idempotency-Key": crypto.randomUUID() } });
    const pend = await admin.req("GET", "/api/v1/payments/pendientes");
    const c1 = await clienteA.req("POST", `/api/v1/payments/${pago.body.pagoId}/confirmacion`, { body: { numeroOperacion: OP, fechaDeposito: "2026-11-06" } });
    const c2 = await admin.req("POST", `/api/v1/payments/${pago.body.pagoId}/confirmacion`, { body: { numeroOperacion: OP, fechaDeposito: "2026-11-06" } });
    // otro depósito con el mismo número de operación
    const ped2 = await clienteA.req("POST", "/api/v1/orders", { body: { items: [{ productoId: p.id, cantidad: 2 }], direccionId: estado.dirA }, headers: { "Idempotency-Key": crypto.randomUUID() } });
    const pago2 = await clienteA.req("POST", "/api/v1/payments", { body: { pedidoId: ped2.body.pedidoId, metodo: "DEPOSITO" }, headers: { "Idempotency-Key": crypto.randomUUID() } });
    const c3 = await admin.req("POST", `/api/v1/payments/${pago2.body.pagoId}/confirmacion`, { body: { numeroOperacion: OP, fechaDeposito: "2026-11-06" } });
    estado.pedidoDeposito = ped.body.pedidoId;
    const ok = pago.status === 201 && pago.body.instruccionesDeposito && pend.body.some((x) => x.pagoId === pago.body.pagoId) &&
      c1.status === 403 && c2.status === 200 && /^B-\d{6}$/.test(c2.body.folioBoleta) && c3.status === 422;
    H.registrar("T07", "Confirmación de depósito (S12, S21)", "CLIENTE 403; ADMIN 200 con folio; N° operación repetido 422",
      `${c1.status}; ${c2.status} ${c2.body.folioBoleta}; ${c3.status}`, ok);
    assert.ok(ok);
  });

  it("T09 — cola de despacho en orden de llegada; transición inválida 409; G02 por GraphQL", async () => {
    const q = await despacho.req("GET", "/api/v1/orders/dispatch-queue?first=50");
    const fechas = q.body.edges.map((e) => e.pagadoEn);
    const ordenada = fechas.every((f, i) => i === 0 || fechas[i - 1] <= f);
    const enCola = q.body.edges.find((e) => e.pedidoId === estado.pedidoA.pedidoId);
    const sinDatosPersonales = q.body.edges.every((e) => !("email" in e) && !("run" in e) && !("telefono" in e));
    const malo = await despacho.req("PATCH", `/api/v1/orders/${estado.pedidoA.pedidoId}/estado`, { body: { estado: "ENTREGADO" } });
    const prep = await despacho.req("PATCH", `/api/v1/orders/${estado.pedidoA.pedidoId}/estado`, { body: { estado: "EN_PREPARACION" } });
    const g = await despacho.req("POST", "/api/v1/graphql", { body: { operationName: "ColaDespacho", variables: { first: 10 } } });
    const gCliente = await clienteA.req("POST", "/api/v1/graphql", { body: { operationName: "ColaDespacho", variables: { first: 10 } } });
    const camino = await despacho.req("PATCH", `/api/v1/orders/${estado.pedidoA.pedidoId}/estado`, { body: { estado: "EN_CAMINO", chofer: "Jorge M." } });
    const ok = q.status === 200 && ordenada && enCola && sinDatosPersonales && malo.status === 409 && prep.status === 200 && prep.body.ordenDespacho.ordenId &&
      g.status === 200 && Array.isArray(g.body.data.colaDespacho.edges) && gCliente.status === 403 && camino.status === 200;
    H.registrar("T09", "Cola y estados de despacho (RF13/CU9, S17, S18, G02)", "cola ordenada por pagadoEn sin datos personales; PAGADO→ENTREGADO 409; orden impresa; G02 CLIENTE 403",
      `orden asc: ${ordenada}; ${malo.status}; ${prep.status}; G02 ${g.status}/${gCliente.status}; EN_CAMINO ${camino.status}`, ok);
    assert.ok(ok);
  });

  it("T10 — reporte de ventas por período (DUENO 200; DESPACHO 403; rango > 366 días 400)", async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    let r;
    for (let i = 0; i < 30; i++) { // consistencia eventual: espera a que el outbox llegue a analytics
      r = await dueno.req("GET", `/api/v1/reports/sales?desde=${desde}&hasta=${hoy}`, { registrar: false });
      if (r.status === 200 && r.body.cantidadPedidos >= 1000) break;
      await H.espera(1000);
    }
    r = await dueno.req("GET", `/api/v1/reports/sales?desde=${desde}&hasta=${hoy}`);
    const r2 = await despacho.req("GET", `/api/v1/reports/sales?desde=${desde}&hasta=${hoy}`);
    const r3 = await dueno.req("GET", "/api/v1/reports/sales?desde=2024-01-01&hasta=2026-11-06");
    estado.reporte = r.body;
    const sinPII = !JSON.stringify(r.body).match(/@|run|calle/i);
    const ok = r.status === 200 && r.body.cantidadPedidos >= 1000 && r.body.topProductos.length > 0 && sinPII && r2.status === 403 && r3.status === 400;
    H.registrar("T10", "Reporte de ventas (RF9/CU8, S19)", "200 con agregados sin datos personales; DESPACHO 403; rango > 366 días 400",
      `${r.status} (${r.body.cantidadPedidos} pedidos, $${r.body.totalVentas}); ${r2.status}; ${r3.status}`, ok);
    assert.ok(ok);
  });

  it("T11 + V3 — ADMIN crea y deshabilita productos; CLIENTE recibe 403 y nada cambia", async () => {
    const nuevo = { nombre: `Hand Roll Prueba ${Date.now() % 10000}`, descripcion: "Producto de prueba", formato: "1 unidad", categoriaId: 2, precio: 3990, imagen: "img/temaki-salmon.jpg", disponible: true };
    const c = await admin.req("POST", "/api/v1/products", { body: nuevo });
    const intento = await clienteA.req("PUT", `/api/v1/products/${c.body.id}`, { body: { ...nuevo, precio: 1 } });
    const intento2 = await clienteA.req("POST", "/api/v1/products", { body: nuevo });
    const borrar = await clienteA.req("DELETE", `/api/v1/products/${c.body.id}`);
    const sinCambio = await admin.req("GET", `/api/v1/products/${c.body.id}`);
    const des = await admin.req("PUT", `/api/v1/products/${c.body.id}`, { body: { ...nuevo, disponible: false } });
    const publico = await anon.req("GET", `/api/v1/products?categoria=temaki&page=1&size=49`);
    const oculto = !publico.body.items.some((p) => p.id === c.body.id);
    const okT11 = c.status === 201 && des.status === 200 && des.body.disponible === false && oculto;
    const okV3 = intento.status === 403 && intento2.status === 403 && borrar.status === 405 && sinCambio.body.precio === 3990;
    H.registrar("T11", "Mantenedor de productos (RF10/CU4, S15, S16)", "ADMIN crea 201 y deshabilita 200; la carta pública ya no lo muestra", `${c.status}; ${des.status}; oculto en carta: ${oculto}`, okT11);
    H.registrar("V3", "Administración desde rol sin permiso", "CLIENTE PUT/POST 403; DELETE 405; precio sin cambios", `${intento.status}/${intento2.status}/${borrar.status}; precio ${sinCambio.body.precio}`, okV3);
    H.registrar("T01", "La carta solo muestra productos habilitados (RF1/RF7)", "producto deshabilitado no aparece en S01", `oculto: ${oculto}`, oculto);
    assert.ok(okT11 && okV3);
  });

  it("T14 — mantenedor de clientes (RF10/CU3): buscar, ficha, editar, deshabilitar/habilitar y eliminar datos", async () => {
    const clienteC = new H.Navegador("CLIENTE C");
    const email = `qa3.${Date.now()}@example.com`;
    const run = H.runValido(40000000 + (Date.now() % 9000000));
    await anon.req("POST", "/api/v1/clients", { body: { run, nombre: "Cliente Mantenedor", email, password: "ClaveSegura2026", telefono: "+56 9 4444 1111",
      fechaNacimiento: "1990-07-15", sexo: "M", direccion: { calle: "Camino a Rinconada", numero: "100", comuna: "Maipú", provincia: "Santiago", region: "Metropolitana" } } });
    const token = /verificar=([A-Za-z0-9_-]+)/.exec((await H.correoDe(email)).text)[1];
    await anon.req("POST", "/api/v1/clients/email-verification", { body: { token } });
    await clienteC.login(email, "ClaveSegura2026");
    const lista = await admin.req("GET", `/api/v1/clients?q=${encodeURIComponent(email)}`);
    const id = lista.body.items[0] && lista.body.items[0].clienteId;
    const sinDatosDeMas = lista.body.items[0] && !("telefono" in lista.body.items[0]) && /\*/.test(lista.body.items[0].run);
    const porRun = await admin.req("GET", `/api/v1/clients?q=${encodeURIComponent(run)}`);
    const ficha = await admin.req("GET", `/api/v1/clients/${id}`);
    const edit = await admin.req("PUT", `/api/v1/clients/${id}`, { body: { nombre: "Cliente Mantenedor Editado", telefono: "+56 9 4444 2222",
      direccion: { calle: "Camino a Rinconada", numero: "999", comuna: "Maipú", provincia: "Santiago", region: "Metropolitana" } } });
    const ficha2 = await admin.req("GET", `/api/v1/clients/${id}`);
    const off = await admin.req("PATCH", `/api/v1/clients/${id}/estado`, { body: { estado: "INACTIVO" } });
    const refreshOff = await clienteC.req("POST", "/api/v1/auth/refresh", { body: {} });
    const loginOff = await new H.Navegador("CLIENTE C (2)").req("POST", "/api/v1/auth/login", { body: { email, password: "ClaveSegura2026" } });
    const on = await admin.req("PATCH", `/api/v1/clients/${id}/estado`, { body: { estado: "ACTIVO" } });
    const del = await admin.req("DELETE", `/api/v1/clients/${id}`);
    const fichaDel = await admin.req("GET", `/api/v1/clients/${id}`);
    const buscaDel = await admin.req("GET", `/api/v1/clients?q=${encodeURIComponent(email)}`);
    const loginDel = await new H.Navegador("CLIENTE C (3)").req("POST", "/api/v1/auth/login", { body: { email, password: "ClaveSegura2026" } });
    const dbp = await H.db();
    const [[{ dirs }]] = await dbp.query("SELECT COUNT(*) dirs FROM fk_clients.direcciones WHERE cliente_id = ?", [id]);
    const [[cli]] = await dbp.query("SELECT nombre, eliminado_en FROM fk_clients.clientes WHERE cliente_id = ?", [id]);
    const ok = lista.status === 200 && lista.body.total === 1 && sinDatosDeMas && porRun.body.total === 1 && ficha.status === 200 && ficha.body.telefono === "+56 9 4444 1111" &&
      edit.status === 200 && ficha2.body.direccion.numero === "999" && ficha2.body.nombre === "Cliente Mantenedor Editado" &&
      off.status === 200 && off.body.estado === "INACTIVO" && refreshOff.status === 401 && loginOff.status === 403 && on.body.estado === "ACTIVO" &&
      del.status === 204 && fichaDel.status === 404 && buscaDel.body.total === 0 && loginDel.status === 401 && dirs === 0 && cli.nombre === "Cliente eliminado" && !!cli.eliminado_en;
    H.registrar("T14", "Mantenedor de clientes (RF10/CU3, S22–S26)",
      "buscar por correo/RUN 200 (RUN enmascarado, sin teléfono); ficha 200; editar 200; INACTIVO revoca sesión (401) y bloquea login (403); ACTIVO 200; eliminar 204 → 404, sin direcciones",
      `${lista.status} (total ${lista.body.total}, por RUN ${porRun.body.total}); ${ficha.status}; ${edit.status}; ${off.body.estado}: refresh ${refreshOff.status}, login ${loginOff.status}; ${on.body.estado}; ` +
      `${del.status} → ${fichaDel.status}; direcciones ${dirs}; login ${loginDel.status}`, ok);
    assert.ok(ok);
  });

  it("T15 — mantenedor de usuarios del personal (RF10/CU2): listar, crear, cambiar rol y deshabilitar", async () => {
    const lista = await admin.req("GET", "/api/v1/users");
    const sinHash = lista.status === 200 && lista.body.items.some((u) => u.email === "admin@fukusuke.cl") && !JSON.stringify(lista.body).includes("password");
    const email = `cocina.${Date.now()}@fukusuke.cl`;
    const nuevo = await admin.req("POST", "/api/v1/users", { body: { nombre: "Cocina Turno Noche", email, rol: "DESPACHO", password: "ClaveSegura2026" } });
    const dup = await admin.req("POST", "/api/v1/users", { body: { nombre: "Duplicado", email, rol: "DESPACHO", password: "ClaveSegura2026" } });
    const malRol = await admin.req("POST", "/api/v1/users", { body: { nombre: "Rol inválido", email: `x.${email}`, rol: "CLIENTE", password: "ClaveSegura2026" } });
    const cocina = new H.Navegador("DESPACHO nuevo");
    await cocina.login(email, "ClaveSegura2026");
    const cola = await cocina.req("GET", "/api/v1/orders/dispatch-queue?first=5");
    const rol = await admin.req("PATCH", `/api/v1/users/${nuevo.body.cuentaId}`, { body: { rol: "DUENO" } });
    const refreshTrasRol = await cocina.req("POST", "/api/v1/auth/refresh", { body: {} });
    const bloq = await admin.req("PATCH", `/api/v1/users/${nuevo.body.cuentaId}`, { body: { estado: "BLOQUEADA" } });
    const loginBloq = await new H.Navegador("DESPACHO bloqueado").req("POST", "/api/v1/auth/login", { body: { email, password: "ClaveSegura2026" } });
    const yo = lista.body.items.find((u) => u.email === "admin@fukusuke.cl");
    const propio = await admin.req("PATCH", `/api/v1/users/${yo.cuentaId}`, { body: { estado: "BLOQUEADA" } });
    const ok = sinHash && nuevo.status === 201 && nuevo.body.rol === "DESPACHO" && dup.status === 409 && malRol.status === 400 && cola.status === 200 &&
      rol.status === 200 && rol.body.rol === "DUENO" && refreshTrasRol.status === 401 && bloq.body.estado === "BLOQUEADA" && loginBloq.status === 403 && propio.status === 409;
    H.registrar("T15", "Mantenedor de usuarios del personal (RF10/CU2, S27–S29)",
      "listar 200 sin hashes; crear 201 (correo repetido 409, rol CLIENTE 400); el nuevo DESPACHO entra a la cola; cambio de rol revoca sesión; BLOQUEADA impide login (403); ADMIN no se deshabilita a sí mismo (409)",
      `${lista.status}; ${nuevo.status} (${dup.status}, ${malRol.status}); cola ${cola.status}; rol ${rol.body.rol}, refresh ${refreshTrasRol.status}; ${bloq.body.estado}, login ${loginBloq.status}; propio ${propio.status}`, ok);
    assert.ok(ok);
  });

  it("V11 — mantenedores restringidos: CLIENTE y DESPACHO no administran clientes ni usuarios", async () => {
    const r1 = await clienteA.req("GET", "/api/v1/clients");
    const r2 = await clienteA.req("DELETE", `/api/v1/clients/${crypto.randomUUID()}`);
    const r3 = await despacho.req("POST", "/api/v1/users", { body: { nombre: "Intruso", email: "intruso@example.com", rol: "ADMIN", password: "ClaveSegura2026" } });
    const r4 = await anon.req("GET", "/api/v1/users");
    const ok = r1.status === 403 && r2.status === 403 && r3.status === 403 && r4.status === 401;
    H.registrar("V11", "Mantenedores desde roles sin permiso", "CLIENTE listar/eliminar clientes 403; DESPACHO crear usuario 403; anónimo 401",
      `${r1.status} / ${r2.status} / ${r3.status} / ${r4.status}`, ok);
    assert.ok(ok);
  });

  it("V5 — acceso directo a un microservicio sin credencial de servicio → 401", async () => {
    const id = estado.pedidoA.pedidoId;
    const directo = await fetch(`http://127.0.0.1:8082/orders/${id}`);
    const conTokenUsuarioFalso = await fetch(`http://127.0.0.1:8082/orders/${id}`, { headers: { "X-User-Token": "eyJhbGciOiJub25lIn0.e30." } });
    // token de servicio correcto pero JWT de usuario firmado con otra clave
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const falso = jwt.sign({ rol: "ADMIN" }, privateKey, { algorithm: "RS256", keyid: "falso", subject: crypto.randomUUID(), issuer: "fukusuke-auth", audience: "fukusuke-api", expiresIn: 600 });
    const forjado = await fetch(`http://127.0.0.1:8082/orders/${id}`, { headers: { Authorization: `Bearer ${H.secreto("gw-orders-token")}`, "X-User-Token": falso } });
    const gql = await fetch("http://127.0.0.1:4000/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationName: "ResumenPedido", variables: { pedidoId: id } }) });
    const ok = directo.status === 401 && conTokenUsuarioFalso.status === 401 && forjado.status === 401 && gql.status === 401;
    H.evidencias.push({ quien: "curl directo", method: "GET", ruta: `http://127.0.0.1:8082/orders/${id.slice(0, 8)}…`, status: directo.status, resumen: "Falta credencial de servicio" });
    H.registrar("V5", "Acceso directo al backend", "401 sin token de servicio; 401 con JWT forjado; GraphQL privado 401",
      `orders ${directo.status}; token falso ${conTokenUsuarioFalso.status}; JWT forjado ${forjado.status}; graphql ${gql.status}`, ok);
    assert.ok(ok);
  });

  it("V7 — GraphQL: consulta no registrada, campo no autorizado, profundidad e introspección → 400", async () => {
    const q1 = await clienteA.req("POST", "/api/v1/graphql", { body: { query: `{ resumenPedido(pedidoId:"${estado.pedidoA.pedidoId}") { pedidoId cliente { run } } }` } });
    const q2 = await clienteA.req("POST", "/api/v1/graphql", { body: { query: "{ __schema { types { name } } }" } });
    const q3 = await clienteA.req("POST", "/api/v1/graphql", { body: { operationName: "ResumenPedido", query: "query ResumenPedido($pedidoId: ID!) { resumenPedido(pedidoId: $pedidoId) { items { producto { id } } } }", variables: { pedidoId: estado.pedidoA.pedidoId } } });
    const ok = [q1, q2, q3].every((q) => q.status === 400 && q.body.errors[0].extensions.code === "OPERATION_NOT_ALLOWED");
    H.registrar("V7", "Consultas GraphQL no permitidas", "400 OPERATION_NOT_ALLOWED", `${q1.status}/${q2.status}/${q3.status}`, ok);
    assert.ok(ok);
  });

  it("V9 — CSRF: escritura sin cabecera anti-CSRF → 403", async () => {
    const p = estado.productos[0];
    const r = await clienteA.req("POST", "/api/v1/orders", { body: { items: [{ productoId: p.id, cantidad: 1 }], direccionId: estado.dirA }, sinCsrf: true });
    H.registrar("V9", "Escritura sin token anti-CSRF", "403", String(r.status), r.status === 403);
    assert.equal(r.status, 403);
  });

  it("T13 — inventory detenido: carta 503 y luego se recupera; crear pedido 503 sin crear nada; G01 con error parcial", async () => {
    const dbp = await H.db();
    const [[{ antes }]] = await dbp.query("SELECT COUNT(*) antes FROM fk_orders.pedidos");
    process.kill(Number(fs.readFileSync(`${ROOT}/.run/pids/inventory.pid`, "utf8")));
    let r, g, despues, carta;
    try {
      await H.espera(500);
      // con sesión para no usar la caché de 60 s que el gateway aplica a la carta anónima
      carta = await clienteA.req("GET", "/api/v1/products?size=50");
      const p = estado.productos[0];
      r = await clienteA.req("POST", "/api/v1/orders", { body: { items: [{ productoId: p.id, cantidad: 1 }], direccionId: estado.dirA }, headers: { "Idempotency-Key": crypto.randomUUID() } });
      g = await clienteA.req("POST", "/api/v1/graphql", { body: { operationName: "ResumenPedido", variables: { pedidoId: estado.pedidoA.pedidoId } } });
      [[{ despues }]] = await dbp.query("SELECT COUNT(*) despues FROM fk_orders.pedidos");
    } finally {
      execSync(`"${process.execPath}" "${ROOT}/scripts/start.js" --solo inventory`);
    }
    let recuperada = null;
    for (let i = 0; i < 20 && !(recuperada && recuperada.status === 200); i++) {
      await H.espera(500);
      recuperada = await clienteA.req("GET", "/api/v1/products?size=50");
    }
    const cartaOk = carta.status === 503 && carta.body.error.code === "SERVICE_UNAVAILABLE" && !("items" in carta.body) &&
      recuperada.status === 200 && recuperada.body.items.length === estado.productos.length;
    const parcial = g.status === 200 && g.body.data.resumenPedido && g.body.data.resumenPedido.estado && g.body.data.resumenPedido.items[0].producto === null &&
      g.body.errors.some((e) => e.extensions.code === "INVENTORY_UNAVAILABLE");
    const ok = cartaOk && r.status === 503 && antes === despues && parcial;
    H.registrar("T13", "Falla de inventory y recuperación", "carta 503 sin datos y 200 al reiniciar inventory; pedido 503 y no se crea; G01 con producto null + INVENTORY_UNAVAILABLE",
      `carta ${carta.status} → ${recuperada.status} (${recuperada.body.items ? recuperada.body.items.length : 0} productos); pedido ${r.status}; pedidos ${antes}→${despues}; G01 parcial: ${parcial}`, ok);
    assert.ok(ok);
  });

  it("V10 — fuerza bruta de login: bloqueo temporal tras 5 intentos (429)", async () => {
    const atacante = new H.Navegador("ATACANTE");
    const codigos = [];
    for (let i = 0; i < 6; i++) codigos.push((await atacante.req("POST", "/api/v1/auth/login", { body: { email: estado.nuevoEmail, password: "incorrecta" } })).status);
    const ok = codigos.slice(0, 4).every((c) => c === 401) && codigos[4] === 429 && codigos[5] === 429;
    H.registrar("V10", "Fuerza bruta de login", "401 ×4, luego 429 (cuenta bloqueada 15 min)", codigos.join(", "), ok);
    assert.ok(ok);
  });
});
