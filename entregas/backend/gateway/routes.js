// Lista EXPLÍCITA de rutas (R01–R31). Lo que no está aquí no se publica.
// access: anon | jwt | optional (anónimo o JWT) | session (cookie de refresh) | webhook
const R = (id, method, path, target, targetPath, access, opts = {}) => ({ id, method, path, target, targetPath, access, ...opts });
const IP = "ip";
const USER = "user";

module.exports = [
  R("R01", "GET", "/api/v1/products", "inventory", "/products", "optional", { rate: [120, 60, IP], cacheSec: 60 }),
  R("R02", "GET", "/api/v1/products/:id", "inventory", "/products/:id", "optional", { rate: [120, 60, IP], cacheSec: 60 }),
  R("R03", "POST", "/api/v1/clients", "clients", "/clients", "optional", { rate: [10, 60, IP], maxKb: 16, csrf: true }),
  R("R04", "POST", "/api/v1/clients/email-verification", "clients", "/email-verification", "anon", { rate: [10, 60, IP], csrf: true }),
  R("R05", "POST", "/api/v1/auth/login", "auth", "/login", "anon", { rate: [20, 60, IP], csrf: true, cookies: ["fk_rt"], setCookie: true }),
  R("R06", "POST", "/api/v1/orders", "orders", "/orders", "jwt", { roles: ["CLIENTE"], rate: [30, 60, USER], csrf: true, idempotency: true, timeoutMs: 4000 }),
  R("R07", "PUT", "/api/v1/orders/:id/items/:itemId", "orders", "/orders/:id/items/:itemId", "jwt", { roles: ["CLIENTE"], csrf: true }),
  R("R08", "PATCH", "/api/v1/orders/:id/items/:itemId/anulacion", "orders", "/orders/:id/items/:itemId/anulacion", "jwt", { roles: ["CLIENTE", "ADMIN"], csrf: true }),
  R("R09", "GET", "/api/v1/orders/:id", "orders", "/orders/:id", "jwt", { roles: ["CLIENTE", "ADMIN"] }),
  R("R10", "POST", "/api/v1/payments", "payments", "/payments", "jwt", { roles: ["CLIENTE"], csrf: true, idempotency: true, timeoutMs: 10000 }),
  R("R11", "POST", "/api/v1/payments/webhooks/servipag", "payments", "/webhooks/servipag", "webhook", { maxKb: 8, raw: true }),
  R("R12", "POST", "/api/v1/payments/:id/confirmacion", "payments", "/payments/:id/confirmacion", "jwt", { roles: ["ADMIN"], csrf: true }),
  R("R13", "GET", "/api/v1/payments/:id/boleta", "payments", "/payments/:id/boleta", "jwt", { roles: ["CLIENTE", "ADMIN"] }),
  R("R14", "POST", "/api/v1/contact", "clients", "/contact", "anon", { rate: [5, 60, IP], csrf: true }),
  R("R15", "POST", "/api/v1/products", "inventory", "/products", "jwt", { roles: ["ADMIN"], csrf: true }),
  R("R16", "PUT", "/api/v1/products/:id", "inventory", "/products/:id", "jwt", { roles: ["ADMIN"], csrf: true }),
  R("R17", "GET", "/api/v1/orders/dispatch-queue", "orders", "/orders/dispatch-queue", "jwt", { roles: ["DESPACHO", "ADMIN"] }),
  R("R18", "PATCH", "/api/v1/orders/:id/estado", "orders", "/orders/:id/estado", "jwt", { roles: ["DESPACHO", "ADMIN"], csrf: true }),
  R("R19", "GET", "/api/v1/reports/sales", "analytics", "/reports/sales", "jwt", { roles: ["DUENO", "ADMIN"] }),
  R("R20", "POST", "/api/v1/auth/refresh", "auth", "/refresh", "session", { rate: [30, 60, IP], csrf: true, cookies: ["fk_rt"], setCookie: true }),
  R("R20", "POST", "/api/v1/auth/logout", "auth", "/logout", "session", { csrf: true, cookies: ["fk_rt"], setCookie: true }),
  R("R21", "POST", "/api/v1/graphql", "graphql", "/graphql", "jwt", { roles: ["CLIENTE", "DESPACHO", "ADMIN"], csrf: true, timeoutMs: 3500 }),
  R("R22", "GET", "/api/v1/clients/me", "clients", "/clients/me", "jwt", { roles: ["CLIENTE"] }),
  R("R23", "GET", "/api/v1/payments/pendientes", "payments", "/payments/pendientes", "jwt", { roles: ["ADMIN"] }),
  // CU3 — mantenedor de clientes (ADMIN)
  R("R24", "GET", "/api/v1/clients", "clients", "/clients", "jwt", { roles: ["ADMIN"], rate: [60, 60, USER] }),
  R("R25", "GET", "/api/v1/clients/:id", "clients", "/clients/:id", "jwt", { roles: ["ADMIN"] }),
  R("R26", "PUT", "/api/v1/clients/:id", "clients", "/clients/:id", "jwt", { roles: ["ADMIN"], csrf: true }),
  R("R27", "PATCH", "/api/v1/clients/:id/estado", "clients", "/clients/:id/estado", "jwt", { roles: ["ADMIN"], csrf: true }),
  R("R28", "DELETE", "/api/v1/clients/:id", "clients", "/clients/:id", "jwt", { roles: ["ADMIN"], csrf: true }),
  // CU2 — mantenedor de usuarios del personal (ADMIN)
  R("R29", "GET", "/api/v1/users", "auth", "/users", "jwt", { roles: ["ADMIN"] }),
  R("R30", "POST", "/api/v1/users", "auth", "/users", "jwt", { roles: ["ADMIN"], csrf: true }),
  R("R31", "PATCH", "/api/v1/users/:id", "auth", "/users/:id", "jwt", { roles: ["ADMIN"], csrf: true }),
];
