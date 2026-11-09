<!DOCTYPE html>
<html lang="es">

<head>
    <title>Fukusuke Sushi-Delivery | Inicio</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <link
        href="vendor/bootstrap/dist/css/bootstrap.min.css"
        rel="stylesheet">
    <script
        src="vendor/bootstrap/dist/js/bootstrap.bundle.min.js">
    </script>

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
                    <li class="nav-item">
                        <a class="nav-link active" aria-current="page" href="index.php">Inicio</a>
                    </li>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">Carta</a>
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
                        <a class="nav-link carrito-link" href="carrito.php">
                            🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span>
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="hero-principal">
        <div class="hero-contenido">
            <span class="hero-etiqueta">Envío gratis en un radio de 3 km</span>
            <h1>Sushi fresco, directo a tu puerta</h1>
            <p>Arma tu pedido on-line, paga con Servipag o depósito, y recíbelo en tu domicilio en Maipú.</p>
            <a href="menu.php" class="btn-principal">Ver la carta</a>
            <a href="registro.php" class="btn-secundario">Crear mi cuenta</a>
        </div>
    </section>

    <section class="seccion">
        <div class="container">
            <div class="seccion-titulo">
                <h2>Destacados de la carta</h2>
                <p>Los favoritos de nuestros clientes, listos para pedir</p>
            </div>
            <div class="row" id="destacados"></div>
            <div class="text-center mt-3">
                <a href="menu.php" class="btn-principal">Ver carta completa</a>
            </div>
        </div>
    </section>

    <section class="seccion seccion-suave">
        <div class="container">
            <div class="row text-center g-4">
                <div class="col-md-4">
                    <div class="tarjeta-info">
                        <div class="icono">📝</div>
                        <h5>1. Arma tu pedido</h5>
                        <p class="text-muted mb-0">Elige tus productos desde la carta on-line.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="tarjeta-info">
                        <div class="icono">💳</div>
                        <h5>2. Paga en línea</h5>
                        <p class="text-muted mb-0">Con Servipag o depósito bancario.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="tarjeta-info">
                        <div class="icono">🛵</div>
                        <h5>3. Recibe en tu casa</h5>
                        <p class="text-muted mb-0">Despacho gratuito dentro de 3 km a la redonda.</p>
                    </div>
                </div>
            </div>
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
            <div class="copyright">
                &copy; 2026 Fukusuke Sushi-Delivery. Todos los derechos reservados.
            </div>
        </div>
    </footer>

    <script src="js/datos-productos.js"></script>
    <script src="js/carrito.js"></script>
    <script>
        document.getElementById("destacados").innerHTML = productos.slice(0, 3).map(p => `
            <div class="col-md-4 mb-4">
                <div class="tarjeta-producto card">
                    <a href="producto.php?id=${p.id}" class="text-decoration-none text-reset">
                        <div class="tarjeta-producto-img"><img src="${p.imagen}" alt="${p.nombre}" loading="lazy"></div>
                    </a>
                    <div class="card-body">
                        <span class="categoria-badge">${p.categoriaNombre}</span>
                        <a href="producto.php?id=${p.id}" class="text-decoration-none text-reset"><h5>${p.nombre}</h5></a>
                        <div class="text-muted small mb-2">${p.piezas}</div>
                        <div class="precio mb-2">$${p.precio.toLocaleString("es-CL")}</div>
                        <button class="btn-agregar" onclick="agregarAlCarrito(${p.id}); alert('${p.nombre} agregado al pedido');">Agregar al pedido</button>
                    </div>
                </div>
            </div>
        `).join("");
    </script>
</body>
</html>
