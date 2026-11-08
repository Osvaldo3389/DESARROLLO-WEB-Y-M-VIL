// SecretProvider: los servicios piden secretos por REFERENCIA, nunca por valor en código.
//  - FileSecretProvider: Docker secrets (/run/secrets/<ref>) o carpeta ./secrets en modo local.
//  - VaultSecretProvider: HashiCorp Vault KV v2 con autenticación AppRole (SECRET_PROVIDER=vault).
const fs = require("fs");
const path = require("path");

class FileSecretProvider {
  constructor(dir) {
    this.dir = dir;
    this.cache = new Map();
  }
  async obtener(ref) {
    if (this.cache.has(ref)) return this.cache.get(ref);
    const file = path.join(this.dir, ref);
    if (!fs.existsSync(file)) throw new Error(`Secreto no disponible: ${ref}`);
    const value = fs.readFileSync(file, "utf8").trim();
    this.cache.set(ref, value);
    return value;
  }
  rotar(ref) {
    this.cache.delete(ref);
  }
}

class VaultSecretProvider {
  constructor({ addr, roleIdFile, secretIdFile, mount = "secret", prefix = "fukusuke" }) {
    this.addr = addr.replace(/\/$/, "");
    this.roleIdFile = roleIdFile;
    this.secretIdFile = secretIdFile;
    this.mount = mount;
    this.prefix = prefix;
    this.token = null;
    this.tokenExp = 0;
    this.cache = new Map();
  }
  async login() {
    const role_id = fs.readFileSync(this.roleIdFile, "utf8").trim();
    const secret_id = fs.readFileSync(this.secretIdFile, "utf8").trim();
    const r = await fetch(`${this.addr}/v1/auth/approle/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role_id, secret_id }),
    });
    if (!r.ok) throw new Error(`Vault login falló (${r.status})`);
    const j = await r.json();
    this.token = j.auth.client_token;
    this.tokenExp = Date.now() + (j.auth.lease_duration || 3600) * 1000 * 0.8;
  }
  async obtener(ref) {
    if (this.cache.has(ref)) return this.cache.get(ref);
    if (!this.token || Date.now() > this.tokenExp) await this.login();
    const r = await fetch(`${this.addr}/v1/${this.mount}/data/${this.prefix}/${ref}`, { headers: { "X-Vault-Token": this.token } });
    if (!r.ok) throw new Error(`Secreto no disponible en Vault: ${ref} (${r.status})`);
    const j = await r.json();
    const value = String(j.data.data.value).trim();
    this.cache.set(ref, value);
    return value;
  }
  rotar(ref) {
    this.cache.delete(ref);
  }
}

function createSecretProvider() {
  const kind = process.env.SECRET_PROVIDER || "file";
  if (kind === "vault") {
    return new VaultSecretProvider({
      addr: process.env.VAULT_ADDR || "http://vault:8200",
      roleIdFile: process.env.VAULT_ROLE_ID_FILE || "/run/secrets/vault-role-id",
      secretIdFile: process.env.VAULT_SECRET_ID_FILE || "/run/secrets/vault-secret-id",
    });
  }
  // Docker monta los secretos en /run/secrets; en modo local se usa la carpeta ./secrets del proyecto
  const dir = process.env.SECRETS_DIR || (fs.existsSync("/run/secrets") ? "/run/secrets" : path.join(__dirname, "..", "secrets"));
  return new FileSecretProvider(dir);
}

module.exports = { FileSecretProvider, VaultSecretProvider, createSecretProvider };
