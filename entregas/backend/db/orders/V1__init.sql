CREATE TABLE IF NOT EXISTS pedidos (
  pedido_id         CHAR(36)    NOT NULL PRIMARY KEY,
  cliente_id        CHAR(36)    NOT NULL,
  estado            ENUM('PENDIENTE_PAGO','PAGADO','EN_PREPARACION','EN_CAMINO','ENTREGADO','ANULADO') NOT NULL,
  total             INT         NOT NULL,
  creado_en         DATETIME(3) NOT NULL,
  pagado_en         DATETIME(3) NULL,
  direccion_id      CHAR(36)    NOT NULL,
  envio_calle       VARCHAR(120) NULL,
  envio_numero      VARCHAR(20) NULL,
  envio_comuna      VARCHAR(60) NOT NULL,
  INDEX idx_ped_cliente (cliente_id),
  INDEX idx_ped_cola (estado, pagado_en)
);
CREATE TABLE IF NOT EXISTS detalles (
  detalle_id       CHAR(36)     NOT NULL PRIMARY KEY,
  pedido_id        CHAR(36)     NOT NULL,
  producto_id      CHAR(36)     NOT NULL,
  nombre_producto  VARCHAR(80)  NOT NULL,
  cantidad         INT          NOT NULL CHECK (cantidad BETWEEN 1 AND 20),
  precio_unitario  INT          NOT NULL,
  estado           ENUM('VIGENTE','ANULADO') NOT NULL DEFAULT 'VIGENTE',
  motivo_anulacion VARCHAR(200) NULL,
  anulado_en       DATETIME     NULL,
  anulado_por      CHAR(36)     NULL,
  CONSTRAINT fk_det_ped FOREIGN KEY (pedido_id) REFERENCES pedidos(pedido_id)
);
CREATE TABLE IF NOT EXISTS ordenes_despacho (
  orden_id   CHAR(36)    NOT NULL PRIMARY KEY,
  pedido_id  CHAR(36)    NOT NULL UNIQUE,
  impresa_en DATETIME    NOT NULL,
  chofer     VARCHAR(80) NULL,
  estado     ENUM('EN_PREPARACION','EN_CAMINO','ENTREGADO') NOT NULL,
  CONSTRAINT fk_od_ped FOREIGN KEY (pedido_id) REFERENCES pedidos(pedido_id)
);
CREATE TABLE IF NOT EXISTS outbox (
  event_id   CHAR(36)   NOT NULL PRIMARY KEY,
  tipo       VARCHAR(40) NOT NULL,
  payload    JSON       NOT NULL,
  creado_en  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_en DATETIME   NULL,
  intentos   INT        NOT NULL DEFAULT 0,
  INDEX idx_outbox_pend (enviado_en)
);
