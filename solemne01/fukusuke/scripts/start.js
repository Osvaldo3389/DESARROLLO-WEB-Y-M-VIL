// Levanta Fukusuke completo en tu PC (Windows, macOS o Linux) sin Docker:
// 6 microservicios + gateway GraphQL + simuladores de Servipag y correo + API Gateway HTTPS que sirve la página.
//
//   npm start                      → todo en primer plano (Ctrl+C para detener); con --abrir abre el navegador
//   npm run start:bg               → todo en segundo plano (detener con: npm stop)
//   node scripts/start.js --solo inventory   → (re)inicia un solo servicio en segundo plano
//
// Requiere: Node 20+ y MySQL 8 o MariaDB 10.4+ (por ejemplo la de XAMPP) encendido, y haber corrido `npm run setup`.
const { RAIZ } = require("../shared/env");
const fs = require("fs");
const path = require("path");
const net = require("net");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");

const RUN = path.join(RAIZ, ".run");
const LOGS = path.join(RUN, "logs");
const PIDS = path.join(RUN, "pids");
const SECRETS = path.resolve(process.env.SECRETS_DIR || path.join(RAIZ, "secrets"));
const GW_PORT = Number(process.env.GATEWAY_PORT || 8443);
const URL_PAGINA = `https://localhost:${GW_PORT}`;

// Copia de lo que se muestra en pantalla en .run/arranque.log (útil para revisar qué pasó)
fs.mkdirSync(RUN, { recursive: true });
const registro = fs.createWriteStream(path.join(RUN, "arranque.log"), { flags: process.argv.includes("--solo") ? "a" : "w" });
for (const m of ["log", "error"]) {
  const original = console[m].bind(console);
  console[m] = (...a) => { original(...a); registro.write(a.join(" ") + "\n"); };
}

const SERVICIOS = [
  { nombre: "auth", puerto: 8086, script: "services/auth/index.js" },
  { nombre: "inventory", puerto: 8081, script: "services/inventory/index.js" },
  { nombre: "clients", puerto: 8083, script: "services/clients/index.js" },
  { nombre: "orders", puerto: 8082, script: "services/orders/index.js" },
  { nombre: "payments", puerto: 8084, script: "services/payments/index.js" },
  { nombre: "analytics", puerto: 8085, script: "services/analytics/index.js" },
  { nombre: "graphql", puerto: 4000, script: "graphql-gateway/index.js" },
  { nombre: "mail-sandbox", puerto: 8025, script: "sandbox/mail/index.js" },
  { nombre: "servipag-sandbox", puerto: 8090, script: "sandbox/servipag/index.js" },
  { nombre: "gateway", puerto: GW_PORT, script: "gateway/index.js", host: process.env.GATEWAY_HOST || "127.0.0.1", tls: true },
];
const porNombre = Object.fromEntries(SERVICIOS.map((s) => [s.nombre, s]));
const url = (n) => `http://127.0.0.1:${porNombre[n].puerto}`;

