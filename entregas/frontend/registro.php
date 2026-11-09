<!DOCTYPE html>
<html lang="es">

<head>
    <title>Registro / Ingreso | Fukusuke Sushi-Delivery</title>
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
                    <li class="nav-item"><a class="nav-link boton-ingresar active" href="registro.php">Ingresar / Registrarme</a></li>
                    <li class="nav-item">
                        <a class="nav-link carrito-link" href="carrito.php">🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span></a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="seccion">
        <div class="container">
            <ul class="nav nav-pills justify-content-center mb-4" id="tabPestanas" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tab-login" type="button">Iniciar sesión</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-registro" type="button">Crear cuenta</button>
                </li>
            </ul>

            <div class="tab-content" style="max-width: 560px; margin: 0 auto;">

                <div class="tab-pane fade show active" id="tab-login">
                    <div class="tarjeta-formulario">
                        <h4 class="mb-3">Ingresa a tu cuenta</h4>
                        <form onsubmit="event.preventDefault(); window.location='menu.php';">
                            <div class="mb-3">
                                <label class="form-label">Correo electrónico</label>
                                <input type="email" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Contraseña</label>
                                <input type="password" class="form-control" required>
                            </div>
                            <button class="btn-principal w-100" style="color:#fff;">Ingresar</button>
                        </form>
                    </div>
                </div>

                <div class="tab-pane fade" id="tab-registro">
                    <div class="tarjeta-formulario">
                        <h4 class="mb-3">Crea tu cuenta</h4>
                        <form onsubmit="return validarRegistro(event)">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">RUN</label>
                                    <input type="text" class="form-control" placeholder="12.345.678-9" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Nombre completo</label>
                                    <input type="text" class="form-control" required>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Dirección</label>
                                <input type="text" class="form-control" required>
                            </div>
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Comuna</label>
                                    <input type="text" class="form-control" value="Maipú" required>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Provincia</label>
                                    <input type="text" class="form-control" required>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Región</label>
                                    <input type="text" class="form-control" value="Metropolitana" required>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Fecha de nacimiento</label>
                                    <input type="date" class="form-control" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Sexo</label>
                                    <select class="form-select" required>
                                        <option value="">Selecciona</option>
                                        <option>Femenino</option>
                                        <option>Masculino</option>
                                        <option>Otro</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Correo electrónico</label>
                                <input type="email" id="correo-registro" class="form-control" required>
                                <div class="form-text">Validaremos que tu correo exista y esté activo antes de habilitar la cuenta.</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Teléfono</label>
                                <input type="tel" class="form-control" placeholder="+56 9 ____ ____" required>
                            </div>
                            <div id="mensaje-validacion" class="alerta-radio mb-3 d-none"></div>
                            <button class="btn-principal w-100" style="color:#fff;">Registrarme</button>
                        </form>
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
    <script>
        function validarRegistro(e) {
            e.preventDefault();
            const mensaje = document.getElementById("mensaje-validacion");
            mensaje.classList.remove("d-none");
            mensaje.textContent = "Validando existencia del correo electrónico (API de mensajería)...";

            setTimeout(() => {
                mensaje.textContent = "Correo validado. Cuenta creada correctamente.";
                setTimeout(() => window.location = "menu.php", 1200);
            }, 1200);

            return false;
        }
    </script>
</body>
</html>
