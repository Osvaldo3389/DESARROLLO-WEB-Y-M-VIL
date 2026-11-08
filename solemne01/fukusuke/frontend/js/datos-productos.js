// La carta ya no está fija en este archivo: se obtiene del backend (S01 → GET /api/v1/products)
// para que precios y disponibilidad vengan siempre de inventory (autoridad del precio).
let productos = [];
const productosListos = Api.cargarCarta()
    .then((lista) => { productos = lista; return lista; })
    .catch((e) => { console.error("No se pudo cargar la carta:", e.message); return []; });