function entorno() {
  const env = {
    ...process.env,
    SECRETS_DIR: SECRETS,
    SECRET_PROVIDER: process.env.SECRET_PROVIDER || "file",
    DB_HOST: process.env.DB_HOST || "127.0.0.1",
    DB_PORT: process.env.DB_PORT || "3306",
    AUTH_URL: url("auth"), INVENTORY_URL: url("inventory"), ORDERS_URL: url("orders"), CLIENTS_URL: url("clients"),
    PAYMENTS_URL: url("payments"), ANALYTICS_URL: url("analytics"), GRAPHQL_URL: url("graphql"),
    MAIL_URL: url("mail-sandbox"), SERVIPAG_URL: url("servipag-sandbox"),
    FRONTEND_DIR: path.join(RAIZ, "frontend"),
    PUBLIC_URL: URL_PAGINA,
    WEBHOOK_URL: `https://127.0.0.1:${GW_PORT}/api/v1/payments/webhooks/servipag`,
    SERVIPAG_PUBLIC_URL: `http://localhost:${porNombre["servipag-sandbox"].puerto}`,
    OUTBOX_INTERVAL_MS: process.env.OUTBOX_INTERVAL_MS || "5000",
  };
  // Mínimo privilegio: la cuenta administradora de MySQL NO llega a los servicios
  ["DB_ROOT_USER", "DB_ROOT_PASSWORD", "DB_ROOT_SOCKET"].forEach((k) => delete env[k]);
  return env;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function salud(s) {
  return new Promise((resolve) => {
    const opts = { host: "127.0.0.1", port: s.puerto, path: "/health", timeout: 1500 };
    let mod = http;
    if (s.tls) {
      mod = https;
      opts.servername = "localhost";
      try { opts.ca = fs.readFileSync(path.join(SECRETS, "tls-ca-cert")); } catch { opts.rejectUnauthorized = false; }
    }
    const req = mod.get(opts, (r) => { r.resume(); resolve(r.statusCode === 200); });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function puertoLibre(puerto, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(puerto, host, () => srv.close(() => resolve(true)));
  });
}

function colaLog(nombre, lineas = 8) {
  try {
    const t = fs.readFileSync(path.join(LOGS, `${nombre}.log`), "utf8").trim().split(/\r?\n/);
    return t.slice(-lineas).map((l) => {
      try { const j = JSON.parse(l); return `    ${j.level || ""} ${j.msg || ""} ${j.error || j.detalle || ""}`.trimEnd(); } catch { return "    " + l; }
    }).join("\n");
  } catch { return "    (sin log)"; }
}

function lanzar(s, { segundoPlano }) {
  fs.mkdirSync(LOGS, { recursive: true });
  fs.mkdirSync(PIDS, { recursive: true });
  const fd = fs.openSync(path.join(LOGS, `${s.nombre}.log`), "a");
  const hijo = spawn(process.execPath, [path.join(RAIZ, s.script)], {
    cwd: RAIZ,
    env: { ...entorno(), HOST: s.host || "127.0.0.1", PORT: String(s.puerto), SERVICE_NAME: s.nombre },
    stdio: ["ignore", fd, fd],
    detached: segundoPlano,
    windowsHide: true,
  });
  fs.closeSync(fd);
  fs.writeFileSync(path.join(PIDS, `${s.nombre}.pid`), String(hijo.pid));
  if (segundoPlano) hijo.unref();
  return hijo;
}

async function esperarSalud(s, hijo, segundos = 30) {
  let murio = null;
  hijo.once("exit", (code) => { murio = code; });
  for (let i = 0; i < segundos * 4; i++) {
    if (await salud(s)) return true;
    if (murio !== null) break;
    await esperar(250);
  }
  console.error(`\n✖ El servicio "${s.nombre}" no arrancó${murio !== null ? ` (terminó con código ${murio})` : ""}. Últimas líneas de .run/logs/${s.nombre}.log:`);
  console.error(colaLog(s.nombre));
  return false;
}

function abrirNavegador(u) {
  const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", u]] : process.platform === "darwin" ? ["open", [u]] : ["xdg-open", [u]];
  try { spawn(cmd, args, { stdio: "ignore", detached: true, windowsHide: true }).on("error", () => {}).unref(); } catch { /* sin navegador */ }
}

function verificarRequisitos() {
  const [mayor] = process.versions.node.split(".").map(Number);
  if (mayor < 20) { console.error(`✖ Se necesita Node 20 o superior (tienes ${process.versions.node}). Descárgalo en https://nodejs.org`); process.exit(1); }
  if (!fs.existsSync(path.join(RAIZ, "node_modules", "express"))) { console.error("✖ Faltan dependencias. Ejecuta primero:  npm install"); process.exit(1); }
  if (!fs.existsSync(path.join(SECRETS, "tls-gateway-cert"))) { console.error("✖ No hay secretos de desarrollo. Ejecuta primero:  npm run setup"); process.exit(1); }
}

async function soloUno(nombre) {
  const s = porNombre[nombre];
  if (!s) { console.error(`Servicio desconocido: ${nombre}. Opciones: ${Object.keys(porNombre).join(", ")}`); process.exit(1); }
  const hijo = lanzar(s, { segundoPlano: true });
  process.exit((await esperarSalud(s, hijo)) ? 0 : 1);
}

function mysqlResponde() {
  if (process.env.DB_SOCKET) return Promise.resolve(true);
  return new Promise((resolve) => {
    const sock = net.connect({ host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306) });
    sock.setTimeout(2000);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
    sock.once("error", () => resolve(false));
  });
}

async function todo({ segundoPlano }) {
  if (!(await mysqlResponde())) {
    console.error(`✖ MySQL no responde en ${process.env.DB_HOST || "127.0.0.1"}:${process.env.DB_PORT || 3306}.`);
    console.error('  Enciéndelo (XAMPP Control Panel → MySQL → "Start") y vuelve a ejecutar. Si usa otro puerto, cámbialo en DB_PORT del archivo .env');
    process.exit(1);
  }
  const ocupados = [];
  for (const s of SERVICIOS) if (!(await puertoLibre(s.puerto, s.host))) ocupados.push(`${s.puerto} (${s.nombre})`);
  if (ocupados.length) {
    console.error(`✖ Puertos ocupados: ${ocupados.join(", ")}.`);
    console.error("  ¿Ya está corriendo Fukusuke en otra ventana? Detenlo con Ctrl+C allá o con:  npm stop");
    console.error("  Si el 8443 lo usa otro programa, cambia GATEWAY_PORT en el archivo .env");
    process.exit(1);
  }
  console.log("Iniciando Fukusuke...");
  const hijos = [];
  const detenerTodo = () => {
    for (const h of hijos) { try { h.kill(); } catch { /* ya terminó */ } }
    for (const s of SERVICIOS) fs.rmSync(path.join(PIDS, `${s.nombre}.pid`), { force: true });
  };
  const fallar = () => { detenerTodo(); console.error("\nRevisa el mensaje de arriba. Si es de base de datos: ¿MySQL encendido? ¿corriste npm run setup?"); process.exit(1); };

  // auth primero (publica el JWKS que usan los demás), luego el resto en paralelo y al final el gateway
  const etapas = [["auth"], SERVICIOS.filter((s) => !["auth", "gateway"].includes(s.nombre)).map((s) => s.nombre), ["gateway"]];
  for (const etapa of etapas) {
    const lanzados = etapa.map((n) => { const h = lanzar(porNombre[n], { segundoPlano }); hijos.push(h); return [porNombre[n], h]; });
    const ok = await Promise.all(lanzados.map(([s, h]) => esperarSalud(s, h)));
    if (ok.includes(false)) return fallar();
    etapa.forEach((n) => console.log(`  ✔ ${n.padEnd(17)} puerto ${porNombre[n].puerto}`));
  }

  console.log(`
==============================================================
  Fukusuke listo →  ${URL_PAGINA}
==============================================================
  (El navegador avisará "conexión no privada" porque el certificado es
   de desarrollo: Avanzado → Continuar a localhost.)

  Correos de prueba (verificación de cuenta, boletas): http://localhost:${porNombre["mail-sandbox"].puerto}
  Pasarela Servipag de prueba:                         http://localhost:${porNombre["servipag-sandbox"].puerto}

  Cuentas del local: admin@fukusuke.cl · despacho@fukusuke.cl · dueno@fukusuke.cl
  Contraseñas: carpeta secrets/ (seed-admin-password, seed-despacho-password, seed-dueno-password)
  Clientes: se registran en la página (el correo de verificación llega a la bandeja de arriba)
  Logs: .run/logs/
  ${segundoPlano ? "Detener: npm stop" : "Detener: Ctrl+C"}
`);
  if (process.argv.includes("--abrir")) abrirNavegador(URL_PAGINA);
  if (segundoPlano) process.exit(0);

  let cerrando = false;
  const cerrar = () => { if (cerrando) return; cerrando = true; console.log("\nDeteniendo servicios..."); detenerTodo(); setTimeout(() => process.exit(0), 300); };
  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
  hijos.forEach((h, i) => h.on("exit", (code) => {
    if (cerrando) return;
    const s = SERVICIOS.find((x) => fs.existsSync(path.join(PIDS, `${x.nombre}.pid`)) && Number(fs.readFileSync(path.join(PIDS, `${x.nombre}.pid`), "utf8")) === h.pid);
    console.error(`⚠ El servicio ${s ? s.nombre : "#" + i} se detuvo (código ${code}). Revisa .run/logs/. Puedes reiniciarlo con: node scripts/start.js --solo ${s ? s.nombre : "<servicio>"}`);
  }));
}

verificarRequisitos();
const i = process.argv.indexOf("--solo");
if (i > -1) soloUno(process.argv[i + 1]);
else todo({ segundoPlano: process.argv.includes("--bg") });
