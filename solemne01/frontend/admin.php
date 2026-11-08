<!DOCTYPE html>
<html lang="es">

<head>
    <title>Panel de administración | Fukusuke Sushi-Delivery</title>
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
                    <li class="nav-item"><a class="nav-link carrito-link" href="carrito.php">🛒 Carrito <span id="contador-carrito" class="carrito-contador">0</span></a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="seccion">
        <div class="container">
            <div class="seccion-titulo">
                <h2>Panel de administración</h2>
                <p>Mantenedores de productos, clientes y usuarios; depósitos, registro presencial, pedidos y reporte de ventas.</p>
            </div>
            <div id="aviso-admin" class="alerta-radio mb-3 d-none"></div>
            <ul class="nav nav-pills mb-4 flex-wrap" role="tablist">
                <li class="nav-item solo-admin"><button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tab-productos" type="button">Productos</button></li>
                <li class="nav-item solo-admin"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-depositos" type="button">Depósitos</button></li>
                <li class="nav-item solo-admin"><button class="nav-link" id="btn-tab-clientes" data-bs-toggle="pill" data-bs-target="#tab-clientes" type="button">Clientes</button></li>
                <li class="nav-item solo-admin"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-presencial" type="button">Registro presencial</button></li>
                <li class="nav-item solo-admin"><button class="nav-link" id="btn-tab-usuarios" data-bs-toggle="pill" data-bs-target="#tab-usuarios" type="button">Usuarios</button></li>
                <li class="nav-item solo-admin"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-pedidos" type="button">Pedidos</button></li>
                <li class="nav-item"><button class="nav-link" id="btn-tab-reporte" data-bs-toggle="pill" data-bs-target="#tab-reporte" type="button">Reporte de ventas</button></li>
            </ul>
            <div class="tab-content">
                <div class="tab-pane fade show active" id="tab-productos">
                    <div class="row g-4">
                        <div class="col-lg-8">
                            <div class="table-responsive"><table class="table table-sm align-middle panel-tabla">
                                <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Disponible</th></tr></thead>
                                <tbody id="tabla-productos"></tbody></table></div>
                        </div>
                        <div class="col-lg-4">
                            <div class="tarjeta-formulario">
                                <h5>Nuevo producto</h5>
                                <form onsubmit="return crearProducto(event)">
                                    <input class="form-control mb-2" id="np-nombre" placeholder="Nombre" required>
                                    <select class="form-select mb-2" id="np-categoria"></select>
                                    <input class="form-control mb-2" id="np-precio" type="number" min="1" placeholder="Precio (CLP)" required>
                                    <input class="form-control mb-2" id="np-formato" placeholder="Formato (ej: 8 piezas)">
                                    <select class="form-select mb-2" id="np-imagen"></select>
                                    <textarea class="form-control mb-2" id="np-descripcion" rows="2" placeholder="Descripción" required></textarea>
                                    <button class="btn-principal w-100" style="color:#fff;">Crear producto</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tab-pane fade" id="tab-depositos">
                    <div class="table-responsive"><table class="table table-sm align-middle panel-tabla">
                        <thead><tr><th>Referencia</th><th>Monto</th><th>Fecha</th><th>N° operación (cartola)</th><th>Fecha depósito</th><th></th></tr></thead>
                        <tbody id="tabla-depositos"></tbody></table></div>
                </div>
                <div class="tab-pane fade" id="tab-clientes">
                    <form class="d-flex gap-2 mb-3" style="max-width:640px" onsubmit="return buscarClientes(event)">
                        <input class="form-control" id="bc-q" placeholder="Buscar por nombre, correo o RUN">
                        <button class="btn-principal" style="color:#fff;">Buscar</button>
                    </form>
                    <div class="row g-4">
                        <div class="col-lg-8">
                            <div class="table-responsive"><table class="table table-sm align-middle panel-tabla">
                                <thead><tr><th>Cliente</th><th>RUN</th><th>Comuna</th><th>Estado</th><th></th></tr></thead>
                                <tbody id="tabla-clientes"></tbody></table></div>
                            <div class="d-flex gap-2 align-items-center small">
                                <button class="btn btn-sm btn-outline-dark" onclick="paginaClientes(-1)">Anterior</button>
                                <span id="pag-clientes"></span>
                                <button class="btn btn-sm btn-outline-dark" onclick="paginaClientes(1)">Siguiente</button>
                            </div>
                        </div>
                        <div class="col-lg-4">
                            <div class="tarjeta-formulario d-none" id="editar-cliente">
                                <h5>Editar cliente</h5>
                                <p class="small text-muted mb-2" id="ec-identidad"></p>
                                <form onsubmit="return guardarCliente(event)">
                                    <input class="form-control mb-2" id="ec-nombre" placeholder="Nombre" required>
                                    <input class="form-control mb-2" id="ec-telefono" placeholder="Teléfono" required>
                                    <input class="form-control mb-2" id="ec-calle" placeholder="Calle" required>
                                    <input class="form-control mb-2" id="ec-numero" placeholder="Número" required>
                                    <input class="form-control mb-2" id="ec-comuna" placeholder="Comuna" required>
                                    <input class="form-control mb-2" id="ec-provincia" placeholder="Provincia" required>
                                    <input class="form-control mb-2" id="ec-region" placeholder="Región" required>
                                    <button class="btn-principal w-100" style="color:#fff;">Guardar cambios</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tab-pane fade" id="tab-usuarios">
                    <div class="row g-4">
                        <div class="col-lg-8">
                            <div class="table-responsive"><table class="table table-sm align-middle panel-tabla">
                                <thead><tr><th>Usuario</th><th>Rol</th><th>Habilitado</th></tr></thead>
                                <tbody id="tabla-usuarios"></tbody></table></div>
                        </div>
                        <div class="col-lg-4">
                            <div class="tarjeta-formulario">
                                <h5>Nuevo usuario del personal</h5>
                                <form onsubmit="return crearUsuario(event)">
                                    <input class="form-control mb-2" id="nu-nombre" placeholder="Nombre" required>
                                    <input class="form-control mb-2" id="nu-email" type="email" placeholder="Correo" required>
                                    <select class="form-select mb-2" id="nu-rol"><option value="DESPACHO">Despacho / cocina</option><option value="ADMIN">Administración</option><option value="DUENO">Dueño</option></select>
                                    <input class="form-control mb-2" id="nu-password" type="password" minlength="10" placeholder="Contraseña inicial (mín. 10)" autocomplete="new-password" required>
                                    <button class="btn-principal w-100" style="color:#fff;">Crear usuario</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tab-pane fade" id="tab-presencial">
                    <div class="tarjeta-formulario" style="max-width:640px">
                        <h5>Registrar cliente en el local</h5>
                        <p class="small text-muted">El cliente recibirá un enlace para confirmar su correo y definir su contraseña.</p>
                        <form onsubmit="return registrarPresencial(event)" class="row g-2">
                            <div class="col-md-6"><input class="form-control" id="rp-run" placeholder="RUN" required></div>
                            <div class="col-md-6"><input class="form-control" id="rp-nombre" placeholder="Nombre completo" required></div>
                            <div class="col-md-6"><input class="form-control" id="rp-email" type="email" placeholder="Correo" required></div>
                            <div class="col-md-6"><input class="form-control" id="rp-telefono" placeholder="Teléfono" required></div>
                            <div class="col-md-8"><input class="form-control" id="rp-calle" placeholder="Calle" required></div>
                            <div class="col-md-4"><input class="form-control" id="rp-numero" placeholder="Número" required></div>
                            <div class="col-md-4"><input class="form-control" id="rp-comuna" value="Maipú" required></div>
                            <div class="col-md-4"><input class="form-control" id="rp-provincia" value="Santiago" required></div>
                            <div class="col-md-4"><input class="form-control" id="rp-region" value="Metropolitana" required></div>
                            <div class="col-md-6"><input class="form-control" id="rp-nacimiento" type="date" required></div>
                            <div class="col-md-6"><select class="form-select" id="rp-sexo"><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">Otro</option></select></div>
                            <div class="col-12"><button class="btn-principal w-100" style="color:#fff;">Registrar</button></div>
                        </form>
                    </div>
                </div>
                <div class="tab-pane fade" id="tab-pedidos">
                    <form class="d-flex gap-2 mb-3" style="max-width:560px" onsubmit="return buscarPedido(event)">
                        <input class="form-control" id="bp-id" placeholder="ID del pedido" required>
                        <button class="btn-principal" style="color:#fff;">Buscar</button>
                    </form>
                    <div id="detalle-pedido-admin"></div>
                </div>
                <div class="tab-pane fade" id="tab-reporte">
                    <form class="d-flex flex-wrap gap-2 mb-3 align-items-end" onsubmit="return cargarReporte(event)">
                        <div><label class="form-label small mb-0">Desde</label><input class="form-control" type="date" id="rep-desde"></div>
                        <div><label class="form-label small mb-0">Hasta</label><input class="form-control" type="date" id="rep-hasta"></div>
                        <button class="btn-principal" style="color:#fff;">Consultar</button>
                    </form>
                    <div id="reporte"></div>
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
        const CATS = Object.keys(Api.CATEGORIAS);
        const IMGS = ["img/california-roll.jpg", "img/ebi-tempura.png", "img/sashimi-salmon.jpg", "img/temaki-salmon.jpg", "img/combo-fukusuke.jpg",
            "img/gyozas.jpg", "img/roll-acevichado.jpg", "img/bebida-lata.jpg", "img/jugo-natural.jpg", "img/agua-mineral.jpg", "img/bebida-1l.png"];
        const aviso = document.getElementById("aviso-admin");
        const s = Sesion.actual();
        let lista = [];

        function mostrarAviso(t, error) {
            aviso.classList.remove("d-none");
            aviso.classList.toggle("alerta-error", !!error);
            aviso.textContent = t;
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        // ---- Productos (S01 con todos=true, S15, S16) ----
        async function cargarProductos() {
            const r = await Api.pedir("GET", "/products?todos=true&size=50");
            lista = r.items;
            document.getElementById("tabla-productos").innerHTML = lista.map(p => `<tr>
                <td>${escapar(p.nombre)}<div class="small text-muted">${escapar(p.formato)}</div></td>
                <td>${Api.CATEGORIAS[p.categoria]}</td><td>${formatearCLP(p.precio)}</td>
                <td><div class="form-check form-switch"><input class="form-check-input" type="checkbox" ${p.disponible ? "checked" : ""}
                    onchange="cambiarDisponible('${p.id}', this.checked)"></div></td></tr>`).join("");
        }
        async function cambiarDisponible(id, disponible) {
            const p = lista.find(x => x.id === id);
            try {
                await Api.pedir("PUT", "/products/" + id, { nombre: p.nombre, descripcion: p.descripcion, formato: p.formato,
                    categoriaId: CATS.indexOf(p.categoria) + 1, precio: p.precio, imagen: p.imagen, disponible });
                mostrarAviso(p.nombre + (disponible ? " habilitado" : " deshabilitado (ya no aparece en la carta)"));
                cargarProductos();
            } catch (e) { mostrarAviso(e.message, true); cargarProductos(); }
        }
        async function crearProducto(e) {
            e.preventDefault();
            const v = (id) => document.getElementById(id).value.trim();
            try {
                await Api.pedir("POST", "/products", { nombre: v("np-nombre"), descripcion: v("np-descripcion"), formato: v("np-formato"),
                    categoriaId: Number(v("np-categoria")), precio: Number(v("np-precio")), imagen: v("np-imagen"), disponible: true });
                mostrarAviso("Producto creado.");
                e.target.reset();
                cargarProductos();
            } catch (err) { mostrarAviso(err.message, true); }
            return false;
        }

        // ---- Depósitos (S21 y S12) ----
        async function cargarDepositos() {
            const r = await Api.pedir("GET", "/payments/pendientes");
            const hoy = new Date().toISOString().slice(0, 10);
            document.getElementById("tabla-depositos").innerHTML = r.length ? r.map(d => `<tr>
                <td><strong>${d.referencia}</strong></td><td>${formatearCLP(d.monto)}</td><td>${new Date(d.creadoEn).toLocaleString("es-CL")}</td>
                <td><input class="form-control form-control-sm" id="op-${d.pagoId}" placeholder="N° operación"></td>
                <td><input class="form-control form-control-sm" type="date" id="fd-${d.pagoId}" value="${hoy}"></td>
                <td><button class="btn btn-sm btn-dark" onclick="confirmarDeposito('${d.pagoId}')">Confirmar</button></td></tr>`).join("")
                : '<tr><td colspan="6" class="text-muted">No hay depósitos pendientes.</td></tr>';
        }
        async function confirmarDeposito(pagoId) {
            try {
                const r = await Api.pedir("POST", "/payments/" + pagoId + "/confirmacion", {
                    numeroOperacion: document.getElementById("op-" + pagoId).value.trim(), fechaDeposito: document.getElementById("fd-" + pagoId).value });
                mostrarAviso("Depósito confirmado. Boleta " + r.folioBoleta + " emitida y enviada al cliente.");
                cargarDepositos();
            } catch (e) { mostrarAviso(e.message, true); }
        }

        // ---- Mantenedor de clientes (CU3: S22 buscar, S23 ficha, S24 editar, S25 habilitar/deshabilitar, S26 eliminar datos) ----
        const ESTADOS_CLIENTE = { ACTIVO: "Activo", INACTIVO: "Deshabilitado", PENDIENTE_VERIFICACION: "Sin verificar", DESCONOCIDO: "—" };
        let paginaCli = 1, totalCli = 0, editandoId = null;
        async function cargarClientes() {
            const q = document.getElementById("bc-q").value.trim();
            const r = await Api.pedir("GET", `/clients?q=${encodeURIComponent(q)}&page=${paginaCli}&size=10`);
            totalCli = r.total;
            document.getElementById("pag-clientes").textContent = `Página ${r.page} · ${r.total} cliente(s)`;
            document.getElementById("tabla-clientes").innerHTML = r.items.length ? r.items.map(c => `<tr>
                <td>${escapar(c.nombre)}<div class="small text-muted">${escapar(c.email)}</div></td><td>${escapar(c.run)}</td><td>${escapar(c.comuna || "")}</td>
                <td>${ESTADOS_CLIENTE[c.estado] || escapar(c.estado)}</td>
                <td class="text-nowrap"><button class="btn btn-sm btn-outline-dark" onclick="editarCliente('${c.clienteId}')">Editar</button>
                    ${c.estado === "INACTIVO" ? `<button class="btn btn-sm btn-outline-dark" onclick="estadoCliente('${c.clienteId}', 'ACTIVO')">Habilitar</button>`
                        : `<button class="btn btn-sm btn-outline-dark" onclick="estadoCliente('${c.clienteId}', 'INACTIVO')">Deshabilitar</button>`}
                    <button class="btn-anular" onclick="eliminarCliente('${c.clienteId}')">Eliminar datos</button></td></tr>`).join("")
                : '<tr><td colspan="5" class="text-muted">Sin resultados.</td></tr>';
        }
        function buscarClientes(e) { if (e) e.preventDefault(); paginaCli = 1; cargarClientes().catch(err => mostrarAviso(err.message, true)); return false; }
        function paginaClientes(d) {
            const max = Math.max(1, Math.ceil(totalCli / 10));
            paginaCli = Math.min(max, Math.max(1, paginaCli + d));
            cargarClientes().catch(err => mostrarAviso(err.message, true));
        }
        async function editarCliente(id) {
            try {
                const c = await Api.pedir("GET", "/clients/" + id);
                editandoId = id;
                document.getElementById("editar-cliente").classList.remove("d-none");
                document.getElementById("ec-identidad").textContent = `${c.email} · RUN ${c.run}`;
                const set = (k, v) => { document.getElementById(k).value = v || ""; };
                set("ec-nombre", c.nombre); set("ec-telefono", c.telefono);
                const d = c.direccion || {};
                set("ec-calle", d.calle); set("ec-numero", d.numero); set("ec-comuna", d.comuna); set("ec-provincia", d.provincia); set("ec-region", d.region);
            } catch (e) { mostrarAviso(e.message, true); }
        }
        async function guardarCliente(e) {
            e.preventDefault();
            const v = (id) => document.getElementById(id).value.trim();
            try {
                await Api.pedir("PUT", "/clients/" + editandoId, { nombre: v("ec-nombre"), telefono: v("ec-telefono"),
                    direccion: { calle: v("ec-calle"), numero: v("ec-numero"), comuna: v("ec-comuna"), provincia: v("ec-provincia"), region: v("ec-region") } });
                mostrarAviso("Datos del cliente actualizados.");
                document.getElementById("editar-cliente").classList.add("d-none");
                cargarClientes();
            } catch (err) { mostrarAviso(err.message, true); }
            return false;
        }
        async function estadoCliente(id, estado) {
            try {
                const r = await Api.pedir("PATCH", `/clients/${id}/estado`, { estado });
                mostrarAviso(r.estado === "INACTIVO" ? "Cliente deshabilitado: ya no puede ingresar y sus sesiones se cerraron." : "Cliente habilitado.");
                cargarClientes();
            } catch (e) { mostrarAviso(e.message, true); }
        }
        async function eliminarCliente(id) {
            if (!confirm("¿Eliminar los datos personales de este cliente? Se borran RUN, teléfono, nacimiento, sexo y direcciones; sus pedidos y boletas se conservan sin esos datos. No se puede deshacer.")) return;
            try {
                await Api.pedir("DELETE", "/clients/" + id);
                mostrarAviso("Datos personales del cliente eliminados.");
                document.getElementById("editar-cliente").classList.add("d-none");
                cargarClientes();
            } catch (e) { mostrarAviso(e.message, true); }
        }

        // ---- Mantenedor de usuarios del personal (CU2: S27 listar, S28 crear, S29 rol/estado) ----
        const ROLES = { ADMIN: "Administración", DESPACHO: "Despacho / cocina", DUENO: "Dueño" };
        async function cargarUsuarios() {
            const r = await Api.pedir("GET", "/users");
            document.getElementById("tabla-usuarios").innerHTML = r.items.map(u => `<tr>
                <td>${escapar(u.nombre)}<div class="small text-muted">${escapar(u.email)}</div></td>
                <td><select class="form-select form-select-sm" onchange="modificarUsuario('${u.cuentaId}', { rol: this.value })">
                    ${Object.keys(ROLES).map(k => `<option value="${k}" ${k === u.rol ? "selected" : ""}>${ROLES[k]}</option>`).join("")}</select></td>
                <td><div class="form-check form-switch"><input class="form-check-input" type="checkbox" ${u.estado === "ACTIVA" ? "checked" : ""}
                    onchange="modificarUsuario('${u.cuentaId}', { estado: this.checked ? 'ACTIVA' : 'BLOQUEADA' })"></div></td></tr>`).join("");
        }
        async function modificarUsuario(id, cambio) {
            try {
                await Api.pedir("PATCH", "/users/" + id, cambio);
                mostrarAviso(cambio.estado === "BLOQUEADA" ? "Usuario deshabilitado: sus sesiones se cerraron." : "Usuario actualizado.");
            } catch (e) { mostrarAviso(e.message, true); }
            cargarUsuarios();
        }
        async function crearUsuario(e) {
            e.preventDefault();
            const v = (id) => document.getElementById(id).value.trim();
            try {
                const u = await Api.pedir("POST", "/users", { nombre: v("nu-nombre"), email: v("nu-email"), rol: v("nu-rol"), password: document.getElementById("nu-password").value });
                mostrarAviso(`Usuario ${u.email} creado con rol ${ROLES[u.rol]}. Entrégale la contraseña inicial en persona.`);
                e.target.reset();
                cargarUsuarios();
            } catch (err) { mostrarAviso(err.message, true); }
            return false;
        }

        // ---- Registro presencial (S03 como ADMIN) ----
        async function registrarPresencial(e) {
            e.preventDefault();
            const v = (id) => document.getElementById(id).value.trim();
            try {
                const r = await Api.pedir("POST", "/clients", { run: v("rp-run"), nombre: v("rp-nombre"), email: v("rp-email"), telefono: v("rp-telefono"),
                    fechaNacimiento: v("rp-nacimiento"), sexo: v("rp-sexo"),
                    direccion: { calle: v("rp-calle"), numero: v("rp-numero"), comuna: v("rp-comuna"), provincia: v("rp-provincia"), region: v("rp-region") } });
                mostrarAviso("Cliente registrado. Se envió el enlace de activación a " + r.email + ".");
                e.target.reset();
            } catch (err) { mostrarAviso(err.message, true); }
            return false;
        }

        // ---- Pedidos: anulación posterior al pago (S09 y S08 como ADMIN) ----
        async function buscarPedido(e) {
            if (e) e.preventDefault();
            const id = document.getElementById("bp-id").value.trim();
            const c = document.getElementById("detalle-pedido-admin");
            try {
                const p = await Api.pedir("GET", "/orders/" + id);
                c.innerHTML = `<p><strong>Estado:</strong> ${p.estado} · <strong>Total:</strong> ${formatearCLP(p.total)} · ${escapar(p.comuna)}</p>
                    <table class="table table-sm panel-tabla"><thead><tr><th>Producto</th><th>Cant.</th><th>Subtotal</th><th>Estado</th><th></th></tr></thead><tbody>
                    ${p.items.map(i => `<tr><td>${escapar(i.nombre)}</td><td>${i.cantidad}</td><td>${formatearCLP(i.subtotal)}</td>
                        <td>${i.estado}${i.motivo ? " · " + escapar(i.motivo) : ""}</td>
                        <td>${i.estado === "VIGENTE" ? `<button class="btn-anular" onclick="anularAdmin('${p.pedidoId}', '${i.itemId}')">Anular</button>` : ""}</td></tr>`).join("")}
                    </tbody></table>`;
            } catch (err) { c.innerHTML = `<p class="text-muted">${escapar(err.message)}</p>`; }
            return false;
        }
        async function anularAdmin(pedidoId, itemId) {
            const motivo = prompt("Motivo de la anulación:");
            if (!motivo) return;
            try { await Api.pedir("PATCH", `/orders/${pedidoId}/items/${itemId}/anulacion`, { motivo }); mostrarAviso("Ítem anulado."); buscarPedido(); }
            catch (e) { mostrarAviso(e.message, true); }
        }

        // ---- Reporte de ventas (S19, DUENO o ADMIN) ----
        async function cargarReporte(e) {
            if (e) e.preventDefault();
            const desde = document.getElementById("rep-desde").value;
            const hasta = document.getElementById("rep-hasta").value;
            const c = document.getElementById("reporte");
            try {
                const r = await Api.pedir("GET", `/reports/sales?desde=${desde}&hasta=${hasta}`);
                const max = Math.max(1, ...r.porDia.map(d => d.total));
                c.innerHTML = `<div class="row g-3 mb-3">
                    <div class="col-md-4"><div class="tarjeta-info"><h6>Ventas del período</h6><h3>${formatearCLP(r.totalVentas)}</h3></div></div>
                    <div class="col-md-4"><div class="tarjeta-info"><h6>Pedidos</h6><h3>${r.cantidadPedidos.toLocaleString("es-CL")}</h3></div></div>
                    <div class="col-md-4"><div class="tarjeta-info"><h6>Ticket promedio</h6><h3>${formatearCLP(r.ticketPromedio)}</h3></div></div></div>
                    <div class="row g-4"><div class="col-lg-7"><h6>Ventas por día</h6><table class="table table-sm panel-tabla"><thead><tr><th>Fecha</th><th style="width:50%"></th><th>Total</th></tr></thead><tbody>
                    ${r.porDia.map(d => `<tr><td>${d.fecha}</td><td><div class="barra-reporte" style="width:${Math.round(d.total / max * 100)}%"></div></td><td>${formatearCLP(d.total)}</td></tr>`).join("")}
                    </tbody></table></div><div class="col-lg-5"><h6>Productos más vendidos</h6><table class="table table-sm panel-tabla"><thead><tr><th>Producto</th><th>Unid.</th><th>Monto</th></tr></thead><tbody>
                    ${r.topProductos.map(t => `<tr><td>${escapar(t.nombre)}</td><td>${t.unidades}</td><td>${formatearCLP(t.monto)}</td></tr>`).join("")}
                    </tbody></table></div></div>`;
            } catch (err) { c.innerHTML = `<p class="text-muted">${escapar(err.message)}</p>`; }
            return false;
        }

        // ---- inicio según rol ----
        document.getElementById("np-categoria").innerHTML = CATS.map((c, i) => `<option value="${i + 1}">${Api.CATEGORIAS[c]}</option>`).join("");
        document.getElementById("np-imagen").innerHTML = IMGS.map(i => `<option>${i}</option>`).join("");
        document.getElementById("rep-hasta").value = new Date().toISOString().slice(0, 10);
        document.getElementById("rep-desde").value = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
        if (!s || !["ADMIN", "DUENO"].includes(s.rol)) {
            document.querySelector(".tab-content").innerHTML = '<p class="text-muted">Ingresa con una cuenta de administración. <a href="registro.php">Ingresar</a></p>';
        } else if (s.rol === "DUENO") {
            document.querySelectorAll(".solo-admin").forEach(x => x.remove());
            document.getElementById("btn-tab-reporte").click();
            cargarReporte();
        } else {
            cargarProductos().catch(e => mostrarAviso(e.message, true));
            cargarDepositos().catch(() => {});
            cargarClientes().catch(() => {});
            cargarUsuarios().catch(() => {});
            cargarReporte();
            if (location.hash === "#reporte") document.getElementById("btn-tab-reporte").click();
        }
    </script>
</body>
</html>
