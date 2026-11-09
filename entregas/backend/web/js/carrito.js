// Carrito compartido entre todas las páginas del sitio (borrador en localStorage).
// El navegador NO decide precios ni totales: al "Continuar a pago" se crea el pedido en el backend (S06)
// y desde ese momento carrito.php trabaja sobre el pedido del servidor (S07 cantidad, S08 anulación con motivo).

function obtenerCarrito() {
    return JSON.parse(localStorage.getItem("fukusukeCarrito")) || [];
}

function guardarCarrito(carrito) {
    localStorage.setItem("fukusukeCarrito", JSON.stringify(carrito));
    actualizarContadorNav();
}

const pedidoPendiente = () => sessionStorage.getItem("fukusukePedido");

function agregarAlCarrito(idProducto, cantidad = 1) {
    // si había un pedido pendiente, se vuelve al borrador para crear uno nuevo con lo agregado
    sessionStorage.removeItem("fukusukePedido");
    const carrito = obtenerCarrito();
    const existente = carrito.find(item => item.id === idProducto);

    if (existente) {
        existente.cantidad = Math.min(20, existente.cantidad + cantidad);
    } else {
        carrito.push({ id: idProducto, cantidad: cantidad });
    }

    guardarCarrito(carrito);
}

function quitarDelCarrito(idProducto) {
    const carrito = obtenerCarrito().filter(item => item.id !== idProducto);
    guardarCarrito(carrito);
}

function cambiarCantidad(idProducto, delta) {
    const carrito = obtenerCarrito();
    const item = carrito.find(i => i.id === idProducto);

    if (!item) return;

    item.cantidad = Math.min(20, item.cantidad + delta);

    if (item.cantidad <= 0) {
        quitarDelCarrito(idProducto);
        return;
    }

    guardarCarrito(carrito);
}

function totalItemsCarrito() {
    return obtenerCarrito().reduce((acc, item) => acc + item.cantidad, 0);
}

function actualizarContadorNav() {
    const contador = document.getElementById("contador-carrito");
    if (contador) {
        contador.textContent = totalItemsCarrito();
    }
}

function formatearCLP(valor) {
    return "$" + Number(valor).toLocaleString("es-CL");
}

function vaciarCarrito() {
    localStorage.removeItem("fukusukeCarrito");
    sessionStorage.removeItem("fukusukePedido");
    actualizarContadorNav();
}

document.addEventListener("DOMContentLoaded", actualizarContadorNav);

// ===== Lógica exclusiva de la página carrito.php =====

function mensajeCarrito(texto, tipo = "info") {
    const m = document.getElementById("mensaje-carrito");
    if (!m) return;
    m.className = "alerta-radio mt-3" + (tipo === "error" ? " alerta-error" : "");
    m.textContent = texto;
}

async function renderizarPaginaCarrito() {
    const lista = document.getElementById("lista-carrito");
    if (!lista) return; // no estamos en carrito.php

    if (pedidoPendiente() && Sesion.actual()) {
        try {
            const pedido = await Api.pedir("GET", "/orders/" + pedidoPendiente());
            if (pedido.estado === "PENDIENTE_PAGO") return renderizarPedidoServidor(pedido);
        } catch (e) { /* pedido no disponible: se vuelve al borrador */ }
        sessionStorage.removeItem("fukusukePedido");
    }
    renderizarBorrador();
}

