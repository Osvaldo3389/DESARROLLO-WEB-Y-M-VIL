"""Ejecuta comandos reales contra el entorno y guarda su salida como imagen (capturas de terminal)."""
import html
import json
import os
import subprocess
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(RAIZ, "tests", "resultados", "capturas")
os.makedirs(OUT, exist_ok=True)


def sh(cmd):
    return subprocess.run(cmd, shell=True, cwd=RAIZ, capture_output=True, text=True).stdout.rstrip()


def recortar_json(texto, n=900):
    try:
        cuerpo = json.dumps(json.loads(texto), ensure_ascii=False, indent=1)
    except Exception:
        cuerpo = texto
    return cuerpo if len(cuerpo) <= n else cuerpo[:n] + "\n…"


def formatear(salida):
    cab, _, cuerpo = salida.replace("\r\n", "\n").partition("\n\n")
    keep = [l for l in cab.splitlines() if l.lower().startswith(("http/", "content-type", "x-cache", "strict-transport", "x-correlation", "retry-after"))]
    return "\n".join(keep) + "\n\n" + recortar_json(cuerpo)


def http_curl(args):
    return formatear(sh(f"curl -sk -i {args}"))


bloques = {}
pid = sh("mysql -uroot -N -e \"SELECT pedido_id FROM fk_orders.pedidos p JOIN fk_auth.cuentas c ON c.cuenta_id=p.cliente_id WHERE c.email LIKE 'ui.%' ORDER BY p.creado_en DESC LIMIT 1\"")

# E1: ruta pública
bloques["E1_ruta_publica"] = [("$ curl -sk -i https://localhost:8443/api/v1/products?categoria=rolls", http_curl("'https://localhost:8443/api/v1/products?categoria=rolls'"))]

# E2: ruta protegida sin sesión (y comprobación de que orders no la recibe)
s = sh("curl -sk -i -X POST https://localhost:8443/api/v1/orders -H 'Content-Type: application/json' -d '{\"items\":[]}'")
corr = [l.split(":", 1)[1].strip() for l in s.splitlines() if l.lower().startswith("x-correlation-id")][0]
bloques["E2_ruta_protegida"] = [
    ("$ curl -sk -i -X POST https://localhost:8443/api/v1/orders -H 'Content-Type: application/json' -d '{\"items\":[]}'",
     formatear(s)),
    (f"$ grep -c {corr} .run/logs/orders.log   # ¿llegó la solicitud a orders?", sh(f"grep -c {corr} .run/logs/orders.log || true")),
]

# E3: pedido propio vs ajeno (misma regla de propiedad)
script = """
const H=require('./tests/helpers');
(async()=>{const a=new H.Navegador('A'), b=new H.Navegador('B');
await a.login(process.argv[1], 'ClaveSegura2026'); await b.login('cliente001@example.com', H.secreto('seed-cliente-password'));
const ra=await a.req('GET','/api/v1/orders/'+process.argv[2]); const rb=await b.req('GET','/api/v1/orders/'+process.argv[2]);
console.log('CLIENTE A (dueño)  GET /api/v1/orders/'+process.argv[2].slice(0,8)+'…  →  '+ra.status);
console.log(JSON.stringify({pedidoId:ra.body.pedidoId, estado:ra.body.estado, total:ra.body.total, items:ra.body.items.length}));
console.log('');
console.log('CLIENTE B (otro)   GET /api/v1/orders/'+process.argv[2].slice(0,8)+'…  →  '+rb.status);
console.log(JSON.stringify(rb.body)); (await H.db()).end();})();
"""
email_ui = sh("mysql -uroot -N -e \"SELECT email FROM fk_auth.cuentas WHERE email LIKE 'ui.%' ORDER BY creado_en DESC LIMIT 1\"")
open("/tmp/e3.js", "w").write(script)
bloques["E3_propiedad"] = [("$ node prueba-propiedad.js   # dos sesiones reales a través del gateway",
                             sh(f"NODE_EXTRA_CA_CERTS=secrets/tls-ca-cert node -e \"$(cat /tmp/e3.js)\" {email_ui} {pid}"))]

# E4: acceso directo a los servicios internos
bloques["E4_acceso_directo"] = [
    (f"$ curl -s -i http://127.0.0.1:8082/orders/{pid[:8]}…   # orders sin credencial de servicio", http_curl(f"http://127.0.0.1:8082/orders/{pid}")),
    ("$ curl -s -i -X POST http://127.0.0.1:4000/graphql   # GraphQL Gateway privado", http_curl("-X POST http://127.0.0.1:4000/graphql -H 'Content-Type: application/json' -d '{}'")),
]

# E5: puertos publicados en docker compose
import yaml
_d = yaml.safe_load(open(os.path.join(RAIZ, "docker-compose.yml")))
_lineas = [f"{k:17s} ports={str(v.get('ports', '(ninguno)')):22s} redes={v.get('networks')}" for k, v in _d["services"].items()]
_lineas.append("")
_lineas.append("redes: " + ", ".join(f"{k}{' (internal)' if (v or {}).get('internal') else ''}" for k, v in _d["networks"].items()))
bloques["E5_puertos_compose"] = [("$ docker compose config   # puertos publicados y redes por servicio", "\n".join(_lineas))]

# E6: verificación de secretos
bloques["E6_secretos"] = [("$ ./scripts/verificar-secretos.sh", sh("bash scripts/verificar-secretos.sh"))]

# E7: resumen de pruebas automatizadas
bloques["E7_pruebas"] = [("$ NODE_EXTRA_CA_CERTS=secrets/tls-ca-cert npm test", open(os.path.join(RAIZ, "tests", "resultados", "npm-test.txt")).read().strip())]

# E8: resumen k6
k6 = open(os.path.join(RAIZ, "tests", "resultados", "k6-salida.txt")).read()
inicio = k6.find("     ✓") if "     ✓" in k6 else k6.find("     ✗")
resumen = "\n".join(l for l in k6[inicio:].splitlines() if l.strip() and not l.startswith(("running", "default")))
bloques["E8_k6"] = [("$ k6 run --local-ips=127.0.0.2-127.0.0.51 tests/load/fukusuke.js   (50 usuarios, 6 min 30 s)", resumen)]

CSS = """body{margin:0;background:#fff;font-family:Consolas,'DejaVu Sans Mono',monospace;color:#000}
.t{border:1px solid #444;border-radius:8px;margin:10px;overflow:hidden}.b{background:#e5e5e5;border-bottom:1px solid #444;padding:6px 10px;font:12px Arial;color:#000}
pre{margin:0;padding:10px 12px;font-size:12.5px;line-height:1.35;white-space:pre-wrap;word-break:break-all}.c{font-weight:bold}"""

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width": 1000, "height": 400}, device_scale_factor=2)
    for nombre, cmds in bloques.items():
        cuerpo = "".join(f"<div class='c'>{html.escape(c)}</div>{html.escape(o)}\n\n" for c, o in cmds)
        pg.set_content(f"<style>{CSS}</style><div class='t'><div class='b'>Terminal · entorno de pruebas Fukusuke (Ubuntu 24.04, Node 22, MySQL 8.0)</div><pre>{cuerpo.rstrip()}</pre></div>")
        pg.locator(".t").screenshot(path=os.path.join(OUT, nombre + ".png"))
        print("captura", nombre)
    br.close()
