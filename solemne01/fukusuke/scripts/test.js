// Ejecuta las pruebas de integración y seguridad contra el sistema levantado (npm run start:bg).
// Confía en la CA de desarrollo para hablar HTTPS con el gateway; funciona igual en Windows, macOS y Linux.
const { RAIZ } = require("../shared/env");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dirTests = path.join(RAIZ, "tests");
const archivos = fs.readdirSync(dirTests).filter((f) => f.endsWith(".test.js")).map((f) => path.join(dirTests, f));
fs.mkdirSync(path.join(dirTests, "resultados"), { recursive: true });
const env = { ...process.env, NODE_EXTRA_CA_CERTS: path.join(RAIZ, "secrets", "tls-ca-cert") };
const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...archivos], { stdio: "inherit", env, cwd: RAIZ });
process.exit(r.status === null ? 1 : r.status);
