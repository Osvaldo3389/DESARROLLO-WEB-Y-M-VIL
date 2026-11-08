<!DOCTYPE html>
<html lang="es">

<head>
    <title>Despacho | Fukusuke Sushi-Delivery</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <link href="vendor/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="vendor/bootstrap/dist/js/bootstrap.bundle.min.js"></script>

    <link href="css/paleta-de-colores.css" rel="stylesheet">
    <link href="css/estilos.css" rel="stylesheet">
</head>

<body>

    <nav class="navbar navbar-expand-lg navbar-dark">
        <div class="container">
            <a class="navbar-brand" href="index.php"><img src="img/logo-fukusuke.png" alt="Fukusuke"> FUKUSUKE</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menuPrincipal" aria-controls="menuPrincipal" aria-expanded="false" aria-label="Abrir menú">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="menuPrincipal">
                <ul class="navbar-nav ms-auto align-items-lg-center">
                    <li class="nav-item"><a class="nav-link" href="index.php">Inicio</a></li>
                    <li class="nav-item"><a class="nav-link" href="menu.php">Carta</a></li>
                    <li class="nav-item"><a class="nav-link" href="nosotros.php">Nosotros</a></li>
                    <li class="nav-item"><a class="nav-link" href="contacto.php">Contacto</a></li>
                    <li class="nav-item"><a class="nav-link boton-ingresar" href="registro.php">Ingresar / Registrarme</a></li>
                    <li class="nav-item"><a class="nav-link carrito-link" href="carrito.php">🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span></a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="seccion">
        <div class="container">
            <div class="seccion-titulo">
                <h2>Panel de despacho</h2>
                <p>Pedidos pagados en orden de llegada (RF13). Se actualiza cada 10 segundos.</p>
            </div>
            <div id="aviso-despacho" class="alerta-radio mb-3 d-none"></div>
            <div id="cola-despacho"></div>
            <div id="orden-imprimir" class="d-none"></div>
        </div>
    </section>

    <footer>
        <div class="container">
            <div class="copyright">&copy; 2026 Fukusuke Sushi-Delivery. Todos los derechos reservados.</div>
        </div>
    </footer>

    <script src="js/api.js"></script>
    <script src="js/carrito.js"></script>
    <script>
        // P10: cola vía GraphQL G02 (orders + inventory) y cambios de estado vía S18.
        const ETIQUETA = { PAGADO: "Pagado · por preparar", EN_PREPARACION: "En preparación", EN_CAMINO: "En camino" };
        const aviso = document.getElementById("aviso-despacho");
        let cola = [];

        function mostrarAviso(t, error) {
            aviso.classList.remove("d-none");
            aviso.classList.toggle("alerta-error", !!error);
            aviso.textContent = t;
        }

        async function cargarCola() {
            const s = Sesion.actual();
            if (!s || !["DESPACHO", "ADMIN"].includes(s.rol)) {
                document.getElementById("cola-despacho").innerHTML = '<p class="text-muted">Ingresa con una cuenta de despacho. <a href="registro.php">Ingresar</a></p>';
                return;
            }
            try {
                const r = await Api.graphql("ColaDespacho", { first: 20 });
                cola = r.data.colaDespacho.edges;
                pintar();
            } catch (e) { mostrarAviso(e.message, true); }
        }

        function pintar() {
            const c = document.getElementById("cola-despacho");
            if (!cola.length) { c.innerHTML = '<p class="text-muted">No hay pedidos pendientes de despacho.</p>'; return; }
            c.innerHTML = cola.map((p, n) => `
                <div class="tarjeta-despacho">
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                        <div><strong>#${n + 1} · Pedido ${p.pedidoId.slice(0, 8).toUpperCase()}</strong>
                            <div class="text-muted small">Pagado ${new Date(p.pagadoEn).toLocaleString("es-CL")} · ${escapar(p.calle)} ${escapar(p.numero)}, ${escapar(p.comuna)}</div></div>
                        <span class="estado-badge">${ETIQUETA[p.estado] || p.estado}</span>
                    </div>
                    <ul class="mt-2 mb-2">${p.items.map(i => `<li>${i.cantidad} x ${escapar(i.producto ? i.producto.nombre : "Producto")}</li>`).join("")}</ul>
                    ${p.estado === "PAGADO" ? `<button class="btn-principal" style="color:#fff;" onclick="avanzar('${p.pedidoId}', 'EN_PREPARACION')">Tomar e imprimir orden</button>` : ""}
                    ${p.estado === "EN_PREPARACION" ? `<button class="btn-principal" style="color:#fff;" onclick="avanzar('${p.pedidoId}', 'EN_CAMINO')">Entregar a chofer</button>` : ""}
                    ${p.estado === "EN_CAMINO" ? `<button class="btn-principal" style="color:#fff;" onclick="avanzar('${p.pedidoId}', 'ENTREGADO')">Marcar entregado</button>` : ""}
                </div>`).join("");
        }

        async function avanzar(pedidoId, estado) {
            const body = { estado };
            if (estado === "EN_CAMINO") {
                const chofer = prompt("Nombre del chofer:");
                if (!chofer) return;
                body.chofer = chofer;
            }
            try {
                const r = await Api.pedir("PATCH", "/orders/" + pedidoId + "/estado", body);
                if (estado === "EN_PREPARACION") imprimir(cola.find(p => p.pedidoId === pedidoId), r.ordenDespacho);
                mostrarAviso("Pedido " + pedidoId.slice(0, 8).toUpperCase() + ": " + estado.replace("_", " ").toLowerCase());
                cargarCola();
            } catch (e) { mostrarAviso(e.message, true); }
        }

        function imprimir(p, orden) {
            const div = document.getElementById("orden-imprimir");
            div.innerHTML = `<h3>FUKUSUKE · Orden de despacho</h3><p>Orden ${orden.ordenId.slice(0, 8).toUpperCase()} · ${new Date(orden.impresaEn).toLocaleString("es-CL")}</p>
                <p><strong>Entregar en:</strong> ${escapar(p.calle)} ${escapar(p.numero)}, ${escapar(p.comuna)}</p>
                <ul>${p.items.map(i => `<li>${i.cantidad} x ${escapar(i.producto ? i.producto.nombre : "Producto")}</li>`).join("")}</ul>`;
            div.classList.remove("d-none");
            window.print();
            div.classList.add("d-none");
        }

        cargarCola();
        setInterval(cargarCola, 10000);
    </script>
</body>
</html>
