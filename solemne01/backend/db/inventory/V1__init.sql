CREATE TABLE IF NOT EXISTS categorias (
  categoria_id INT          NOT NULL PRIMARY KEY,
  nombre       VARCHAR(40)  NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS productos (
  producto_id   CHAR(36)     NOT NULL PRIMARY KEY,
  nombre        VARCHAR(80)  NOT NULL UNIQUE,
  descripcion   VARCHAR(400) NOT NULL,
  formato       VARCHAR(30)  NOT NULL DEFAULT '',
  categoria_id  INT          NOT NULL,
  precio        INT          NOT NULL CHECK (precio > 0),
  imagen        VARCHAR(200) NOT NULL,
  disponible    TINYINT(1)   NOT NULL DEFAULT 1,
  actualizado_en DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prod_cat (categoria_id, disponible),
  CONSTRAINT fk_prod_cat FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id)
);
