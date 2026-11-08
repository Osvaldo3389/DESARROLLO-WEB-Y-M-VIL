// Conexión con la cuenta ADMINISTRADORA de MySQL/MariaDB. Solo la usan las herramientas de desarrollo
// (init-db y seed); los microservicios nunca la usan.
//  - Local (XAMPP / MySQL instalado): DB_HOST, DB_PORT, DB_ROOT_USER y DB_ROOT_PASSWORD desde .env
//  - Docker: DB_HOST=mysql y la contraseña sale del secreto db-root
require("../shared/env");
const mysql = require("mysql2/promise");

function explicar(e, cfg) {
  const donde = cfg.socketPath || `${cfg.host}:${cfg.port}`;
  if (e.code === "ECONNREFUSED" || e.code === "ENOENT")
    return `No se pudo conectar a MySQL en ${donde}. ¿Está encendido? (en XAMPP: botón "Start" de MySQL). ` +
      "Si usa otro puerto, cámbialo en DB_PORT del archivo .env";
  if (e.code === "ER_ACCESS_DENIED_ERROR" || e.code === "ER_ACCESS_DENIED_NO_PASSWORD_ERROR")
    return `MySQL rechazó al usuario "${cfg.user}". Revisa DB_ROOT_USER y DB_ROOT_PASSWORD en el archivo .env ` +
      "(en XAMPP la contraseña de root viene vacía)";
  if (e.code === "ENOTFOUND") return `No existe el host de MySQL "${cfg.host}". Revisa DB_HOST en el archivo .env`;
  return e.message;
}

async function conexionAdmin(secrets, extra = {}) {
  const cfg = { user: process.env.DB_ROOT_USER || "root", multipleStatements: true, ...extra };
  if (process.env.DB_ROOT_SOCKET) cfg.socketPath = process.env.DB_ROOT_SOCKET;
  else {
    cfg.host = process.env.DB_HOST || "mysql";
    cfg.port = Number(process.env.DB_PORT || 3306);
    cfg.password = process.env.DB_ROOT_PASSWORD !== undefined ? process.env.DB_ROOT_PASSWORD : await secrets.obtener("db-root");
  }
  try {
    return await mysql.createConnection(cfg);
  } catch (e) {
    const err = new Error(explicar(e, cfg));
    err.code = e.code;
    throw err;
  }
}

module.exports = { conexionAdmin };
