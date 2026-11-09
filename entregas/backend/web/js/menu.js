const parametros = new URLSearchParams(window.location.search);
const categoriaSeleccionada = parametros.get("categoria");

const contenedor = document.getElementById("lista-productos");
const tituloFiltro = document.getElementById("titulo-filtro");

productosListos.then(() => {
let productosMostrar = productos;

if (categoriaSeleccionada) {
    productosMostrar = productos.filter(
        producto => producto.categoria === categoriaSeleccionada
    );
}

if (categoriaSeleccionada && productosMostrar.length > 0) {
    const nombreCategoria = productosMostrar[0].categoriaNombre;

    tituloFiltro.innerHTML = `
        <h2>${nombreCategoria}</h2>
        <p>Productos de la categoría ${nombreCategoria.toLowerCase()}.</p>
    `;
} else {
    tituloFiltro.innerHTML = `
        <h2>Nuestra carta</h2>
        <p>Todos los productos disponibles para pedir hoy.</p>
    `;
}

if (cartaError) {
    contenedor.innerHTML = `
        <div class="col-12 text-center">
            <p class="text-danger mb-2">No pudimos cargar la carta en este momento. Intenta nuevamente en unos segundos.</p>
            <button class="btn-principal" style="max-width:220px;margin:0 auto;display:block;color:#fff;border:none;" onclick="location.reload()">Reintentar</button>
        </div>
    `;
} else if (productosMostrar.length === 0) {
    contenedor.innerHTML = `
        <div class="col-12 text-center text-muted">
            No hay productos disponibles en esta categoría por el momento.
        </div>
    `;
} else {
    contenedor.innerHTML = productosMostrar.map(producto => `
        <div class="col-md-4 col-sm-6 mb-4">
            <div class="tarjeta-producto card">
                <a href="producto.php?id=${producto.id}" class="text-decoration-none text-reset">
                    <div class="tarjeta-producto-img"><img src="${producto.imagen}" alt="${producto.nombre}" loading="lazy"></div>
                </a>
                <div class="card-body">
                    <span class="categoria-badge">${producto.categoriaNombre}</span>
                    <a href="producto.php?id=${producto.id}" class="text-decoration-none text-reset">
                        <h5>${producto.nombre}</h5>
                    </a>
                    <div class="text-muted small mb-2">${producto.piezas}</div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="precio">$${producto.precio.toLocaleString("es-CL")}</span>
                    </div>
                    <button class="btn-agregar" onclick="agregarAlCarrito('${producto.id}'); alert('${producto.nombre} agregado al pedido');">
                        Agregar al pedido
                    </button>
                </div>
            </div>
        </div>
    `).join("");
}

document.querySelectorAll(".filtro-categorias a").forEach(link => {
    const cat = new URL(link.href).searchParams.get("categoria");
    if (cat === categoriaSeleccionada || (!cat && !categoriaSeleccionada)) {
        link.classList.add("activo");
    }
});
});
