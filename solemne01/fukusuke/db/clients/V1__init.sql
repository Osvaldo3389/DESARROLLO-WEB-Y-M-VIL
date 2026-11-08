CREATE TABLE IF NOT EXISTS clientes (
  cliente_id        CHAR(36)     NOT NULL PRIMARY KEY,
  cuenta_id         CHAR(36)     NOT NULL UNIQUE,
  run_cifrado       VARCHAR(200) NOT NULL,
  run_hash          CHAR(64)     NOT NULL UNIQUE,
  nombre            VARCHAR(120) NOT NULL,
  email             VARCHAR(254) NOT NULL,
  telefono_cifrado  VARCHAR(200) NOT NULL,
  fecha_nac_cifrada VARCHAR(200) NOT NULL,
  sexo_cifrado      VARCHAR(200) NOT NULL,
  creado_en         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS direcciones (
  direccion_id   CHAR(36)     NOT NULL PRIMARY KEY,
  cliente_id     CHAR(36)     NOT NULL,
  calle_cifrada  VARCHAR(300) NOT NULL,
  numero_cifrado VARCHAR(200) NOT NULL,
  comuna         VARCHAR(60)  NOT NULL,
  provincia      VARCHAR(60)  NOT NULL,
  region         VARCHAR(60)  NOT NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dir_cli FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
CREATE TABLE IF NOT EXISTS tokens_verificacion (
  token_hash CHAR(64)  NOT NULL PRIMARY KEY,
  cuenta_id  CHAR(36)  NOT NULL,
  expira_en  DATETIME  NOT NULL,
  usado      TINYINT(1) NOT NULL DEFAULT 0,
  requiere_password TINYINT(1) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS mensajes_contacto (
  contacto_id CHAR(36)      NOT NULL PRIMARY KEY,
  nombre      VARCHAR(120)  NOT NULL,
  email       VARCHAR(254)  NOT NULL,
  asunto      VARCHAR(120)  NOT NULL,
  mensaje     VARCHAR(1000) NOT NULL,
  recibido_en DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS correos_pendientes (
  correo_id    CHAR(36)     NOT NULL PRIMARY KEY,
  destinatario VARCHAR(254) NOT NULL,
  asunto       VARCHAR(200) NOT NULL,
  cuerpo       TEXT         NOT NULL,
  intentos     INT          NOT NULL DEFAULT 0,
  enviado      TINYINT(1)   NOT NULL DEFAULT 0,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
