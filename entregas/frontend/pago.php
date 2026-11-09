<!DOCTYPE html>
<html lang="es">

<head>
    <title>Pago | Fukusuke Sushi-Delivery</title>
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
                    <li class="nav-item"><a class="nav-link" href="carrito.php">🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span></a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="seccion">
        <div class="container">
            <div class="pasos-checkout">
                <span>① Carrito</span>
                <span class="activo">② Pago</span>
                <span>③ Boleta</span>
            </div>

            <div class="seccion-titulo">
                <h2>Elige tu método de pago</h2>
                <p>El pago se procesa a través de una plataforma externa</p>
            </div>

            <div style="max-width: 560px; margin: 0 auto;">
                <div class="row g-3 mb-4">
                    <div class="col-6">
                        <div class="opcion-pago" onclick="seleccionarPago(this, 'Servipag')">
                            <div class="icono">💳</div>
                            <strong>Servipag</strong>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="opcion-pago" onclick="seleccionarPago(this, 'Depósito bancario')">
                            <div class="icono">🏦</div>
                            <strong>Depósito bancario</strong>
                        </div>
                    </div>
                </div>

                <div class="tarjeta-formulario">
                    <div class="resumen-carrito mb-3" style="padding:16px;">
                        <div class="linea"><span>Total a pagar</span><span id="total-pago">$0</span></div>
                    </div>
                    <button class="btn-principal w-100" style="color:#fff;" onclick="confirmarPago()">
                        Confirmar pago
                    </button>
                    <p class="text-muted small mt-2 mb-0">
                        Al confirmar, la venta se asocia a un cajero virtual del restaurant y se genera tu boleta digital.
                    </p>
                </div>
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
        let metodoPago = null;

        function seleccionarPago(el, nombre) {
            document.querySelectorAll(".opcion-pago").forEach(o => o.classList.remove("seleccionada"));
            el.classList.add("seleccionada");
            metodoPago = nombre;
        }

        function calcularTotal() {
            const carrito = obtenerCarrito();
            return carrito.reduce((acc, item) => {
                const producto = productos.find(p => p.id === item.id);
                return acc + (producto ? producto.precio * item.cantidad : 0);
            }, 0);
        }

        document.getElementById("total-pago").textContent = formatearCLP(calcularTotal());

        function confirmarPago() {
            if (!metodoPago) {
                alert("Selecciona un método de pago para continuar.");
                return;
            }
            localStorage.setItem("fukusukeMetodoPago", metodoPago);
            localStorage.setItem("fukusukeTotalBoleta", calcularTotal());
            window.location = "boleta.php";
        }
    </script>
</body>
</html>
