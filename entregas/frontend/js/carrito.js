// Carrito compartido entre todas las páginas del sitio (persistido en localStorage)

function obtenerCarrito() {
    return JSON.parse(localStorage.getItem("fukusukeCarrito")) || [];
}

function guardarCarrito(carrito) {
    localStorage.setItem("fukusukeCarrito", JSON.stringify(carrito));
    actualizarContadorNav();
}

function agregarAlCarrito(idProducto, cantidad = 1) {
    const carrito = obtenerCarrito();
    const existente = carrito.find(item => item.id === idProducto);

    if (existente) {
        existente.cantidad += cantidad;
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

    item.cantidad += delta;

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
    return "$" + valor.toLocaleString("es-CL");
}

document.addEventListener("DOMContentLoaded", actualizarContadorNav);

// ===== Lógica exclusiva de la página carrito.php =====

function renderizarPaginaCarrito() {
    const lista = document.getElementById("lista-carrito");
    const vacio = document.getElementById("carrito-vacio");
    const conProductos = document.getElementById("carrito-con-productos");
    const subtotalEl = document.getElementById("subtotal-carrito");
    const totalEl = document.getElementById("total-carrito");

    if (!lista) return; // no estamos en carrito.php

    const carrito = obtenerCarrito();

    if (carrito.length === 0) {
        vacio.classList.remove("d-none");
        conProductos.classList.add("d-none");
        return;
    }

    vacio.classList.add("d-none");
    conProductos.classList.remove("d-none");

    lista.innerHTML = "";
    let subtotal = 0;

    carrito.forEach(item => {
        const producto = productos.find(p => p.id === item.id);
        if (!producto) return;

        const subtotalItem = producto.precio * item.cantidad;
        subtotal += subtotalItem;

        lista.innerHTML += `
            <div class="item-carrito">
                <div class="icono"><img src="${producto.imagen}" alt="${producto.nombre}"></div>
                <div class="info">
                    <h6>${producto.nombre}</h6>
                    <div class="text-muted small">${formatearCLP(producto.precio)} c/u</div>
                    <div class="cantidad-control mt-2">
                        <button onclick="cambiarCantidad(${producto.id}, -1); renderizarPaginaCarrito();">-</button>
                        <span>${item.cantidad}</span>
                        <button onclick="cambiarCantidad(${producto.id}, 1); renderizarPaginaCarrito();">+</button>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold mb-2">${formatearCLP(subtotalItem)}</div>
                    <button class="btn-anular" onclick="anularItem(${producto.id})">Anular</button>
                </div>
            </div>
        `;
    });

    subtotalEl.textContent = formatearCLP(subtotal);
    totalEl.textContent = formatearCLP(subtotal); // despacho gratis dentro del radio de cobertura
}

function anularItem(idProducto) {
    const motivo = prompt("Indica el motivo de la anulación de este producto:");
    if (motivo === null) return; // canceló
    quitarDelCarrito(idProducto);
    renderizarPaginaCarrito();
}

document.addEventListener("DOMContentLoaded", renderizarPaginaCarrito);
