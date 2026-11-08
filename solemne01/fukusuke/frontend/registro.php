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
                <div id="panel-verificacion" class="tarjeta-formulario mb-4 d-none"></div>

                <div class="tab-pane fade show active" id="tab-login">
                    <div class="tarjeta-formulario">
                        <h4 class="mb-3">Ingresa a tu cuenta</h4>
                        <form onsubmit="return iniciarSesion(event)">
                            <div class="mb-3">
                                <label class="form-label">Correo electrónico</label>
                                <input type="email" id="login-email" class="form-control" autocomplete="username" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Contraseña</label>
                                <input type="password" id="login-password" class="form-control" autocomplete="current-password" required>
                            </div>
                            <div id="mensaje-login" class="alerta-radio alerta-error mb-3 d-none"></div>
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
                                    <input type="text" id="reg-run" class="form-control" placeholder="12.345.678-9" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Nombre completo</label>
                                    <input type="text" id="reg-nombre" class="form-control" required>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Dirección</label>
                                <input type="text" id="reg-direccion" class="form-control" placeholder="Calle y número (ej: Av. Pajaritos 1234)" required>
                            </div>
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Comuna</label>
                                    <input type="text" id="reg-comuna" class="form-control" value="Maipú" required>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Provincia</label>
                                    <input type="text" id="reg-provincia" class="form-control" value="Santiago" required>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Región</label>
                                    <input type="text" id="reg-region" class="form-control" value="Metropolitana" required>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Fecha de nacimiento</label>
                                    <input type="date" id="reg-nacimiento" class="form-control" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Sexo</label>
                                    <select id="reg-sexo" class="form-select" required>
                                        <option value="">Selecciona</option>
                                        <option value="F">Femenino</option>
                                        <option value="M">Masculino</option>
                                        <option value="X">Otro</option>
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
                                <input type="tel" id="reg-telefono" class="form-control" placeholder="+56 9 ____ ____" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Contraseña</label>
                                <input type="password" id="reg-password" class="form-control" minlength="10" autocomplete="new-password" required>
                                <div class="form-text">Mínimo 10 caracteres.</div>
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

    <script src="js/api.js"></script>
    <script src="js/carrito.js"></script>
    <script>
        const params = new URLSearchParams(window.location.search);

        async function iniciarSesion(e) {
            e.preventDefault();
            const msg = document.getElementById("mensaje-login");
            msg.classList.add("d-none");
            try {
                const s = await Sesion.iniciar(document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
                window.location = s.rol === "CLIENTE" ? (params.get("volver") || "menu.php") : Sesion.destinoPorRol(s.rol);
            } catch (err) {
                msg.classList.remove("d-none");
                msg.textContent = err.message;
            }
            return false;
        }

        async function validarRegistro(e) {
            e.preventDefault();
            const mensaje = document.getElementById("mensaje-validacion");
            const v = (id) => document.getElementById(id).value.trim();
            mensaje.classList.remove("d-none", "alerta-error");
            const m = /^(.*\D)\s*(\d+[\w-]*)$/.exec(v("reg-direccion"));
            if (!m) { mensaje.classList.add("alerta-error"); mensaje.textContent = "Escribe la calle y el número (ej: Av. Pajaritos 1234)."; return false; }
            mensaje.textContent = "Enviando registro…";
            try {
                const r = await Api.pedir("POST", "/clients", {
                    run: v("reg-run"), nombre: v("reg-nombre"), email: v("correo-registro"), password: document.getElementById("reg-password").value,
                    telefono: v("reg-telefono"), fechaNacimiento: v("reg-nacimiento"), sexo: v("reg-sexo"),
                    direccion: { calle: m[1].trim(), numero: m[2], comuna: v("reg-comuna"), provincia: v("reg-provincia"), region: v("reg-region") },
                });
                mensaje.textContent = "Te enviamos un correo a " + r.email + " para confirmar que existe. Abre el enlace para activar tu cuenta.";
                e.target.reset();
            } catch (err) {
                mensaje.classList.add("alerta-error");
                const campos = err.data && err.data.error && err.data.error.details ? " (" + err.data.error.details.campos.join(", ") + ")" : "";
                mensaje.textContent = err.message + campos;
            }
            return false;
        }

        // RF11: confirmación del correo con el enlace recibido
        async function verificar(password) {
            const panel = document.getElementById("panel-verificacion");
            panel.classList.remove("d-none");
            panel.innerHTML = "<p class='mb-0'>Confirmando tu correo…</p>";
            try {
                await Api.pedir("POST", "/clients/email-verification", password ? { token: params.get("verificar"), password } : { token: params.get("verificar") });
                panel.innerHTML = "<h5>✔ Correo confirmado</h5><p class='mb-0'>Tu cuenta está activa. Ya puedes iniciar sesión.</p>";
            } catch (err) {
                if (err.status === 400 && /contraseña/i.test(err.message)) {
                    panel.innerHTML = `<h5>Define tu contraseña</h5><p class="small text-muted">Tu cuenta fue creada en el local.</p>
                        <input type="password" id="ver-password" class="form-control mb-2" minlength="10" placeholder="Mínimo 10 caracteres">
                        <button class="btn-principal w-100" style="color:#fff;" onclick="verificar(document.getElementById('ver-password').value)">Activar cuenta</button>`;
                } else {
                    panel.innerHTML = "<h5>No se pudo confirmar</h5><p class='mb-0'>" + escapar(err.message) + "</p>";
                }
            }
        }
        if (params.get("verificar")) verificar();
    </script>
</body>
</html>
