CREATE TABLE IF NOT EXISTS cajeros_virtuales (
  cajero_id INT         NOT NULL PRIMARY KEY,
  nombre    VARCHAR(60) NOT NULL
);
INSERT IGNORE INTO cajeros_virtuales VALUES (1, 'Cajero Virtual 01');
CREATE TABLE IF NOT EXISTS pagos (
  pago_id             CHAR(36)    NOT NULL PRIMARY KEY,
  pedido_id           CHAR(36)    NOT NULL,
  cliente_id          CHAR(36)    NOT NULL,
  metodo              ENUM('SERVIPAG','DEPOSITO') NOT NULL,
  estado              ENUM('PENDIENTE','APROBADO','RECHAZADO') NOT NULL,
  monto               INT         NOT NULL,
  transaccion_externa VARCHAR(80) NULL UNIQUE,
  token_proveedor     VARCHAR(80) NULL,
  idempotency_key     CHAR(36)    NOT NULL UNIQUE,
  request_hash        CHAR(64)    NOT NULL,
  respuesta           JSON        NOT NULL,
  creado_en           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pago_pedido (pedido_id)
);
CREATE TABLE IF NOT EXISTS boletas (
  folio          VARCHAR(20) NOT NULL PRIMARY KEY,
  pago_id        CHAR(36)    NOT NULL UNIQUE,
  pedido_id      CHAR(36)    NOT NULL,
  cliente_id     CHAR(36)    NOT NULL,
  fecha_emision  DATETIME    NOT NULL,
  monto_total    INT         NOT NULL,
  cajero_id      INT         NOT NULL,
  metodo         ENUM('SERVIPAG','DEPOSITO') NOT NULL,
  items          JSON        NOT NULL,
  enviada_por_correo TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_bol_pago FOREIGN KEY (pago_id) REFERENCES pagos(pago_id),
  CONSTRAINT fk_bol_caj FOREIGN KEY (cajero_id) REFERENCES cajeros_virtuales(cajero_id)
);
CREATE TABLE IF NOT EXISTS folios (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS depositos_confirmados (
  numero_operacion VARCHAR(40) NOT NULL PRIMARY KEY,
  pago_id          CHAR(36)    NOT NULL,
  fecha_deposito   DATE        NOT NULL,
  confirmado_por   CHAR(36)    NOT NULL,
  confirmado_en    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS webhooks_procesados (
  transaccion_id VARCHAR(80) NOT NULL PRIMARY KEY,
  recibido_en    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS outbox (
  event_id   CHAR(36)    NOT NULL PRIMARY KEY,
  tipo       VARCHAR(40) NOT NULL,
  payload    JSON        NOT NULL,
  creado_en  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_en DATETIME    NULL,
  intentos   INT         NOT NULL DEFAULT 0
);
