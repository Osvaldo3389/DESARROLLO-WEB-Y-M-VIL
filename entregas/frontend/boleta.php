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
                <span class="boleta-sello">✔ Pago confirmado</span>
            </div>

            <div class="boleta">
                <div class="boleta-encabezado">
                    <strong>FUKUSUKE SUSHI-DELIVERY</strong><br>
                    <span class="text-muted small">Maipú, Región Metropolitana</span><br>
                    <span class="text-muted small">Boleta electrónica</span>
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

    <script src="js/datos-productos.js"></script>
    <script src="js/carrito.js"></script>
    <script>
        const carrito = obtenerCarrito();
        const contenedor = document.getElementById("items-boleta");

        if (carrito.length === 0) {
            contenedor.innerHTML = `<p class="text-muted text-center">Sin productos registrados.</p>`;
        } else {
            contenedor.innerHTML = carrito.map(item => {
                const producto = productos.find(p => p.id === item.id);
                if (!producto) return "";
                return `
                    <div class="boleta-linea">
                        <span>${item.cantidad} x ${producto.nombre}</span>
                        <span>${formatearCLP(producto.precio * item.cantidad)}</span>
                    </div>
                `;
            }).join("");
        }

        document.getElementById("total-boleta").textContent =
            formatearCLP(parseInt(localStorage.getItem("fukusukeTotalBoleta")) || 0);
        document.getElementById("metodo-boleta").textContent =
            localStorage.getItem("fukusukeMetodoPago") || "—";

        // Se vacía el carrito una vez emitida la boleta
        localStorage.removeItem("fukusukeCarrito");
    </script>
</body>
</html>
