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
                    <div id="mensaje-pago" class="alerta-radio alerta-error mt-3 d-none"></div>
                    <p class="small mt-2 mb-0"><a href="carrito.php">← Volver a mi pedido</a></p>
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
    <script src="js/datos-productos.js"></script>
    <script src="js/carrito.js"></script>
    <script>
        // El total y el monto a cobrar vienen del backend: el navegador solo elige el método.
        let metodoPago = null;
        let pedido = null;
        const METODOS = { "Servipag": "SERVIPAG", "Depósito bancario": "DEPOSITO" };

        function seleccionarPago(el, nombre) {
            document.querySelectorAll(".opcion-pago").forEach(o => o.classList.remove("seleccionada"));
            el.classList.add("seleccionada");
            metodoPago = nombre;
        }

        async function cargarPedido() {
            const id = sessionStorage.getItem("fukusukePedido");
            if (!id || !Sesion.actual()) { window.location = "carrito.php"; return; }
            try {
                pedido = await Api.pedir("GET", "/orders/" + id);
                if (pedido.estado !== "PENDIENTE_PAGO") { window.location = "carrito.php"; return; }
                document.getElementById("total-pago").textContent = formatearCLP(pedido.total);
            } catch (e) { window.location = "carrito.php"; }
        }
        cargarPedido();

        async function confirmarPago() {
            const aviso = document.getElementById("mensaje-pago");
            if (!metodoPago) {
                alert("Selecciona un método de pago para continuar.");
                return;
            }
            const metodo = METODOS[metodoPago];
            // la misma clave de idempotencia para reintentos del mismo pedido y método
            const claveRef = "fukusukeIdem-" + pedido.pedidoId + "-" + metodo;
            const clave = sessionStorage.getItem(claveRef) || Api.uuid();
            sessionStorage.setItem(claveRef, clave);
            try {
                const r = await Api.pedir("POST", "/payments", { pedidoId: pedido.pedidoId, metodo }, { "Idempotency-Key": clave });
                if (r.redirectUrl) { window.location = r.redirectUrl; return; }
                const d = r.instruccionesDeposito;
                document.querySelector(".tarjeta-formulario").innerHTML = `
                    <h5>Instrucciones de depósito</h5>
                    <div class="boleta-linea"><span>Banco</span><span>${escapar(d.banco)}</span></div>
                    <div class="boleta-linea"><span>Cuenta</span><span>${escapar(d.cuenta)}</span></div>
                    <div class="boleta-linea"><span>Referencia</span><span><strong>${escapar(d.referencia)}</strong></span></div>
                    <div class="boleta-linea fw-bold"><span>Monto</span><span>${formatearCLP(d.monto)}</span></div>
                    <p class="text-muted small mt-3">Cuando el local confirme tu depósito se emitirá la boleta y te llegará por correo.</p>
                    <a class="btn-principal d-block text-center" style="color:#fff;" href="boleta.php?pagoId=${r.pagoId}&pedidoId=${pedido.pedidoId}">Ver estado del pago</a>`;
            } catch (e) {
                aviso.classList.remove("d-none");
                aviso.textContent = e.message;
            }
        }
    </script>
</body>
</html>
