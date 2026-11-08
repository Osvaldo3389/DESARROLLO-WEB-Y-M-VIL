// Cifrado en columna (AES-256-GCM) y hash determinista (HMAC) para búsquedas por igualdad.
const crypto = require("crypto");

function crearCifrador(claveBase64) {
  const master = Buffer.from(claveBase64, "base64");
  if (master.length !== 32) throw new Error("La clave de cifrado debe tener 32 bytes");
  const kEnc = crypto.createHmac("sha256", master).update("fukusuke-enc").digest();
  const kMac = crypto.createHmac("sha256", master).update("fukusuke-mac").digest();
  return {
    cifrar(texto) {
      if (texto === null || texto === undefined) return null;
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv("aes-256-gcm", kEnc, iv);
      const enc = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
      return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
    },
    descifrar(valor) {
      if (!valor) return null;
      const [v, iv, tag, data] = valor.split(":");
      if (v !== "v1") throw new Error("Formato de cifrado desconocido");
      const d = crypto.createDecipheriv("aes-256-gcm", kEnc, Buffer.from(iv, "base64"));
      d.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
    },
    hash(texto) {
      return crypto.createHmac("sha256", kMac).update(String(texto)).digest("hex");
    },
  };
}

const sha256 = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const tokenAleatorio = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

module.exports = { crearCifrador, sha256, tokenAleatorio };
