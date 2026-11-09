const idProducto = parseInt(new URLSearchParams(window.location.search).get("id"));
const producto = productos.find(p => p.id === idProducto);

const contenedor = document.getElementById("detalle-producto");
let cantidadActual = 1;

if (!producto) {
    contenedor.innerHTML = `
        <div class="col-12 text-center text-muted">
            Producto no encontrado. <a href="menu.php">Volver a la carta</a>.
        </div>
    `;
} else {
    document.title = producto.nombre + " | Fukusuke Sushi-Delivery";

    contenedor.innerHTML = `
        <div class="col-md-6 mb-4">
            <div class="detalle-img"><img src="${producto.imagen}" alt="${producto.nombre}"></div>
        </div>
        <div class="col-md-6">
            <span class="categoria-badge">${producto.categoriaNombre}</span>
            <h1 class="h3 mt-2">${producto.nombre}</h1>
            <div class="text-muted mb-2">${producto.piezas}</div>
            <p>${producto.descripcion}</p>
            <div class="detalle-precio">$${producto.precio.toLocaleString("es-CL")}</div>

            <div class="selector-cantidad">
                <button type="button" onclick="cambiarCantidadLocal(-1)">-</button>
                <input type="text" id="input-cantidad" value="1" readonly>
                <button type="button" onclick="cambiarCantidadLocal(1)">+</button>
            </div>

            <button class="btn btn-principal" onclick="agregarDesdeDetalle()">
                Agregar al pedido
            </button>
            <a href="menu.php" class="btn btn-secundario" style="border-color: var(--color-principal); color: var(--color-principal);">
                Volver a la carta
            </a>
        </div>
    `;
}

function cambiarCantidadLocal(delta) {
    cantidadActual = Math.max(1, cantidadActual + delta);
    document.getElementById("input-cantidad").value = cantidadActual;
}

function agregarDesdeDetalle() {
    agregarAlCarrito(producto.id, cantidadActual);
    alert(cantidadActual + " x " + producto.nombre + " agregado al pedido");
}
