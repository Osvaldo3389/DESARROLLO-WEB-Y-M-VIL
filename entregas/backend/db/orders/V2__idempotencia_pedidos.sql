-- S06 Crear pedido idempotente: el navegador envía una Idempotency-Key (UUID) por intento de compra.
-- Si la misma solicitud llega dos veces (reintento tras una respuesta incierta), orders devuelve el pedido
-- ya registrado en vez de crear otro. La clave es única por cliente; request_hash detecta una clave
-- reutilizada con otro contenido (409).
ALTER TABLE pedidos
  ADD COLUMN idempotency_key CHAR(36) NULL,
  ADD COLUMN request_hash CHAR(64) NULL,
  ADD UNIQUE KEY uq_ped_idempotencia (cliente_id, idempotency_key);
