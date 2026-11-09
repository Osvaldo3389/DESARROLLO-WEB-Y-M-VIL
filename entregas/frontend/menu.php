<!DOCTYPE html>
<html lang="es">

<head>
    <title>Fukusuke Sushi-Delivery | Carta</title>
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
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle active" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">Carta</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="menu.php">Ver todo</a></li>
                            <li><a class="dropdown-item" href="menu.php?categoria=rolls">🍣 Rolls</a></li>
                            <li><a class="dropdown-item" href="menu.php?categoria=temaki">🍙 Temaki</a></li>
                            <li><a class="dropdown-item" href="menu.php?categoria=sashimi">🐟 Sashimi</a></li>
                            <li><a class="dropdown-item" href="menu.php?categoria=combos">🍱 Combos</a></li>
                            <li><a class="dropdown-item" href="menu.php?categoria=entradas">🥟 Entradas</a></li>
                            <li><a class="dropdown-item" href="menu.php?categoria=bebidas">🥤 Bebidas</a></li>
                        </ul>
                    </li>
                    <li class="nav-item"><a class="nav-link" href="nosotros.php">Nosotros</a></li>
                    <li class="nav-item"><a class="nav-link" href="contacto.php">Contacto</a></li>
                    <li class="nav-item"><a class="nav-link boton-ingresar" href="registro.php">Ingresar / Registrarme</a></li>
                    <li class="nav-item">
                        <a class="nav-link carrito-link" href="carrito.php">🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span></a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="seccion">
        <div class="container">
            <div class="seccion-titulo" id="titulo-filtro">
                <h2>Nuestra carta</h2>
                <p>Todos los productos disponibles para pedir hoy.</p>
            </div>

            <div class="filtro-categorias">
                <a href="menu.php">Todo</a>
                <a href="menu.php?categoria=rolls">🍣 Rolls</a>
                <a href="menu.php?categoria=temaki">🍙 Temaki</a>
                <a href="menu.php?categoria=sashimi">🐟 Sashimi</a>
                <a href="menu.php?categoria=combos">🍱 Combos</a>
                <a href="menu.php?categoria=entradas">🥟 Entradas</a>
                <a href="menu.php?categoria=bebidas">🥤 Bebidas</a>
            </div>

            <div class="row" id="lista-productos"></div>
        </div>
    </section>

    <footer>
        <div class="container">
            <div class="row">
                <div class="col-md-4 mb-4">
                    <h6><img src="img/logo-fukusuke.png" alt="Fukusuke" class="footer-logo"> FUKUSUKE</h6>
                    <p>Restaurant de sushi en Maipú. Atención en local y despacho a domicilio.</p>
                </div>
                <div class="col-md-4 mb-4">
                    <h6>Enlaces</h6>
                    <p><a href="menu.php">Carta</a></p>
                    <p><a href="nosotros.php">Nosotros</a></p>
                    <p><a href="contacto.php">Contacto</a></p>
                </div>
                <div class="col-md-4 mb-4">
                    <h6>Contacto</h6>
                    <p>📍 Maipú, Región Metropolitana</p>
                    <p>✉️ contacto@fukusukesushi.cl</p>
                </div>
            </div>
            <div class="copyright">&copy; 2026 Fukusuke Sushi-Delivery. Todos los derechos reservados.</div>
        </div>
    </footer>

    <script src="js/datos-productos.js"></script>
    <script src="js/carrito.js"></script>
    <script src="js/menu.js"></script>
</body>
</html>
