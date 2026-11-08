-- CU3 Mantenedor de clientes: marca de eliminación de datos personales (S25, derecho de cancelación).
-- El registro se conserva anonimizado para no romper el historial de pedidos y boletas.
ALTER TABLE clientes ADD COLUMN eliminado_en DATETIME NULL;
