// Schema y operaciones registradas (persisted queries) del GraphQL Gateway.
const SDL = `
type Query {
  "G01 — CLIENTE dueño del pedido o ADMIN"
  resumenPedido(pedidoId: ID!): ResumenPedido
  "G02 — DESPACHO o ADMIN; paginado, máximo 50"
  colaDespacho(first: Int = 20, after: String): PedidoDespachoConnection!
}
type ResumenPedido {
  pedidoId: ID!
  estado: EstadoPedido!
  total: Int!
  creadoEn: String!
  items: [ItemResumen!]!
  pago: PagoResumen
}
type ItemResumen { cantidad: Int!  precioUnitario: Int!  subtotal: Int!  estado: EstadoItem!  producto: ProductoPublico }
type ProductoPublico { id: ID!  nombre: String!  imagen: String }
type PagoResumen { pagoId: ID!  estado: EstadoPago!  metodo: MetodoPago!  folioBoleta: String }
type PedidoDespachoConnection { edges: [PedidoDespacho!]!  endCursor: String  hasNextPage: Boolean! }
type PedidoDespacho { pedidoId: ID!  estado: EstadoPedido!  pagadoEn: String!  calle: String!  numero: String!  comuna: String!  items: [ItemDespacho!]! }
type ItemDespacho { cantidad: Int!  producto: ProductoPublico }
enum EstadoPedido { PENDIENTE_PAGO PAGADO EN_PREPARACION EN_CAMINO ENTREGADO ANULADO }
enum EstadoItem { VIGENTE ANULADO }
enum EstadoPago { PENDIENTE APROBADO RECHAZADO }
enum MetodoPago { SERVIPAG DEPOSITO }
`;

const OPERACIONES = {
  ResumenPedido: {
    roles: ["CLIENTE", "ADMIN"],
    query: `query ResumenPedido($pedidoId: ID!) {
  resumenPedido(pedidoId: $pedidoId) {
    pedidoId estado total creadoEn
    items { cantidad precioUnitario subtotal estado producto { id nombre imagen } }
    pago { pagoId estado metodo folioBoleta }
  }
}`,
  },
  ColaDespacho: {
    roles: ["DESPACHO", "ADMIN"],
    query: `query ColaDespacho($first: Int, $after: String) {
  colaDespacho(first: $first, after: $after) {
    hasNextPage endCursor
    edges { pedidoId estado pagadoEn calle numero comuna items { cantidad producto { nombre } } }
  }
}`,
  },
};

module.exports = { SDL, OPERACIONES };
