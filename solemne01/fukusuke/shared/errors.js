class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const E = {
  badRequest: (msg, details) => new HttpError(400, "BAD_REQUEST", msg || "Solicitud inválida", details),
  unauthorized: (msg) => new HttpError(401, "UNAUTHORIZED", msg || "No autenticado"),
  forbidden: (msg) => new HttpError(403, "FORBIDDEN", msg || "No autorizado"),
  notFound: (msg) => new HttpError(404, "NOT_FOUND", msg || "Recurso no encontrado"),
  conflict: (msg, code) => new HttpError(409, code || "CONFLICT", msg || "Conflicto con el estado actual"),
  gone: (msg) => new HttpError(410, "GONE", msg || "Recurso vencido o ya utilizado"),
  unprocessable: (msg, code) => new HttpError(422, code || "UNPROCESSABLE", msg || "No se puede procesar"),
  tooMany: (msg) => new HttpError(429, "TOO_MANY_REQUESTS", msg || "Demasiadas solicitudes"),
  badGateway: (msg) => new HttpError(502, "BAD_GATEWAY", msg || "Proveedor externo no disponible"),
  unavailable: (msg) => new HttpError(503, "SERVICE_UNAVAILABLE", msg || "Servicio no disponible"),
};

module.exports = { HttpError, E };
