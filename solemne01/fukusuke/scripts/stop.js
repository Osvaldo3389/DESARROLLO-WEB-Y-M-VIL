// Detiene los servicios iniciados con `npm run start:bg` (o los que quedaron corriendo).
const { RAIZ } = require("../shared/env");
const fs = require("fs");
const path = require("path");

const PIDS = path.join(RAIZ, ".run", "pids");
let n = 0;
for (const f of fs.existsSync(PIDS) ? fs.readdirSync(PIDS).filter((x) => x.endsWith(".pid")) : []) {
  const pid = Number(fs.readFileSync(path.join(PIDS, f), "utf8"));
  try { process.kill(pid); n++; } catch { /* ya no existía */ }
  fs.rmSync(path.join(PIDS, f), { force: true });
}
console.log(n ? `Servicios detenidos (${n}).` : "No había servicios corriendo.");
