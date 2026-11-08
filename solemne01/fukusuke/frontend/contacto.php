<!DOCTYPE html>
<html lang="es">

<head>
    <title>Contacto | Fukusuke Sushi-Delivery</title>
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
                    <li class="nav-item"><a class="nav-link active" href="contacto.php">Contacto</a></li>
                    <li class="nav-item"><a class="nav-link boton-ingresar" href="registro.php">Ingresar / Registrarme</a></li>
                    <li class="nav-item"><a class="nav-link carrito-link" href="carrito.php">🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span></a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="seccion">
        <div class="container">
            <div class="seccion-titulo">
                <h2>Contáctanos</h2>
                <p>¿Dudas sobre tu pedido o el área de cobertura? Escríbenos.</p>
            </div>

            <div class="row g-4">
                <div class="col-md-6">
                    <div class="tarjeta-formulario">
                        <form onsubmit="return enviarContacto(event)">
                            <div class="mb-3">
                                <label class="form-label">Nombre</label>
                                <input type="text" id="con-nombre" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Correo electrónico</label>
                                <input type="email" id="con-email" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Asunto</label>
                                <input type="text" id="con-asunto" class="form-control" value="Consulta" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Mensaje</label>
                                <textarea id="con-mensaje" class="form-control" rows="4" maxlength="1000" required></textarea>
                            </div>
                            <button class="btn-principal w-100" style="color:#fff;">Enviar mensaje</button>
                            <div id="confirmacion-contacto" class="alerta-radio mt-3 d-none">
                                ¡Gracias! Tu mensaje fue enviado, te responderemos a la brevedad.
                            </div>
                        </form>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="tarjeta-info h-100">
                        <div class="icono">📍</div>
                        <h5>Ubicación</h5>
                        <p class="text-muted">Maipú, Región Metropolitana</p>

                        <div class="icono">🕒</div>
                        <h5>Horario de atención</h5>
                        <p class="text-muted">Lunes a domingo, 12:00 a 22:30 hrs</p>

                        <div class="icono">🛵</div>
                        <h5>Zona de despacho</h5>
                        <p class="text-muted mb-0">Radio de 3 km desde el local (envío gratuito)</p>
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

    <script src="js/api.js"></script>
    <script src="js/carrito.js"></script>
    <script>
        async function enviarContacto(e) {
            e.preventDefault();
            const ok = document.getElementById("confirmacion-contacto");
            const v = (id) => document.getElementById(id).value.trim();
            try {
                await Api.pedir("POST", "/contact", { nombre: v("con-nombre"), email: v("con-email"), asunto: v("con-asunto"), mensaje: v("con-mensaje") });
                ok.classList.remove("d-none", "alerta-error");
                ok.textContent = "¡Gracias! Tu mensaje fue enviado, te responderemos a la brevedad.";
                e.target.reset();
            } catch (err) {
                ok.classList.remove("d-none");
                ok.classList.add("alerta-error");
                ok.textContent = err.message;
            }
            return false;
        }
    </script>
</body>
</html>