function renderizarBorrador() {
    const lista = document.getElementById("lista-carrito");
    const vacio = document.getElementById("carrito-vacio");
    const conProductos = document.getElementById("carrito-con-productos");
    const subtotalEl = document.getElementById("subtotal-carrito");
    const totalEl = document.getElementById("total-carrito");
    const boton = document.getElementById("btn-continuar");

    const carrito = obtenerCarrito().filter(item => productos.some(p => p.id === item.id));
    if (carrito.length === 0) {
        vacio.classList.remove("d-none");
        conProductos.classList.add("d-none");
        return;
    }
    vacio.classList.add("d-none");
    conProductos.classList.remove("d-none");

    let subtotal = 0;
    lista.innerHTML = carrito.map(item => {
        const producto = productos.find(p => p.id === item.id);
        const subtotalItem = producto.precio * item.cantidad;
        subtotal += subtotalItem;
        return `
            <div class="item-carrito">
                <div class="icono"><img src="${producto.imagen}" alt="${escapar(producto.nombre)}"></div>
                <div class="info">
                    <h6>${escapar(producto.nombre)}</h6>
                    <div class="text-muted small">${formatearCLP(producto.precio)} c/u</div>
                    <div class="cantidad-control mt-2">
                        <button onclick="cambiarCantidad('${producto.id}', -1); renderizarPaginaCarrito();">-</button>
                        <span>${item.cantidad}</span>
                        <button onclick="cambiarCantidad('${producto.id}', 1); renderizarPaginaCarrito();">+</button>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold mb-2">${formatearCLP(subtotalItem)}</div>
                    <button class="btn-anular" onclick="quitarDelCarrito('${producto.id}'); renderizarPaginaCarrito();">Quitar</button>
                </div>
            </div>`;
    }).join("");

    subtotalEl.textContent = formatearCLP(subtotal);
    totalEl.textContent = formatearCLP(subtotal) + " (referencial)";
    boton.textContent = "Continuar a pago";
    boton.onclick = crearPedido;
    mensajeCarrito("El total definitivo lo calcula el restaurant al confirmar tu pedido. El despacho gratuito solo se realiza dentro de un radio de 3 km del local en Maipú.");
}

function renderizarPedidoServidor(pedido) {
    document.getElementById("carrito-vacio").classList.add("d-none");
    document.getElementById("carrito-con-productos").classList.remove("d-none");
    const lista = document.getElementById("lista-carrito");
    lista.innerHTML = `<p class="text-muted small mb-2">Pedido N° ${pedido.pedidoId.slice(0, 8).toUpperCase()} · pendiente de pago</p>` +
        pedido.items.map(i => {
            const producto = productos.find(p => p.id === i.productoId);
            const img = producto ? `<img src="${producto.imagen}" alt="${escapar(i.nombre)}">` : "🍣";
            if (i.estado === "ANULADO") {
                return `<div class="item-carrito item-anulado"><div class="icono">${img}</div><div class="info">
                    <h6><s>${escapar(i.nombre)}</s></h6><div class="text-muted small">Anulado: ${escapar(i.motivo || "")}</div></div>
                    <div class="text-end"><span class="badge text-bg-secondary">Anulado</span></div></div>`;
            }
            return `<div class="item-carrito"><div class="icono">${img}</div><div class="info">
                <h6>${escapar(i.nombre)}</h6><div class="text-muted small">${formatearCLP(i.precioUnitario)} c/u</div>
                <div class="cantidad-control mt-2">
                    <button onclick="cambiarCantidadPedido('${i.itemId}', ${i.cantidad - 1})" ${i.cantidad <= 1 ? "disabled" : ""}>-</button>
                    <span>${i.cantidad}</span>
                    <button onclick="cambiarCantidadPedido('${i.itemId}', ${i.cantidad + 1})" ${i.cantidad >= 20 ? "disabled" : ""}>+</button>
                </div></div>
                <div class="text-end"><div class="fw-bold mb-2">${formatearCLP(i.subtotal)}</div>
                <button class="btn-anular" onclick="anularItem('${i.itemId}')">Anular</button></div></div>`;
        }).join("");
    document.getElementById("subtotal-carrito").textContent = formatearCLP(pedido.total);
    document.getElementById("total-carrito").textContent = formatearCLP(pedido.total);
    const boton = document.getElementById("btn-continuar");
    boton.textContent = "Ir a pagar";
    boton.onclick = (e) => { e.preventDefault(); window.location = "pago.php"; };
    // el borrador local refleja los ítems vigentes del pedido
    guardarCarrito(pedido.items.filter(i => i.estado === "VIGENTE").map(i => ({ id: i.productoId, cantidad: i.cantidad })));
    mensajeCarrito("Total calculado por el restaurant. Puedes ajustar cantidades o anular un producto indicando el motivo.");
}

