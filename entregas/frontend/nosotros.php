<!DOCTYPE html>
<html lang="es">

<head>
    <title>Nosotros | Fukusuke Sushi-Delivery</title>
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
                    <li class="nav-item"><a class="nav-link active" href="nosotros.php">Nosotros</a></li>
                    <li class="nav-item"><a class="nav-link" href="contacto.php">Contacto</a></li>
                    <li class="nav-item"><a class="nav-link boton-ingresar" href="registro.php">Ingresar / Registrarme</a></li>
                    <li class="nav-item"><a class="nav-link carrito-link" href="carrito.php">🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span></a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="franja-info">
        <div class="container">
            <h1>Quiénes somos</h1>
            <p class="mb-0">Sushi hecho con dedicación, ahora también en tu domicilio.</p>
        </div>
    </section>

    <section class="seccion">
        <div class="container">
            <div class="row align-items-center g-4">
                <div class="col-md-6">
                    <div class="detalle-img"><img src="img/combo-fukusuke.jpg" alt="Nuestra historia"></div>
                </div>
                <div class="col-md-6">
                    <h2>Nuestra historia</h2>
                    <p>
                        Fukusuke es un restaurant de sushi ubicado en la comuna de Maipú, con capacidad
                        para atender a 12 personas de forma simultánea. Desde siempre nos hemos enfocado en
                        una atención personalizada: nuestros clientes eligen sus productos directamente
                        desde la carta, ya sea para comer en el local o para llevar.
                    </p>
                    <p>
                        Para seguir cerca de nuestros clientes, ahora sumamos las ventas on-line: puedes
                        armar tu pedido desde el sitio, pagarlo con Servipag o depósito bancario, y
                        recibirlo gratis dentro de un radio de 3 km desde nuestro local.
                    </p>
                </div>
            </div>
        </div>
    </section>

    <section class="seccion seccion-suave">
        <div class="container">
            <div class="row text-center g-4">
                <div class="col-md-4">
                    <div class="tarjeta-info">
                        <div class="icono">🥢</div>
                        <h5>Calidad ante todo</h5>
                        <p class="text-muted mb-0">Productos frescos, preparados el mismo día.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="tarjeta-info">
                        <div class="icono">🛵</div>
                        <h5>Despacho propio</h5>
                        <p class="text-muted mb-0">Choferes propios para las entregas a domicilio.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="tarjeta-info">
                        <div class="icono">💬</div>
                        <h5>Atención cercana</h5>
                        <p class="text-muted mb-0">Un equipo que conoce a sus clientes por nombre.</p>
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

    <script src="js/carrito.js"></script>
</body>
</html>
