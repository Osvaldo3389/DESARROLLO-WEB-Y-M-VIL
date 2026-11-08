// Cada servicio usa SU usuario y SU esquema (fk_<servicio>), con credencial obtenida del SecretProvider.
const mysql = require("mysql2/promise");

async function createPool(secrets, servicio) {
  const password = await secrets.obtener(`db-${servicio}`);
  const cfg = {
    user: `fk_${servicio}`,
    password,
    database: `fk_${servicio}`,
    connectionLimit: Number(process.env.DB_POOL || 10),
    dateStrings: true,
    timezone: "Z",
    supportBigNumbers: true,
  };
  if (process.env.DB_SOCKET) cfg.socketPath = process.env.DB_SOCKET;
  else { cfg.host = process.env.DB_HOST || "mysql"; cfg.port = Number(process.env.DB_PORT || 3306); }
  const pool = mysql.createPool(cfg);
  // Modo estricto también en MariaDB/XAMPP (que por defecto no lo trae): datos inválidos = error, nunca truncado silencioso
  pool.on("connection", (c) => c.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"));
  return pool;
}

async function tx(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { createPool, tx };
