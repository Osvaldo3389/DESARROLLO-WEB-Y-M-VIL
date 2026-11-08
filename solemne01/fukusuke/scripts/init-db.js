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
    const dir = path.join(__dirname, "..", "db", s);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      await root.query(`USE fk_${s}`);
      await root.query(fs.readFileSync(path.join(dir, f), "utf8"));
      console.log(`fk_${s}: ${f} aplicado`);
    }
  }
  await root.query("FLUSH PRIVILEGES");
  await root.end();
  console.log("Bases de datos listas (un esquema y un usuario por servicio).");
}
main().catch((e) => { console.error("init-db falló:", e.message); process.exit(1); });
