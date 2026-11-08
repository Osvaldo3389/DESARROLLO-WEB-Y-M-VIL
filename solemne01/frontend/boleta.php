<!DOCTYPE html>
<html lang="es">

<head>
    <title>Boleta digital | Fukusuke Sushi-Delivery</title>
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
        </div>
    </nav>

    <section class="seccion">
        <div class="container">
            <div class="pasos-checkout">
                <span>① Carrito</span>
                <span>② Pago</span>
                <span class="activo">③ Boleta</span>
            </div>

            <div class="text-center mb-4">
                <span class="boleta-sello" id="sello-boleta">Consultando el pago…</span>
            </div>

            <div class="boleta">
                <div class="boleta-encabezado">
                    <strong>FUKUSUKE SUSHI-DELIVERY</strong><br>
                    <span class="text-muted small">Maipú, Región Metropolitana</span><br>
                    <span class="text-muted small">Boleta electrónica <span id="folio-boleta"></span></span><br>
                    <span class="text-muted small" id="emision-boleta"></span>
                </div>

                <div id="items-boleta"></div>

                <div class="boleta-linea mt-2">
                    <span>Despacho (3 km)</span><span>Gratis</span>
                </div>
                <div class="boleta-linea fw-bold" style="border-top: 1px dashed #D1D5DB; padding-top: 8px; margin-top: 8px;">
                    <span>Total pagado</span><span id="total-boleta">$0</span>
                </div>
                <div class="boleta-linea mt-2">
                    <span>Método de pago</span><span id="metodo-boleta">—</span>
                </div>
                <p class="text-muted small text-center mt-3 mb-0">
                    Se envió una copia de esta boleta a tu correo electrónico registrado.<br>
                    Tu pedido pasó al área de despacho para su preparación.
                </p>
            </div>

            <div class="text-center mt-4">
                <a href="menu.php" class="btn-principal" style="color:#fff;">Volver a la carta</a>
            </div>
        </div>
    </section>

    <footer>
        <div class="container">
            <div class="copyright">&copy; 2026 Fukusuke Sushi-Delivery. Todos los derechos reservados.</div>
        </div>
    </footer>

    <script src="js/api.js"></script>
    <script src="js/datos-productos.js"></script>
    <script src="js/carrito.js"></script>
    <script>
        // P07: la boleta y el estado vienen del backend (G01 resumenPedido + S13 boleta del cajero virtual).
        const qs = new URLSearchParams(window.location.search);
        const pedidoId = qs.get("pedidoId");
        const pagoId = qs.get("pagoId");
        const contenedor = document.getElementById("items-boleta");
        const sello = document.getElementById("sello-boleta");
        let intentos = 0;

        async function cargarBoleta() {
            if (!pedidoId) { contenedor.innerHTML = `<p class="text-muted text-center">Sin pedido para mostrar.</p>`; sello.textContent = "—"; return; }
            let r;
            try { r = await Api.graphql("ResumenPedido", { pedidoId }); }
            catch (e) { contenedor.innerHTML = `<p class="text-muted text-center">${escapar(e.status === 401 ? "Inicia sesión para ver tu boleta." : e.message)}</p>`; return; }
            const resumen = r.data && r.data.resumenPedido;
            if (!resumen) { contenedor.innerHTML = `<p class="text-muted text-center">Pedido no encontrado.</p>`; sello.textContent = "—"; return; }
            contenedor.innerHTML = resumen.items.filter(i => i.estado === "VIGENTE").map(i => `
                <div class="boleta-linea">
                    <span>${i.cantidad} x ${escapar(i.producto ? i.producto.nombre : "Producto")}</span>
                    <span>${formatearCLP(i.subtotal)}</span>
                </div>`).join("");
            document.getElementById("total-boleta").textContent = formatearCLP(resumen.total);
            const pago = resumen.pago;
            document.getElementById("metodo-boleta").textContent = pago ? (pago.metodo === "SERVIPAG" ? "Servipag" : "Depósito bancario") : "—";
            if (pago && pago.estado === "APROBADO") {
                sello.textContent = "✔ Pago confirmado";
                document.getElementById("folio-boleta").textContent = "N° " + pago.folioBoleta;
                try {
                    const b = await Api.pedir("GET", "/payments/" + pago.pagoId + "/boleta");
                    document.getElementById("emision-boleta").textContent = new Date(b.fechaEmision).toLocaleString("es-CL") + " · " + b.cajeroVirtual;
                } catch (e) { /* datos de emisión no disponibles */ }
                vaciarCarrito();
            } else if (pago && pago.estado === "RECHAZADO") {
                sello.textContent = "✖ Pago rechazado";
                contenedor.insertAdjacentHTML("beforeend", `<p class="text-center mt-2"><a href="pago.php">Intentar nuevamente</a></p>`);
            } else {
                sello.textContent = "⏳ Pago pendiente de confirmación";
                if (intentos++ < 10) setTimeout(cargarBoleta, 2000);
            }
            if (r.errors) console.warn("Respuesta parcial:", r.errors);
        }
        cargarBoleta();
    </script>
</body>
</html>
