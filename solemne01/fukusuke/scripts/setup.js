// Preparación en un solo paso:  npm run setup
//  1) crea .env desde .env.example (si no existe)
//  2) genera secretos de desarrollo en ./secrets (si no existen)
//  3) crea las 6 bases de datos y sus usuarios en MySQL/MariaDB
//  4) carga la carta real y las cuentas del local (sin datos ficticios)
//     --demo  agrega los datos FICTICIOS de prueba (para npm test, prueba de carga e informe)
//     --reset borra TODOS los datos antes de cargar
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const env = path.join(RAIZ, ".env");
if (!fs.existsSync(env)) {
  fs.copyFileSync(path.join(RAIZ, ".env.example"), env);
  console.log("• Creado .env (configuración local). Si tu MySQL tiene contraseña de root, escríbela ahí en DB_ROOT_PASSWORD.");
}
if (!fs.existsSync(path.join(RAIZ, "node_modules", "express"))) {
  console.error("✖ Faltan dependencias. Ejecuta primero:  npm install");
  process.exit(1);
}
const paso = (titulo, script, args = []) => {
  console.log(`\n• ${titulo}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: "inherit", cwd: RAIZ });
  if (r.status !== 0) process.exit(r.status || 1);
};
paso("Secretos de desarrollo (carpeta secrets/, NO se sube a git)", "gen-secrets.js");
paso("Bases de datos y usuarios por servicio", "init-db.js");
paso(process.argv.includes("--demo") ? "Carta, cuentas del local y datos FICTICIOS de prueba" : "Carta y cuentas del local (sin datos ficticios)",
  "seed.js", ["--reset", "--demo"].filter((a) => process.argv.includes(a)));
console.log("\n✔ Listo. Ahora ejecuta:  npm start");
