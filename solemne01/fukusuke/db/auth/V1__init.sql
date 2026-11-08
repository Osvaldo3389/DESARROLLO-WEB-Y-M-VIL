CREATE TABLE IF NOT EXISTS cuentas (
  cuenta_id        CHAR(36)     NOT NULL PRIMARY KEY,
  email            VARCHAR(254) NOT NULL UNIQUE,
  nombre           VARCHAR(120) NOT NULL,
  password_hash    VARCHAR(100) NULL,
  rol              ENUM('CLIENTE','ADMIN','DESPACHO','DUENO') NOT NULL,
  email_verificado TINYINT(1)   NOT NULL DEFAULT 0,
  estado           ENUM('PENDIENTE','ACTIVA','BLOQUEADA') NOT NULL DEFAULT 'PENDIENTE',
  intentos_fallidos INT         NOT NULL DEFAULT 0,
  bloqueado_hasta  DATETIME     NULL,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash  CHAR(64)  NOT NULL PRIMARY KEY,
  cuenta_id   CHAR(36)  NOT NULL,
  familia     CHAR(36)  NOT NULL,
  expira_en   DATETIME  NOT NULL,
  revocado    TINYINT(1) NOT NULL DEFAULT 0,
  creado_en   DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rt_familia (familia),
  CONSTRAINT fk_rt_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(cuenta_id)
);
