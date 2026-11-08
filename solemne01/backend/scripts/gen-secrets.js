// Genera secretos de DESARROLLO en ./secrets (carpeta ignorada por git). Nunca subir esta carpeta.
// Uso: node scripts/gen-secrets.js [--force]
require("../shared/env");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dir = path.resolve(process.env.SECRETS_DIR || path.join(__dirname, "..", "secrets"));
const force = process.argv.includes("--force");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

const rnd = (n = 32) => crypto.randomBytes(n).toString("base64url");
const write = (ref, value) => {
  const f = path.join(dir, ref);
  if (fs.existsSync(f) && !force) return;
  fs.writeFileSync(f, value + "\n", { mode: 0o644 }); // carpeta 0700; archivos legibles por el usuario del contenedor
};

const tokens = [
  "gw-inventory-token", "gw-orders-token", "gw-payments-token", "gw-clients-token", "gw-analytics-token", "gw-auth-token", "gw-graphql-token",
  "orders-inventory-token", "orders-clients-token", "payments-orders-token", "payments-clients-token", "clients-auth-token",
  "gql-orders-read", "gql-inventory-read", "gql-payments-read", "analytics-ingest-token",
  "servipag-api-key", "servipag-webhook-secret", "mail-api-key-clients", "mail-api-key-payments",
];
tokens.forEach((t) => write(t, rnd()));
["db-root", "db-auth", "db-inventory", "db-orders", "db-clients", "db-payments", "db-analytics"].forEach((t) => write(t, rnd(24)));
["seed-admin-password", "seed-despacho-password", "seed-dueno-password", "seed-cliente-password"].forEach((t) => write(t, rnd(12)));
write("vault-root-token", rnd(24));
write("rut-encryption-key", crypto.randomBytes(32).toString("base64"));

if (!fs.existsSync(path.join(dir, "auth-jwt-private-key")) || force) {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  write("auth-jwt-private-key", privateKey.export({ type: "pkcs8", format: "pem" }).trim());
}

// TLS de desarrollo: CA propia + certificado del gateway (SAN localhost, gateway, 127.0.0.1, ::1).
// Se genera en JavaScript (node-forge) para no depender de openssl: funciona igual en Windows, macOS y Linux.
if (!fs.existsSync(path.join(dir, "tls-gateway-cert")) || force) {
  const forge = require("node-forge");
  const { pki } = forge;
  const par = () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const priv = pki.privateKeyFromPem(privateKey.export({ type: "pkcs1", format: "pem" }));
    return { priv, pub: pki.setRsaPublicKey(priv.n, priv.e), pem: privateKey.export({ type: "pkcs8", format: "pem" }).trim() };
  };
  const nuevoCert = (pub, dias) => {
    const c = pki.createCertificate();
    c.publicKey = pub;
    c.serialNumber = "01" + crypto.randomBytes(15).toString("hex");
    c.validity.notBefore = new Date(Date.now() - 24 * 3600 * 1000);
    c.validity.notAfter = new Date(Date.now() + dias * 24 * 3600 * 1000);
    return c;
  };
  const ca = par();
  const caSubject = [{ name: "commonName", value: "Fukusuke Dev CA" }, { name: "organizationName", value: "Fukusuke (desarrollo)" }];
  const caCert = nuevoCert(ca.pub, 825);
  caCert.setSubject(caSubject);
  caCert.setIssuer(caSubject);
  caCert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" },
  ]);
  caCert.sign(ca.priv, forge.md.sha256.create());

  const gw = par();
  const gwCert = nuevoCert(gw.pub, 397);
  gwCert.setSubject([{ name: "commonName", value: "localhost" }]);
  gwCert.setIssuer(caSubject);
  gwCert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true, critical: true },
    { name: "extKeyUsage", serverAuth: true },
    { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 2, value: "gateway" }, { type: 7, ip: "127.0.0.1" }, { type: 7, ip: "::1" }] },
    { name: "subjectKeyIdentifier" },
    { name: "authorityKeyIdentifier", keyIdentifier: caCert.generateSubjectKeyIdentifier().getBytes() },
  ]);
  gwCert.sign(ca.priv, forge.md.sha256.create());

  for (const f of ["tls-ca-cert", "tls-gateway-cert", "tls-gateway-key"]) fs.rmSync(path.join(dir, f), { force: true });
  write("tls-ca-cert", pki.certificateToPem(caCert).trim());
  write("tls-gateway-cert", pki.certificateToPem(gwCert).trim());
  write("tls-gateway-key", gw.pem);
}
console.log(`Secretos de desarrollo listos en ${dir} (${fs.readdirSync(dir).length} archivos)`);
