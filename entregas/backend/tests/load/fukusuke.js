// Prueba de carga k6 — escenario de pico proyectado (Módulo 9).
// Cada usuario virtual usa su propia IP local (--local-ips) e inicia sesión con un cliente de prueba.
// Ejecutar:
//   SSL_CERT_FILE=secrets/tls-ca-cert k6 run --local-ips=127.0.0.2-127.0.0.51 \
//     -e BASE_URL=https://localhost:8443 -e PASS=$(cat secrets/seed-cliente-password) tests/load/fukusuke.js
import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";

// UUID v4 para la Idempotency-Key de cada pedido nuevo (R06 la exige)
const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
});

export const options = {
  stages: [{ duration: "1m", target: 50 }, { duration: "5m", target: 50 }, { duration: "30s", target: 0 }],
  thresholds: {
    "http_req_duration{ruta:R01}": ["p(95)<300"],
    "http_req_duration{ruta:R06}": ["p(95)<800"],
    "http_req_duration{ruta:R21}": ["p(95)<800"],
    "http_req_failed{fase:carga}": ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"],
  noCookiesReset: true, // cada usuario conserva su sesión entre iteraciones
};

const BASE = __ENV.BASE_URL || "https://localhost:8443";
let sesion = null;

function csrf() {
  const c = http.cookieJar().cookiesForURL(BASE);
  return c.fk_csrf ? c.fk_csrf[0] : "";
}

function iniciar() {
  http.get(`${BASE}/api/v1/products?page=1&size=1`, { tags: { fase: "login" } });
  const n = String(((exec.vu.idInTest - 1) % 200) + 1).padStart(3, "0");
  const r = http.post(`${BASE}/api/v1/auth/login`, JSON.stringify({ email: `cliente${n}@example.com`, password: __ENV.PASS }),
    { headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() }, tags: { fase: "login" } });
  const me = http.get(`${BASE}/api/v1/clients/me`, { tags: { fase: "login" } });
  const productos = http.get(`${BASE}/api/v1/products?size=50`, { tags: { fase: "login" } }).json("items");
  sesion = { ok: r.status === 200, dir: me.status === 200 ? me.json("direcciones.0.direccionId") : null, productos, ultimoPedido: null };
}

export default function () {
  if (!sesion) iniciar();
  const h = { headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() } };
  const x = Math.random();
  if (x < 0.70) {
    const r = http.get(`${BASE}/api/v1/products`, { tags: { ruta: "R01", fase: "carga" } });
    check(r, { "R01 200": (res) => res.status === 200 });
  } else if (x < 0.85 && sesion.ultimoPedido) {
    const r = http.post(`${BASE}/api/v1/graphql`, JSON.stringify({ operationName: "ResumenPedido", variables: { pedidoId: sesion.ultimoPedido } }),
      { ...h, tags: { ruta: "R21", fase: "carga" } });
    check(r, { "R21 200": (res) => res.status === 200 });
  } else if (x < 0.95 || !sesion.ultimoPedido) {
    const p = sesion.productos[Math.floor(Math.random() * sesion.productos.length)];
    const r = http.post(`${BASE}/api/v1/orders`, JSON.stringify({ items: [{ productoId: p.id, cantidad: 1 + Math.floor(Math.random() * 3) }], direccionId: sesion.dir }),
      { ...h, headers: { ...h.headers, "Idempotency-Key": uuid() }, tags: { ruta: "R06", fase: "carga" } });
    if (check(r, { "R06 201": (res) => res.status === 201 })) sesion.ultimoPedido = r.json("pedidoId");
  } else {
    const r = http.get(`${BASE}/api/v1/orders/${sesion.ultimoPedido}`, { tags: { ruta: "R09", fase: "carga" } });
    check(r, { "R09 200": (res) => res.status === 200 });
  }
  sleep(1);
}
