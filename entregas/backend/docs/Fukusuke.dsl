workspace "Fukusuke" "Caso 19 - Fukusuke Sushi-Delivery: modelo C4 del backend implementado (Evaluacion Unidad 2)" {

    // Mismo esquema que la guia del curso (PlataformaComercial_Despliegue.dsl), adaptado al caso.
    // Cada vista dinamica indica la prueba automatizada que la ejecuta (tests/e2e.test.js).
    // Ver en https://structurizr.com/dsl (pegar este archivo) o con Structurizr Lite.

    !identifiers hierarchical

    model {
        visitante = person "Visitante" "Persona que consulta la carta sin iniciar sesion."
        cliente = person "Cliente" "Persona registrada y verificada que hace pedidos, paga y consulta sus boletas."
        administrador = person "Administrador" "Personal del local: carta, clientes, usuarios, depositos y anulaciones."
        despacho = person "Encargado de despacho" "Personal del local que atiende la cola de pedidos pagados."
        dueno = person "Dueno" "Recibe el reporte de ventas por periodo."

        servipag = softwareSystem "Servipag" "Pasarela de pagos externa. En desarrollo y pruebas se usa un simulador (sandbox/servipag)." {
            tags "SistemaExterno"
        }
        correo = softwareSystem "Proveedor de correo" "API transaccional de correo (verificacion de cuenta y boletas). En desarrollo: simulador sandbox/mail." {
            tags "SistemaExterno"
        }

        sistema = softwareSystem "Fukusuke Sushi-Delivery" "Venta y despacho de sushi: carta, registro, pedidos, pagos, boletas, despacho y reportes." {
            tags "SistemaEvaluado"

            frontend = container "Frontend responsivo" "Paginas P01-P11 (escritorio y movil) con carrito en el navegador; consume la API por el mismo origen." "PHP + Bootstrap 5 + JavaScript (v1.1)" {
                tags "Frontend"
            }

            apiGateway = container "API Gateway" "Unico punto de entrada HTTPS; lista explicita de rutas R01-R31; tambien sirve el frontend." "Node.js 22 (gateway/)" {
                tags "Gateway"

                // C3 - Componentes internos del API Gateway.
                httpEntry = component "Adaptador HTTPS" "Termina TLS, asigna X-Correlation-Id, lee cookies y sirve el frontend (solo GET/HEAD)." "gateway/index.js" {
                    tags "EntradaC3"
                }
                routeTable = component "Tabla de rutas R01-R31" "Verbo + ruta externa -> servicio y ruta interna. Lo que no esta en la lista responde 404/405." "gateway/routes.js" {
                    tags "AplicacionC3"
                }
                identityFilter = component "Filtro de identidad y permisos" "Verifica JWT RS256 con la JWKS, rol por ruta y CSRF de doble envio; descarta cabeceras de identidad del navegador." "verifyUserToken + roles" {
                    tags "ControlC3"
                }
                limiter = component "Limites de la solicitud" "Rate limit por IP o usuario, tamano maximo de cuerpo, Idempotency-Key obligatoria en R06 y R10, cache de 60 s de la carta anonima." "permitir() + cache" {
                    tags "ControlC3"
                }
                routeDispatcher = component "Despachador" "Reenvia al servicio interno con su token de servicio y el contexto verificado (X-User-Token); plazo maximo por ruta." "fetch + AbortController" {
                    tags "AplicacionC3"
                }
                gwSecrets = component "Cliente de secretos" "Obtiene por referencia los tokens gw-<servicio> y el secreto del webhook." "shared/secrets.js" {
                    tags "IntegracionC3"
                }
                errorMapper = component "Traductor de errores" "Responde 503/504 y errores controlados {error:{code,message}} sin detalles internos." "errorJson()" {
                    tags "ErrorC3"
                }
            }

            authService = container "Auth Service" "Login, refresh rotativo, logout, JWKS y cuentas del personal (S27-S29)." "Node.js 22 + Express" {
                tags "Seguridad"

                // C3 - Componentes internos del Auth Service.
                identityApi = component "API de identidad" "/login, /refresh, /logout, /.well-known/jwks.json, /users e /internal/accounts." "Express" {
                    tags "EntradaC3"
                }
                credentialsVerifier = component "Verificador de credenciales" "bcrypt con sal; bloqueo temporal tras 5 intentos fallidos; exige correo verificado." "bcryptjs" {
                    tags "ControlC3"
                }
                sessionManager = component "Gestor de sesiones" "Emite JWT RS256 de 15 min y refresh token rotativo (solo su hash en BD); revoca al deshabilitar o cambiar rol." "jsonwebtoken" {
                    tags "AplicacionC3"
                }
                identityRepo = component "Repositorio de identidades" "Cuentas, roles, estados y refresh tokens." "mysql2" {
                    tags "PersistenciaC3"
                }
                authSecrets = component "Cliente de secretos" "Obtiene la clave privada de firma y la credencial de su base de datos." "shared/secrets.js" {
                    tags "IntegracionC3"
                }
            }

            secretManager = container "Administrador de secretos" "SecretProvider: cada servicio recibe solo sus secretos por referencia; nunca llegan al navegador ni al repositorio." "Docker secrets / carpeta secrets/ / Vault (opcional)" {
                tags "Seguridad"
            }

            inventory = container "inventory" "Carta, categorias, disponibilidad y precio oficial (S01, S02, S15, S16)." "Node.js 22 + Express" {
                tags "Privado"
            }

            orders = container "orders" "Ciclo de vida del pedido, anulaciones con motivo, cola y estados de despacho; autoridad del estado del pedido." "Node.js 22 + Express" {
                tags "Privado"

                // C3 - Componentes internos de orders.
                ordersApi = component "API de pedidos" "S06-S09, S17, S18 y rutas internas para payments y GraphQL." "Express" {
                    tags "EntradaC3"
                }
                accessPolicy = component "Politica de acceso a pedidos" "CLIENTE solo sus pedidos (404 si es ajeno); ADMIN todos; DESPACHO solo la cola." "verificarAcceso()" {
                    tags "ControlC3"
                }
                idempotency = component "Control de idempotencia" "Idempotency-Key + huella de la solicitud: el reintento devuelve el mismo pedido; otra solicitud con la clave -> 409." "pedidoPrevio()" {
                    tags "ControlC3"
                }
                orderWorkflow = component "Servicio de pedidos" "Total con precios de inventory, cobertura de despacho, anulaciones y transiciones de estado." "Servicio de aplicacion" {
                    tags "AplicacionC3"
                }
                inventoryAdapter = component "Adaptador de inventario" "Consulta precio y disponibilidad con plazo maximo; 503 si inventory no responde." "callService()" {
                    tags "IntegracionC3"
                }
                clientsAdapter = component "Adaptador de clientes" "Obtiene la direccion de entrega del cliente (copia en el pedido)." "callService()" {
                    tags "IntegracionC3"
                }
                outbox = component "Outbox de eventos" "Eventos de venta hacia analytics con reintentos." "tabla outbox" {
                    tags "IntegracionC3"
                }
                ordersRepo = component "Repositorio de pedidos" "Pedidos, detalles, ordenes de despacho, outbox y claves de idempotencia." "mysql2" {
                    tags "PersistenciaC3"
                }
            }

            clients = container "clients" "Registro con RUN cifrado, verificacion de correo, perfil, direcciones y mantenedor de clientes (S03-S05, S22-S26)." "Node.js 22 + Express" {
                tags "Privado"
            }

            payments = container "payments" "Inicio de pago idempotente, aviso firmado del proveedor, depositos, cajero virtual y boletas (S10-S14)." "Node.js 22 + Express" {
                tags "Privado"
            }

            analytics = container "analytics" "Reporte de ventas por periodo sin datos personales (S19)." "Node.js 22 + Express" {
                tags "Analitica"
            }

            dbAuth = container "Datos de identidad" "Esquema fk_auth (usuario propio de auth)." "MySQL 8 / MariaDB 10.4" {
                tags "BaseDatos"
            }
            dbInventory = container "Datos de inventario" "Esquema fk_inventory." "MySQL 8 / MariaDB 10.4" {
                tags "BaseDatos"
            }
            dbOrders = container "Datos de pedidos" "Esquema fk_orders." "MySQL 8 / MariaDB 10.4" {
                tags "BaseDatos"
            }
            dbClients = container "Datos de clientes" "Esquema fk_clients (RUN cifrado AES-256-GCM + HMAC)." "MySQL 8 / MariaDB 10.4" {
                tags "BaseDatos"
            }
            dbPayments = container "Datos de pagos" "Esquema fk_payments." "MySQL 8 / MariaDB 10.4" {
                tags "BaseDatos"
            }
            dbAnalytics = container "Datos de analitica" "Esquema fk_analytics (sin datos personales)." "MySQL 8 / MariaDB 10.4" {
                tags "BaseDatos"
            }

            graphqlGateway = container "GraphQL Gateway" "Gateway privado de agregacion: ResumenPedido (G01) y ColaDespacho (G02)." "Node.js 22 + graphql + DataLoader" {
                tags "Gateway"

                // C3 - Componentes internos del GraphQL Gateway.
                graphqlEndpoint = component "Endpoint GraphQL" "POST /graphql; solo acepta llamadas del API Gateway con token de servicio." "graphql-gateway/index.js" {
                    tags "EntradaC3"
                }
                persistedOps = component "Operaciones registradas" "Solo ResumenPedido y ColaDespacho; consulta libre o introspeccion -> 400." "schema.js (OPERACIONES)" {
                    tags "ControlC3"
                }
                queryValidator = component "Validador de limites" "Profundidad maxima 5 y costo maximo 100." "analizar()" {
                    tags "ControlC3"
                }
                fieldAccess = component "Autorizacion por recurso y campo" "G01: dueno del pedido o ADMIN; G02: DESPACHO o ADMIN; sin campos personales en la cola." "Resolvers con contexto verificado" {
                    tags "ControlC3"
                }
                resolvers = component "Resolvers" "Componen pedido, productos y pago." "Resolvers GraphQL" {
                    tags "AplicacionC3"
                }
                dataLoader = component "DataLoader" "Agrupa los productos de un pedido en una sola llamada a inventory (evita N+1)." "dataloader" {
                    tags "AplicacionC3"
                }
                serviceConnectors = component "Conectores de subsistemas" "Consultan orders, inventory y payments por sus rutas internas con token de lectura." "callService()" {
                    tags "IntegracionC3"
                }
                responseComposer = component "Compositor de respuestas" "Errores parciales: producto null + INVENTORY_UNAVAILABLE; nunca presenta un resultado parcial como completo." "errors[] de GraphQL" {
                    tags "ErrorC3"
                }
            }
        }

        // Relaciones de contexto (C1).
        visitante -> sistema "Consulta la carta"
        cliente -> sistema "Se registra, pide, paga y consulta sus boletas"
        administrador -> sistema "Administra carta, clientes, usuarios y depositos"
        despacho -> sistema "Atiende la cola de despacho"
        dueno -> sistema "Consulta el reporte de ventas"
        sistema -> servipag "Crea transacciones de pago" "HTTPS"
        servipag -> sistema "Avisa el resultado del pago (firma HMAC)" "HTTPS"
        sistema -> correo "Envia verificacion de cuenta y boletas" "HTTPS"

        // Relaciones entre actores y contenedores (C2).
        visitante -> sistema.frontend "Abre la carta" "Navegador web"
        cliente -> sistema.frontend "Compra y consulta sus pedidos" "Navegador web"
        administrador -> sistema.frontend "Usa el panel de administracion" "Navegador web"
        despacho -> sistema.frontend "Usa el panel de despacho" "Navegador web"
        dueno -> sistema.frontend "Consulta el reporte" "Navegador web"
        sistema.frontend -> sistema.apiGateway "Llama a la API /api/v1 (cookies HttpOnly + CSRF)" "HTTPS"
        sistema.apiGateway -> sistema.authService "Obtiene la JWKS y enruta login, refresh y usuarios" "HTTPS/JSON"
        sistema.apiGateway -> sistema.inventory "Enruta la carta y la administracion de productos" "HTTP/JSON + token de servicio"
        sistema.apiGateway -> sistema.orders "Enruta operaciones de pedidos" "HTTP/JSON + token de servicio"
        sistema.apiGateway -> sistema.clients "Enruta registro, perfil y mantenedor de clientes" "HTTP/JSON + token de servicio"
        sistema.apiGateway -> sistema.payments "Enruta pagos, avisos del proveedor y boletas" "HTTP/JSON + token de servicio"
        sistema.apiGateway -> sistema.analytics "Enruta el reporte de ventas" "HTTP/JSON + token de servicio"
        sistema.apiGateway -> sistema.graphqlGateway "Enruta POST /graphql" "HTTP/GraphQL + token de servicio"
        sistema.apiGateway -> sistema.secretManager "Obtiene sus tokens de servicio" "Docker secrets / Vault"
        sistema.authService -> sistema.secretManager "Obtiene la clave de firma y su credencial de BD" "Docker secrets / Vault"
        sistema.inventory -> sistema.secretManager "Obtiene su credencial de BD" "Docker secrets / Vault"
        sistema.orders -> sistema.secretManager "Obtiene sus credenciales" "Docker secrets / Vault"
        sistema.clients -> sistema.secretManager "Obtiene sus credenciales y claves de cifrado" "Docker secrets / Vault"
        sistema.payments -> sistema.secretManager "Obtiene la clave del comercio y su credencial de BD" "Docker secrets / Vault"
        sistema.analytics -> sistema.secretManager "Obtiene su credencial de BD" "Docker secrets / Vault"
        sistema.graphqlGateway -> sistema.secretManager "Obtiene sus tokens de lectura" "Docker secrets / Vault"
        sistema.orders -> sistema.inventory "Consulta precio y disponibilidad" "HTTP/JSON"
        sistema.orders -> sistema.clients "Obtiene la direccion de entrega" "HTTP/JSON"
        sistema.orders -> sistema.analytics "Publica eventos de venta (outbox)" "HTTP/JSON"
        sistema.payments -> sistema.orders "Obtiene el monto oficial y marca PAGADO" "HTTP/JSON"
        sistema.payments -> sistema.clients "Obtiene el correo del destinatario de la boleta" "HTTP/JSON"
        sistema.payments -> servipag "Crea la transaccion con la clave del comercio" "HTTPS"
        servipag -> sistema.apiGateway "Aviso de pago firmado (R11)" "HTTPS + HMAC"
        sistema.clients -> correo "Envia el enlace de verificacion" "HTTPS"
        sistema.payments -> correo "Envia la boleta (RF8)" "HTTPS"
        sistema.clients -> sistema.authService "Crea y actualiza cuentas de clientes" "HTTP/JSON"
        sistema.authService -> sistema.dbAuth "Lee y escribe cuentas y sesiones" "SQL (usuario propio)"
        sistema.inventory -> sistema.dbInventory "Lee y escribe la carta" "SQL (usuario propio)"
        sistema.orders -> sistema.dbOrders "Lee y escribe pedidos y claves de idempotencia" "SQL (usuario propio)"
        sistema.clients -> sistema.dbClients "Lee y escribe perfiles y direcciones" "SQL (usuario propio)"
        sistema.payments -> sistema.dbPayments "Lee y escribe pagos y boletas" "SQL (usuario propio)"
        sistema.analytics -> sistema.dbAnalytics "Lee y escribe agregados de ventas" "SQL (usuario propio)"
        sistema.graphqlGateway -> sistema.orders "Consulta pedidos y la cola autorizados" "HTTP/JSON"
        sistema.graphqlGateway -> sistema.inventory "Consulta productos (un lote por pedido)" "HTTP/JSON"
        sistema.graphqlGateway -> sistema.payments "Consulta el estado del pago y la boleta" "HTTP/JSON"

        // C3 - API Gateway.
        sistema.frontend -> sistema.apiGateway.httpEntry "Envia solicitudes y descarga paginas" "HTTPS"
        servipag -> sistema.apiGateway.httpEntry "Envia el aviso firmado" "HTTPS + HMAC"
        sistema.apiGateway.httpEntry -> sistema.apiGateway.routeTable "Busca verbo y ruta"
        sistema.apiGateway.httpEntry -> sistema.apiGateway.identityFilter "Solicita verificar identidad y permisos"
        sistema.apiGateway.identityFilter -> sistema.authService "Obtiene la JWKS (en cache 10 min)" "HTTPS/JSON"
        sistema.apiGateway.identityFilter -> sistema.apiGateway.limiter "Entrega la solicitud autorizada o publica"
        sistema.apiGateway.limiter -> sistema.apiGateway.routeDispatcher "Entrega la solicitud dentro de limites"
        sistema.apiGateway.routeDispatcher -> sistema.apiGateway.gwSecrets "Pide el token del destino"
        sistema.apiGateway.gwSecrets -> sistema.secretManager "Lee referencias gw-<servicio>" "Docker secrets / Vault"
        sistema.apiGateway.routeDispatcher -> sistema.authService "Reenvia login, refresh, logout y usuarios" "HTTP/JSON"
        sistema.apiGateway.routeDispatcher -> sistema.inventory "Reenvia operaciones de la carta" "HTTP/JSON"
        sistema.apiGateway.routeDispatcher -> sistema.orders "Reenvia operaciones de pedidos" "HTTP/JSON"
        sistema.apiGateway.routeDispatcher -> sistema.clients "Reenvia operaciones de clientes" "HTTP/JSON"
        sistema.apiGateway.routeDispatcher -> sistema.payments "Reenvia pagos y avisos validados" "HTTP/JSON"
        sistema.apiGateway.routeDispatcher -> sistema.analytics "Reenvia el reporte" "HTTP/JSON"
        sistema.apiGateway.routeDispatcher -> sistema.graphqlGateway "Reenvia operaciones GraphQL registradas" "HTTP/GraphQL"
        sistema.apiGateway.routeDispatcher -> sistema.apiGateway.errorMapper "Informa timeout o destino caido"
        sistema.apiGateway.identityFilter -> sistema.apiGateway.errorMapper "Informa rechazo 401/403"
        sistema.apiGateway.errorMapper -> sistema.frontend "Devuelve error controlado" "HTTPS"

        // C3 - GraphQL Gateway.
        sistema.apiGateway -> sistema.graphqlGateway.graphqlEndpoint "Entrega la operacion y el contexto verificado" "HTTP/GraphQL"
        sistema.graphqlGateway.graphqlEndpoint -> sistema.graphqlGateway.persistedOps "Comprueba que la operacion este registrada"
        sistema.graphqlGateway.persistedOps -> sistema.graphqlGateway.queryValidator "Entrega la operacion registrada"
        sistema.graphqlGateway.queryValidator -> sistema.graphqlGateway.fieldAccess "Entrega una consulta dentro de limites"
        sistema.graphqlGateway.fieldAccess -> sistema.graphqlGateway.resolvers "Autoriza recurso y campos"
        sistema.graphqlGateway.resolvers -> sistema.graphqlGateway.dataLoader "Pide productos por lote"
        sistema.graphqlGateway.resolvers -> sistema.graphqlGateway.serviceConnectors "Pide pedido y pago"
        sistema.graphqlGateway.dataLoader -> sistema.graphqlGateway.serviceConnectors "Pide productos en una llamada"
        sistema.graphqlGateway.serviceConnectors -> sistema.orders "Consulta el pedido o la cola" "HTTP/JSON"
        sistema.graphqlGateway.serviceConnectors -> sistema.inventory "Consulta productos por ids" "HTTP/JSON"
        sistema.graphqlGateway.serviceConnectors -> sistema.payments "Consulta pago y boleta" "HTTP/JSON"
        sistema.graphqlGateway.resolvers -> sistema.graphqlGateway.responseComposer "Entrega datos y errores parciales"
        sistema.graphqlGateway.responseComposer -> sistema.apiGateway "Devuelve data + errors" "HTTP/GraphQL"

        // C3 - Auth Service.
        sistema.apiGateway -> sistema.authService.identityApi "Enruta login, refresh, logout y usuarios; lee la JWKS" "HTTP/JSON"
        sistema.clients -> sistema.authService.identityApi "Crea y actualiza cuentas de clientes" "HTTP/JSON"
        sistema.authService.identityApi -> sistema.authService.credentialsVerifier "Verifica correo y contrasena"
        sistema.authService.credentialsVerifier -> sistema.authService.identityRepo "Lee la cuenta y registra intentos"
        sistema.authService.identityApi -> sistema.authService.sessionManager "Emite, rota o revoca la sesion"
        sistema.authService.sessionManager -> sistema.authService.authSecrets "Pide la clave de firma"
        sistema.authService.sessionManager -> sistema.authService.identityRepo "Guarda el hash del refresh token"
        sistema.authService.identityRepo -> sistema.dbAuth "Lee y escribe cuentas y sesiones" "SQL"
        sistema.authService.authSecrets -> sistema.secretManager "Obtiene auth-jwt-private-key y db-auth" "Docker secrets / Vault"

        // C3 - orders.
        sistema.apiGateway -> sistema.orders.ordersApi "Enruta S06-S09, S17 y S18" "HTTP/JSON"
        sistema.graphqlGateway -> sistema.orders.ordersApi "Consulta pedidos autorizados" "HTTP/JSON"
        sistema.payments -> sistema.orders.ordersApi "Obtiene monto oficial y marca PAGADO" "HTTP/JSON"
        sistema.orders.ordersApi -> sistema.orders.accessPolicy "Comprueba rol y propiedad"
        sistema.orders.accessPolicy -> sistema.orders.orderWorkflow "Encamina lecturas y cambios autorizados"
        sistema.orders.ordersApi -> sistema.orders.idempotency "Busca la clave del intento de compra"
        sistema.orders.idempotency -> sistema.orders.ordersRepo "Busca pedido previo por cliente y clave"
        sistema.orders.idempotency -> sistema.orders.orderWorkflow "Ejecuta solo una solicitud nueva"
        sistema.orders.orderWorkflow -> sistema.orders.clientsAdapter "Obtiene la direccion"
        sistema.orders.orderWorkflow -> sistema.orders.inventoryAdapter "Obtiene precio y disponibilidad"
        sistema.orders.orderWorkflow -> sistema.orders.ordersRepo "Persiste pedido, items, estado y clave"
        sistema.orders.orderWorkflow -> sistema.orders.outbox "Encola el evento de venta"
        sistema.orders.clientsAdapter -> sistema.clients "Invoca /internal/clients/{id}/addresses/{dir}" "HTTP/JSON"
        sistema.orders.inventoryAdapter -> sistema.inventory "Invoca /internal/products?ids=" "HTTP/JSON"
        sistema.orders.outbox -> sistema.analytics "Entrega eventos con reintentos" "HTTP/JSON"
        sistema.orders.ordersRepo -> sistema.dbOrders "Lee y escribe pedidos y claves" "SQL"

        // Respuestas explicitas que se siguen en las vistas dinamicas (relaciones de comunicacion, no resultados de pruebas).
        sistema.dbInventory -> sistema.inventory "Devuelve productos" "SQL"
        sistema.inventory -> sistema.apiGateway "Responde la carta" "HTTP/JSON"
        sistema.apiGateway -> sistema.frontend "Devuelve respuestas y errores controlados" "HTTPS"
        sistema.frontend -> visitante "Presenta la carta o el error"
        sistema.frontend -> cliente "Presenta resultados y errores"
        sistema.authService -> sistema.apiGateway "Entrega la JWKS" "HTTPS/JSON"
        sistema.clients -> sistema.orders "Devuelve la direccion" "HTTP/JSON"
        sistema.inventory -> sistema.orders "Devuelve precios y disponibilidad" "HTTP/JSON"
        sistema.dbOrders -> sistema.orders "Devuelve pedidos y claves registradas" "SQL"
        sistema.orders -> sistema.apiGateway "Responde operaciones de pedidos" "HTTP/JSON"
        sistema.orders -> sistema.payments "Devuelve monto oficial y estado" "HTTP/JSON"
        servipag -> sistema.payments "Devuelve token y URL de pago" "HTTPS"
        sistema.payments -> sistema.apiGateway "Responde pagos y avisos" "HTTP/JSON"
        sistema.apiGateway -> servipag "Responde 200 al aviso" "HTTPS"
        sistema.graphqlGateway -> sistema.apiGateway "Devuelve resultado agregado o error" "HTTP/GraphQL"
        sistema.orders -> sistema.graphqlGateway "Devuelve pedido autorizado" "HTTP/JSON"
        sistema.inventory -> sistema.graphqlGateway "Devuelve productos" "HTTP/JSON"
        sistema.payments -> sistema.graphqlGateway "Devuelve pago y boleta" "HTTP/JSON"
        sistema.graphqlGateway.persistedOps -> sistema.graphqlGateway.graphqlEndpoint "Rechaza operacion no registrada"
        sistema.graphqlGateway.queryValidator -> sistema.graphqlGateway.graphqlEndpoint "Rechaza consulta fuera de limites"
        sistema.graphqlGateway.graphqlEndpoint -> sistema.apiGateway "Responde 400 OPERATION_NOT_ALLOWED" "HTTP/GraphQL"
        sistema.orders.ordersRepo -> sistema.orders.idempotency "Devuelve el pedido ya registrado"
        sistema.orders.idempotency -> sistema.orders.ordersApi "Devuelve el pedido existente sin procesar de nuevo"
        sistema.orders.ordersApi -> sistema.apiGateway "Devuelve respuesta de pedidos" "HTTP/JSON"

        // ENTORNO DE PRUEBAS INTEGRADAS: docker compose (docker-compose.yml).
        pruebas = deploymentEnvironment "Pruebas_Docker" {
            usuario = deploymentNode "Dispositivo del usuario" "Equipo o celular con navegador." "Equipo cliente" {
                tags "ZonaCliente"
                navegador = infrastructureNode "Navegador web" "Ejecuta el JavaScript del frontend; guarda cookies HttpOnly." "Chrome / Edge / Safari"
            }
            host = deploymentNode "Equipo con Docker" "docker compose up -d --build" "Docker Engine" {
                tags "ZonaEntorno"
                edge = deploymentNode "Red edge" "Unica red con puerto publicado (443)." "Red Docker" {
                    tags "ZonaPublica"
                    gw = deploymentNode "gateway" "Puerto publicado 443:8443." "fukusuke/backend:1.0 (node:22-alpine)" {
                        containerInstance sistema.apiGateway
                    }
                    web = deploymentNode "frontend" "Sin puerto propio; se sirve detras del gateway." "php:8.3-apache" {
                        containerInstance sistema.frontend
                    }
                }
                backend = deploymentNode "Red backend" "internal: true; sin entrada ni salida externa." "Red Docker" {
                    tags "ZonaPrivada"
                    servicios = deploymentNode "Microservicios" "Un contenedor por servicio, sin puertos publicados; healthchecks." "fukusuke/backend:1.0" {
                        containerInstance sistema.authService
                        containerInstance sistema.graphqlGateway
                        containerInstance sistema.inventory
                        containerInstance sistema.orders
                        containerInstance sistema.clients
                        containerInstance sistema.payments
                        containerInstance sistema.analytics
                    }
                }
                data = deploymentNode "Red data" "internal: true; solo servicios con credencial propia." "Red Docker" {
                    tags "ZonaDatos"
                    mysql = deploymentNode "mysql" "Un esquema y un usuario por servicio; volumen mysql-data." "mysql:8.0" {
                        containerInstance sistema.dbAuth
                        containerInstance sistema.dbInventory
                        containerInstance sistema.dbOrders
                        containerInstance sistema.dbClients
                        containerInstance sistema.dbPayments
                        containerInstance sistema.dbAnalytics
                    }
                }
                secretos = deploymentNode "Docker secrets" "Montados por servicio en /run/secrets (Vault + AppRole opcional)." "Docker secrets" {
                    tags "ZonaSecretos"
                    containerInstance sistema.secretManager
                }
                proveedores = deploymentNode "Red proveedores" "Salida hacia proveedores; en pruebas, simuladores." "Red Docker" {
                    tags "ZonaExterna"
                    softwareSystemInstance servipag
                    softwareSystemInstance correo
                }
            }
            pruebas.usuario.navegador -> pruebas.host.edge.gw "Abre https://localhost" "HTTPS (TLS)"
        }

        // DESARROLLO LOCAL: Windows + XAMPP, sin Docker (instalar.bat / iniciar.bat).
        // Todos los procesos escuchan solo en 127.0.0.1; la separacion es por credenciales, no por red.
        local = deploymentEnvironment "Desarrollo_Local" {
            pc = deploymentNode "PC del equipo" "Windows con Node.js 22 y XAMPP." "Windows 10/11" {
                tags "ZonaLocal"
                navegadorLocal = infrastructureNode "Navegador" "Abre https://localhost:8443." "Chrome / Edge / Opera"
                gwLocal = deploymentNode "Proceso gateway" "127.0.0.1:8443; sirve la pagina v1.1 de la carpeta web/." "Node.js 22 (scripts/start.js)" {
                    containerInstance sistema.apiGateway
                    containerInstance sistema.frontend
                }
                procesos = deploymentNode "Procesos privados" "auth 8086, inventory 8081, orders 8082, clients 8083, payments 8084, analytics 8085, graphql 4000 (solo 127.0.0.1)." "Node.js 22" {
                    containerInstance sistema.authService
                    containerInstance sistema.graphqlGateway
                    containerInstance sistema.inventory
                    containerInstance sistema.orders
                    containerInstance sistema.clients
                    containerInstance sistema.payments
                    containerInstance sistema.analytics
                }
                xampp = deploymentNode "MariaDB de XAMPP" "127.0.0.1:3306; esquemas fk_* con un usuario por servicio (npm run setup)." "MariaDB 10.4 (XAMPP)" {
                    containerInstance sistema.dbAuth
                    containerInstance sistema.dbInventory
                    containerInstance sistema.dbOrders
                    containerInstance sistema.dbClients
                    containerInstance sistema.dbPayments
                    containerInstance sistema.dbAnalytics
                }
                carpetaSecretos = deploymentNode "Carpeta secrets/" "Generada por npm run setup; ignorada por git." "SecretProvider file" {
                    containerInstance sistema.secretManager
                }
                simuladores = deploymentNode "Simuladores" "Servipag 8090 y bandeja de correo 8025." "Node.js 22 (sandbox/)" {
                    softwareSystemInstance servipag
                    softwareSystemInstance correo
                }
            }
            local.pc.navegadorLocal -> local.pc.gwLocal "Abre https://localhost:8443" "HTTPS (certificado de desarrollo)"
        }
    }

    views {
        systemContext sistema "C1_Contexto" "Actores y proveedores externos de Fukusuke." {
            title "C1 - Contexto de Fukusuke Sushi-Delivery"
            include *
            autoLayout lr
        }

        container sistema "C2_Contenedores" "Aplicaciones, gateways, microservicios privados y bases de datos." {
            title "C2 - Contenedores de Fukusuke"
            include *
            autoLayout lr
        }

        container sistema "C2_Catalogo" "Recorrido estructural de la carta." {
            include visitante sistema.frontend sistema.apiGateway sistema.authService sistema.inventory sistema.dbInventory
            autoLayout lr
        }

        container sistema "C2_Pedidos_Pagos" "Recorrido estructural de pedido, pago y boleta." {
            include cliente sistema.frontend sistema.apiGateway sistema.authService sistema.orders sistema.inventory sistema.clients sistema.payments sistema.dbOrders sistema.dbPayments servipag correo
            autoLayout lr
        }

        component sistema.apiGateway "C3_API_Gateway" "Componentes internos del punto de entrada HTTPS." {
            title "C3 - API Gateway"
            include *
            autoLayout lr
        }

        component sistema.graphqlGateway "C3_GraphQL" "Operaciones registradas, limites, autorizacion y agregacion." {
            title "C3 - GraphQL Gateway"
            include *
            autoLayout lr
        }

        component sistema.authService "C3_Auth_Service" "Credenciales, sesiones y secretos de firma." {
            title "C3 - Auth Service"
            include *
            autoLayout lr
        }

        component sistema.orders "C3_Orders" "Autorizacion, idempotencia, reglas y persistencia de pedidos." {
            title "C3 - orders"
            include *
            autoLayout lr
        }

        // VISTAS DINAMICAS (cada una corresponde a una prueba automatizada).

        dynamic sistema "D_F01_Exito" "Prueba V1: carta publica, solo campos publicos." {
            title "F01 - Consulta de carta: exito (V1)"
            1: visitante -> sistema.frontend "Abre la carta (P02)"
            2: sistema.frontend -> sistema.apiGateway "GET /api/v1/products (R01)" "HTTPS"
            3: sistema.apiGateway -> sistema.inventory "GET /products con token de servicio" "HTTP/JSON"
            4: sistema.inventory -> sistema.dbInventory "Busca productos habilitados" "SQL"
            5: sistema.dbInventory -> sistema.inventory "Devuelve productos" "SQL"
            6: sistema.inventory -> sistema.apiGateway "Responde id, nombre, precio, categoria, imagen" "HTTP/JSON"
            7: sistema.apiGateway -> sistema.frontend "Devuelve la carta (cache 60 s)" "HTTPS"
            8: sistema.frontend -> visitante "Muestra los productos"
            autoLayout lr
        }

        dynamic sistema "D_F01_Recuperacion" "Prueba T13: inventory caido -> error controlado sin datos; vuelve al reiniciarlo." {
            title "F01 - Fallo controlado y recuperacion (T13)"
            1: visitante -> sistema.frontend "Abre la carta"
            2: sistema.frontend -> sistema.apiGateway "GET /api/v1/products" "HTTPS"
            3: sistema.apiGateway -> sistema.inventory "Consulta la carta; inventory no responde" "HTTP/JSON"
            4: sistema.apiGateway -> sistema.frontend "503 SERVICE_UNAVAILABLE sin datos" "HTTPS"
            5: sistema.frontend -> visitante "Muestra 'No pudimos cargar la carta' y boton Reintentar"
            6: visitante -> sistema.frontend "Reintenta despues de reiniciar inventory"
            7: sistema.frontend -> sistema.apiGateway "GET /api/v1/products" "HTTPS"
            8: sistema.apiGateway -> sistema.inventory "Consulta la carta" "HTTP/JSON"
            9: sistema.inventory -> sistema.dbInventory "Busca productos" "SQL"
            10: sistema.dbInventory -> sistema.inventory "Devuelve productos" "SQL"
            11: sistema.inventory -> sistema.apiGateway "Responde la carta" "HTTP/JSON"
            12: sistema.apiGateway -> sistema.frontend "200 con los 11 productos" "HTTPS"
            13: sistema.frontend -> visitante "Muestra la carta recuperada"
            autoLayout lr
        }

        dynamic sistema "D_F02_Exito" "Prueba T04: pedido con total calculado en el servidor." {
            title "F02 - Crear pedido: exito (T04)"
            1: cliente -> sistema.frontend "Continuar a pago (P04)"
            2: sistema.frontend -> sistema.apiGateway "POST /api/v1/orders + Idempotency-Key + CSRF (R06)" "HTTPS"
            3: sistema.apiGateway -> sistema.authService "Obtiene la JWKS (si no esta en cache)" "HTTPS/JSON"
            4: sistema.authService -> sistema.apiGateway "Entrega la JWKS" "HTTPS/JSON"
            5: sistema.apiGateway -> sistema.orders "Reenvia con contexto verificado" "HTTP/JSON"
            6: sistema.orders -> sistema.clients "Obtiene la direccion" "HTTP/JSON"
            7: sistema.clients -> sistema.orders "Devuelve la direccion" "HTTP/JSON"
            8: sistema.orders -> sistema.inventory "Consulta precio y disponibilidad" "HTTP/JSON"
            9: sistema.inventory -> sistema.orders "Devuelve precios oficiales" "HTTP/JSON"
            10: sistema.orders -> sistema.dbOrders "Persiste pedido, items y clave" "SQL"
            11: sistema.dbOrders -> sistema.orders "Confirma la escritura" "SQL"
            12: sistema.orders -> sistema.apiGateway "201 PENDIENTE_PAGO con total del servidor" "HTTP/JSON"
            13: sistema.apiGateway -> sistema.frontend "Devuelve el pedido" "HTTPS"
            14: sistema.frontend -> cliente "Muestra el pedido y el total"
            autoLayout lr
        }

        dynamic sistema "D_F02_Pago" "Pruebas T06, V6 y V8: pago idempotente y aviso firmado." {
            title "F02 - Pago Servipag y aviso del proveedor (T06, V6, V8)"
            1: cliente -> sistema.frontend "Paga el pedido (P06)"
            2: sistema.frontend -> sistema.apiGateway "POST /api/v1/payments + Idempotency-Key (R10)" "HTTPS"
            3: sistema.apiGateway -> sistema.payments "Reenvia sin monto del navegador" "HTTP/JSON"
            4: sistema.payments -> sistema.orders "Pide el monto oficial" "HTTP/JSON"
            5: sistema.orders -> sistema.payments "Devuelve total y estado" "HTTP/JSON"
            6: sistema.payments -> servipag "Crea la transaccion" "HTTPS"
            7: servipag -> sistema.payments "Devuelve token y URL" "HTTPS"
            8: sistema.payments -> sistema.apiGateway "201 con URL de pago" "HTTP/JSON"
            9: sistema.apiGateway -> sistema.frontend "Redirige a Servipag" "HTTPS"
            10: servipag -> sistema.apiGateway "Aviso firmado HMAC (R11)" "HTTPS"
            11: sistema.apiGateway -> sistema.payments "Reenvia solo si la firma es valida" "HTTP/JSON"
            12: sistema.payments -> sistema.orders "Marca PAGADO (aviso repetido sin efecto)" "HTTP/JSON"
            13: sistema.payments -> correo "Envia la boleta" "HTTPS"
            14: sistema.payments -> sistema.apiGateway "200" "HTTP/JSON"
            15: sistema.apiGateway -> servipag "200 al proveedor" "HTTPS"
            autoLayout lr
        }

        dynamic sistema "D_F02_Reintento" "Prueba T16: misma Idempotency-Key, mismo pedido." {
            title "F02 - Reintento de pedido sin duplicacion (T16)"
            1: cliente -> sistema.frontend "Reintenta tras una respuesta incierta"
            2: sistema.frontend -> sistema.apiGateway "POST /api/v1/orders con la misma clave" "HTTPS"
            3: sistema.apiGateway -> sistema.orders "Reenvia la solicitud repetida" "HTTP/JSON"
            4: sistema.orders -> sistema.dbOrders "Busca cliente + clave" "SQL"
            5: sistema.dbOrders -> sistema.orders "Devuelve el pedido ya registrado" "SQL"
            6: sistema.orders -> sistema.apiGateway "200 mismo pedidoId (Idempotent-Replayed)" "HTTP/JSON"
            7: sistema.apiGateway -> sistema.frontend "Devuelve el pedido existente" "HTTPS"
            8: sistema.frontend -> cliente "Muestra el mismo pedido"
            autoLayout lr
        }

        dynamic sistema.orders "D_F02_Idempotencia_C3" "Prueba T16 dentro de orders." {
            title "F02 - Idempotencia: componentes de orders (T16)"
            1: sistema.apiGateway -> sistema.orders.ordersApi "POST /orders repetido con Idempotency-Key" "HTTP/JSON"
            2: sistema.orders.ordersApi -> sistema.orders.idempotency "Calcula huella y busca la clave"
            3: sistema.orders.idempotency -> sistema.orders.ordersRepo "Busca pedido de este cliente con la clave"
            4: sistema.orders.ordersRepo -> sistema.dbOrders "SELECT por (cliente_id, idempotency_key)" "SQL"
            5: sistema.orders.ordersRepo -> sistema.orders.idempotency "Devuelve el pedido registrado"
            6: sistema.orders.idempotency -> sistema.orders.ordersApi "Misma huella: devuelve el pedido sin ejecutar el flujo"
            7: sistema.orders.ordersApi -> sistema.apiGateway "200 mismo pedido (otra huella -> 409)" "HTTP/JSON"
            autoLayout lr
        }

        dynamic sistema "D_F03_Propio" "Prueba V4 (dueno): pedido propio." {
            title "F03 - Consulta protegida: pedido propio (V4)"
            1: cliente -> sistema.frontend "Abre su pedido"
            2: sistema.frontend -> sistema.apiGateway "GET /api/v1/orders/{id} (R09)" "HTTPS"
            3: sistema.apiGateway -> sistema.orders "Reenvia con contexto verificado" "HTTP/JSON"
            4: sistema.orders -> sistema.dbOrders "Busca el pedido" "SQL"
            5: sistema.dbOrders -> sistema.orders "Devuelve el pedido" "SQL"
            6: sistema.orders -> sistema.apiGateway "200: el cliente es el dueno" "HTTP/JSON"
            7: sistema.apiGateway -> sistema.frontend "Devuelve el pedido" "HTTPS"
            8: sistema.frontend -> cliente "Muestra estado e items"
            autoLayout lr
        }

        dynamic sistema "D_F03_Ajeno" "Prueba V4 (otro cliente): 404 sin datos." {
            title "F03 - Consulta protegida: pedido ajeno (V4)"
            1: cliente -> sistema.frontend "Intenta abrir el pedido de otro cliente"
            2: sistema.frontend -> sistema.apiGateway "GET /api/v1/orders/{idAjeno}" "HTTPS"
            3: sistema.apiGateway -> sistema.orders "Reenvia con su identidad (sesion valida no implica acceso)" "HTTP/JSON"
            4: sistema.orders -> sistema.dbOrders "Busca el pedido" "SQL"
            5: sistema.dbOrders -> sistema.orders "Devuelve un pedido de otro dueno" "SQL"
            6: sistema.orders -> sistema.apiGateway "404 sin revelar que existe" "HTTP/JSON"
            7: sistema.apiGateway -> sistema.frontend "404 conforme al contrato" "HTTPS"
            8: sistema.frontend -> cliente "Muestra 'pedido no encontrado' sin datos ajenos"
            autoLayout lr
        }

        dynamic sistema "D_F03_Expirada" "Prueba V12: el gateway rechaza antes de llegar a orders." {
            title "F03 - Sesion expirada: rechazo temprano (V12)"
            1: cliente -> sistema.frontend "Consulta un pedido con la sesion vencida"
            2: sistema.frontend -> sistema.apiGateway "GET /api/v1/orders/{id} con JWT vencido" "HTTPS"
            3: sistema.apiGateway -> sistema.frontend "401 TOKEN_EXPIRED; orders no recibe nada" "HTTPS"
            4: sistema.frontend -> cliente "Renueva la sesion o pide iniciar sesion"
            autoLayout lr
        }

        dynamic sistema "D_F04_GraphQL_Exito" "Prueba T08: ResumenPedido combina orders, inventory y payments." {
            title "F04 - GraphQL: ResumenPedido (T08)"
            1: cliente -> sistema.frontend "Abre su boleta (P07)"
            2: sistema.frontend -> sistema.apiGateway "POST /api/v1/graphql operationName=ResumenPedido (R21)" "HTTPS"
            3: sistema.apiGateway -> sistema.graphqlGateway "Entrega la operacion y el contexto verificado" "HTTP/GraphQL"
            4: sistema.graphqlGateway -> sistema.orders "Consulta el pedido (verifica dueno)" "HTTP/JSON"
            5: sistema.orders -> sistema.graphqlGateway "Devuelve el pedido" "HTTP/JSON"
            6: sistema.graphqlGateway -> sistema.inventory "Consulta todos los productos en una llamada" "HTTP/JSON"
            6: sistema.graphqlGateway -> sistema.payments "Consulta pago y boleta" "HTTP/JSON"
            7: sistema.inventory -> sistema.graphqlGateway "Devuelve productos" "HTTP/JSON"
            7: sistema.payments -> sistema.graphqlGateway "Devuelve pago y folio" "HTTP/JSON"
            8: sistema.graphqlGateway -> sistema.apiGateway "Devuelve el resumen agregado" "HTTP/GraphQL"
            9: sistema.apiGateway -> sistema.frontend "Entrega el resultado autorizado" "HTTPS"
            10: sistema.frontend -> cliente "Muestra la boleta con productos y pago"
            autoLayout lr
        }

        dynamic sistema "D_F04_GraphQL_Parcial" "Prueba T13: inventory caido -> producto null + INVENTORY_UNAVAILABLE." {
            title "F04 - GraphQL: dependencia caida (T13)"
            1: cliente -> sistema.frontend "Abre su boleta"
            2: sistema.frontend -> sistema.apiGateway "POST /api/v1/graphql ResumenPedido" "HTTPS"
            3: sistema.apiGateway -> sistema.graphqlGateway "Entrega la operacion" "HTTP/GraphQL"
            4: sistema.graphqlGateway -> sistema.orders "Consulta el pedido" "HTTP/JSON"
            5: sistema.orders -> sistema.graphqlGateway "Devuelve el pedido" "HTTP/JSON"
            6: sistema.graphqlGateway -> sistema.inventory "Consulta productos; inventory no responde" "HTTP/JSON"
            7: sistema.graphqlGateway -> sistema.apiGateway "data con producto null + errors INVENTORY_UNAVAILABLE" "HTTP/GraphQL"
            8: sistema.apiGateway -> sistema.frontend "Transmite el resultado parcial identificado" "HTTPS"
            9: sistema.frontend -> cliente "Muestra el pedido y avisa que faltan datos"
            autoLayout lr
        }

        dynamic sistema.graphqlGateway "D_F04_GraphQL_Limite_C3" "Prueba V7: consulta no registrada, introspeccion o fuera de limites." {
            title "F04 - GraphQL: consulta rechazada antes de los resolvers (V7)"
            1: sistema.apiGateway -> sistema.graphqlGateway.graphqlEndpoint "Envia consulta libre o excesiva" "HTTP/GraphQL"
            2: sistema.graphqlGateway.graphqlEndpoint -> sistema.graphqlGateway.persistedOps "Busca la operacion registrada"
            3: sistema.graphqlGateway.persistedOps -> sistema.graphqlGateway.graphqlEndpoint "Rechaza operacion no registrada"
            4: sistema.graphqlGateway.graphqlEndpoint -> sistema.apiGateway "400 OPERATION_NOT_ALLOWED sin llamar a resolvers" "HTTP/GraphQL"
            autoLayout lr
        }

        // VISTAS DE DESPLIEGUE.
        deployment sistema pruebas "DEP_Pruebas_Docker" "docker compose: redes edge, backend, data y proveedores." {
            title "Despliegue - Pruebas integradas (docker compose)"
            include *
            autoLayout lr
        }

        deployment sistema local "DEP_Local_XAMPP" "Windows + XAMPP: como se ejecuta en el PC del equipo." {
            title "Despliegue - Desarrollo local (Windows + XAMPP)"
            include *
            autoLayout lr
        }

        styles {
            element "Deployment Node" {
                background #F2F2F2
                color #000000
                stroke #7F7F7F
            }
            element "Infrastructure Node" {
                shape roundedbox
                background #FFFFFF
                color #000000
            }
            element "ZonaCliente" {
                background #FFFFFF
            }
            element "ZonaEntorno" {
                background #FAFAFA
            }
            element "ZonaPublica" {
                background #EDEDED
            }
            element "ZonaPrivada" {
                background #F7F7F7
            }
            element "ZonaDatos" {
                background #E8E8E8
            }
            element "ZonaSecretos" {
                background #E0E0E0
            }
            element "ZonaExterna" {
                background #FFFFFF
                stroke #A0A0A0
            }
            element "ZonaLocal" {
                background #F5F5F5
            }
            element "Person" {
                shape person
                background #404040
                color #FFFFFF
            }
            element "Software System" {
                shape roundedbox
                background #595959
                color #FFFFFF
            }
            element "SistemaEvaluado" {
                background #000000
                color #FFFFFF
            }
            element "SistemaExterno" {
                background #FFFFFF
                color #000000
                stroke #7F7F7F
            }
            element "Container" {
                shape roundedbox
                background #E5E5E5
                color #000000
            }
            element "Frontend" {
                shape webbrowser
                background #FFFFFF
                color #000000
            }
            element "Gateway" {
                background #262626
                color #FFFFFF
            }
            element "Seguridad" {
                background #7F7F7F
                color #FFFFFF
            }
            element "Privado" {
                background #D9D9D9
                color #000000
            }
            element "Analitica" {
                background #FFFFFF
                color #000000
            }
            element "BaseDatos" {
                shape cylinder
                background #EFEFEF
                color #000000
            }
            element "Component" {
                shape roundedbox
                background #F2F2F2
                color #000000
            }
            element "EntradaC3" {
                background #D9D9D9
            }
            element "ControlC3" {
                background #BFBFBF
            }
            element "AplicacionC3" {
                background #EDEDED
            }
            element "IntegracionC3" {
                background #FFFFFF
            }
            element "PersistenciaC3" {
                background #E0E0E0
            }
            element "ErrorC3" {
                background #F7F7F7
                stroke #000000
            }
            relationship "Relationship" {
                color #404040
                thickness 2
            }
        }
    }
}
