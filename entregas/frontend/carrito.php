<!DOCTYPE html>
<html lang="es">

<head>
    <title>Mi Pedido | Fukusuke Sushi-Delivery</title>
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
                    <li class="nav-item">
                        <a class="nav-link carrito-link active" href="carrito.php">🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span></a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="seccion">
        <div class="container">
            <div class="pasos-checkout">
                <span class="activo">① Carrito</span>
                <span>② Pago</span>
                <span>③ Boleta</span>
            </div>

            <div class="seccion-titulo">
                <h2>Mi pedido</h2>
            </div>

            <div id="carrito-vacio" class="text-center text-muted py-5 d-none">
                <p class="fs-4">Tu carrito está vacío 🍣</p>
                <a href="menu.php" class="btn-principal" style="color:#fff;">Ver la carta</a>
            </div>

            <div id="carrito-con-productos" class="row d-none">
                <div class="col-md-7">
                    <div id="lista-carrito"></div>
                </div>
                <div class="col-md-5">
                    <div class="resumen-carrito">
                        <div class="linea"><span>Subtotal</span><span id="subtotal-carrito">$0</span></div>
                        <div class="linea"><span>Despacho (radio 3 km)</span><span>Gratis</span></div>
                        <div class="total"><span>Total</span><span id="total-carrito">$0</span></div>

                        <div class="alerta-radio mt-3">
                            El despacho gratuito solo se realiza dentro de un radio de 3 km del local en Maipú.
                        </div>

                        <a href="pago.php" class="btn-principal d-block text-center mt-3" style="color:#fff;">
                            Continuar a pago
                        </a>
                    </div>
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
</body>
</html>