async function crearPedido(e) {
    e.preventDefault();
    const s = Sesion.actual();
    if (!s) { window.location = "registro.php?volver=carrito.php"; return; }
    if (s.rol !== "CLIENTE") { mensajeCarrito("Ingresa con una cuenta de cliente para hacer pedidos.", "error"); return; }
    try {
        const perfil = await Api.pedir("GET", "/clients/me");
        const select = document.getElementById("direccion-entrega");
        const direccionId = select && select.value ? select.value : perfil.direcciones[0].direccionId;
        const items = obtenerCarrito().map(i => ({ productoId: i.id, cantidad: i.cantidad }));
        // S06 idempotente: el mismo carrito reintentado (p. ej. tras perder la conexión) usa la misma clave
        // y el backend devuelve el pedido ya creado en vez de duplicarlo
        const firma = JSON.stringify({ items, direccionId });
        let intento = null;
        try { intento = JSON.parse(sessionStorage.getItem("fukusukeIdemPedido")); } catch (e) { intento = null; }
        if (!intento || intento.firma !== firma) {
            intento = { firma, clave: Api.uuid() };
            sessionStorage.setItem("fukusukeIdemPedido", JSON.stringify(intento));
        }
        const pedido = await Api.pedir("POST", "/orders", { items, direccionId }, { "Idempotency-Key": intento.clave });
        sessionStorage.removeItem("fukusukeIdemPedido");
        sessionStorage.setItem("fukusukePedido", pedido.pedidoId);
        renderizarPedidoServidor(pedido);
    } catch (err) {
        if (err.status === 401) { Sesion.limpiar(); window.location = "registro.php?volver=carrito.php"; return; }
        mensajeCarrito(err.message, "error");
    }
}

async function cambiarCantidadPedido(itemId, cantidad) {
    try {
        renderizarPedidoServidor(await Api.pedir("PUT", `/orders/${pedidoPendiente()}/items/${itemId}`, { cantidad }));
    } catch (err) { mensajeCarrito(err.message, "error"); }
}

// RF3: anulación con motivo (queda registrada en el pedido, no se borra)
async function anularItem(itemId) {
    const motivo = prompt("Indica el motivo de la anulación de este producto:");
    if (motivo === null) return; // canceló
    try {
        const pedido = await Api.pedir("PATCH", `/orders/${pedidoPendiente()}/items/${itemId}/anulacion`, { motivo });
        if (pedido.estado === "ANULADO") {
            vaciarCarrito();
            mensajeCarrito("Anulaste todos los productos: el pedido quedó anulado.");
            renderizarPaginaCarrito();
            return;
        }
        renderizarPedidoServidor(pedido);
    } catch (err) { mensajeCarrito(err.message, "error"); }
}

async function prepararEntrega() {
    const cont = document.getElementById("entrega-carrito");
    if (!cont || !Sesion.actual() || Sesion.actual().rol !== "CLIENTE") return;
    try {
        const perfil = await Api.pedir("GET", "/clients/me");
        cont.innerHTML = `<label class="form-label small mb-1">Dirección de entrega</label>
            <select id="direccion-entrega" class="form-select form-select-sm">${perfil.direcciones.map(d =>
                `<option value="${d.direccionId}">${escapar(d.calle)} ${escapar(d.numero)}, ${escapar(d.comuna)}</option>`).join("")}</select>`;
    } catch (e) { /* sin perfil */ }
}

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("lista-carrito") || typeof productosListos === "undefined") return;
    productosListos.then(() => { renderizarPaginaCarrito(); prepararEntrega(); });
});
