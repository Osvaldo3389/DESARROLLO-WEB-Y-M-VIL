CREATE TABLE IF NOT EXISTS eventos_procesados (
  event_id    CHAR(36) NOT NULL PRIMARY KEY,
  recibido_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ventas_diarias (
  fecha    DATE        NOT NULL,
  comuna   VARCHAR(60) NOT NULL,
  total    BIGINT      NOT NULL DEFAULT 0,
  pedidos  INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (fecha, comuna)
);
CREATE TABLE IF NOT EXISTS ventas_producto (
  fecha       DATE        NOT NULL,
  producto_id CHAR(36)    NOT NULL,
  nombre      VARCHAR(80) NOT NULL,
  unidades    INT         NOT NULL DEFAULT 0,
  monto       BIGINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (fecha, producto_id)
);
