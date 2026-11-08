// Crea un esquema y un usuario por servicio (privilegios solo sobre su esquema) y aplica migraciones.
// Funciona con MySQL 8 y con MariaDB 10.4+ (la "MySQL" de XAMPP).
// Usa la cuenta administradora; los servicios NUNCA usan esta cuenta.
require("../shared/env");
const fs = require("fs");
const path = require("path");
const { createSecretProvider } = require("../shared/secrets");
const { conexionAdmin } = require("./mysql-admin");

const SERVICIOS = ["auth", "inventory", "orders", "clients", "payments", "analytics"];
// '%' para conexiones TCP/Docker y 'localhost' para que en MariaDB/XAMPP no gane el usuario anónimo ''@'localhost'
const HOSTS = (process.env.DB_USER_HOSTS || "%,localhost").split(",").map((h) => h.trim()).filter(Boolean);

async function main() {
  const secrets = createSecretProvider();
  const root = await conexionAdmin(secrets);
  const [[{ v }]] = await root.query("SELECT VERSION() AS v");
  const mariadb = /mariadb/i.test(v);
  const collation = mariadb ? "utf8mb4_unicode_ci" : "utf8mb4_0900_ai_ci";
  console.log(`Servidor: ${mariadb ? "MariaDB" : "MySQL"} ${v.split("-")[0]}`);
  for (const s of SERVICIOS) {
    const pw = await secrets.obtener(`db-${s}`);
    await root.query(`CREATE DATABASE IF NOT EXISTS fk_${s} CHARACTER SET utf8mb4 COLLATE ${collation}`);
    for (const h of HOSTS) {
      await root.query(`CREATE USER IF NOT EXISTS 'fk_${s}'@'${h}' IDENTIFIED BY ?`, [pw]);
      await root.query(`ALTER USER 'fk_${s}'@'${h}' IDENTIFIED BY ?`, [pw]);
      await root.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON fk_${s}.* TO 'fk_${s}'@'${h}'`);
    }
    // Migraciones versionadas: cada V<n>__*.sql se aplica una sola vez y queda registrada en _migraciones
    await root.query(`CREATE TABLE IF NOT EXISTS fk_${s}._migraciones (archivo VARCHAR(120) NOT NULL PRIMARY KEY, aplicado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const [hechas] = await root.query(`SELECT archivo FROM fk_${s}._migraciones`);
    const aplicadas = new Set(hechas.map((x) => x.archivo));
    const dir = path.join(__dirname, "..", "db", s);
    const version = (f) => Number((/^V(\d+)__/.exec(f) || [0, 0])[1]);
    for (const f of fs.readdirSync(dir).filter((x) => /^V\d+__.*\.sql$/.test(x)).sort((a, b) => version(a) - version(b))) {
      if (aplicadas.has(f)) continue;
      await root.query(`USE fk_${s}`);
      await root.query(fs.readFileSync(path.join(dir, f), "utf8"));
      await root.query(`INSERT INTO fk_${s}._migraciones (archivo) VALUES (?)`, [f]);
      console.log(`fk_${s}: ${f} aplicado`);
    }
  }
  await root.query("FLUSH PRIVILEGES");
  await root.end();
  console.log("Bases de datos listas (un esquema y un usuario por servicio).");
}
main().catch((e) => { console.error("init-db falló:", e.message); process.exit(1); });
