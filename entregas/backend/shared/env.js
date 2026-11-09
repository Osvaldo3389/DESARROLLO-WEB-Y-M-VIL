// Carga variables desde el archivo .env de la raíz (si existe) SIN pisar las que ya vienen del sistema.
// El .env solo contiene configuración local (host/puerto de MySQL, puertos); está en .gitignore.
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

function cargarEnv(archivo = path.join(RAIZ, ".env")) {
  if (!fs.existsSync(archivo)) return false;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || linea.trim().startsWith("#")) continue;
    let valor = m[2];
    if (/^(["']).*\1$/.test(valor)) valor = valor.slice(1, -1);
    else valor = valor.replace(/\s+#.*$/, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
  return true;
}

cargarEnv();
module.exports = { cargarEnv, RAIZ };
