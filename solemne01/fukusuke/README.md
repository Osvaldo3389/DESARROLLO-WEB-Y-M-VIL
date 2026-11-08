# Fukusuke Sushi-Delivery — Backend seguro + página (Evaluación Unidad 2)

Backend de microservicios para el **Caso 19 (Fukusuke Sushi-Delivery)** integrado al frontend (carpeta `frontend/`).
Equipo: **Osvaldo Caraccioli · Benjamín Orellana** — Desarrollo web y móvil, UNAB.

---

## ▶ Cómo correrlo en tu PC (Windows con XAMPP, sin Docker)

**Necesitas:**

1. **Node.js 20 o superior** → https://nodejs.org (botón "LTS"). Al instalar, deja todo por defecto.
2. **MySQL encendido.** Con XAMPP: abre el *XAMPP Control Panel* y presiona **Start** en **MySQL**
   (Apache NO hace falta). También sirve MySQL 8 instalado aparte.

**Primera vez (una sola vez):** doble clic en **`instalar.bat`**
→ instala las dependencias, crea el archivo `.env`, genera los secretos de desarrollo,
crea las 6 bases de datos con un usuario por servicio y carga **la carta real del local y las cuentas del personal**
(sin clientes ni pedidos inventados: esos se crean usando la página).

**Cada vez que quieras usarlo:** doble clic en **`iniciar.bat`**
→ levanta todo y abre **https://localhost:8443** en el navegador.
Para detenerlo: cierra esa ventana negra o presiona `Ctrl + C`.

> El navegador mostrará *"La conexión no es privada"* porque el certificado HTTPS es de desarrollo.
> Haz clic en **Avanzado → Continuar a localhost**. (Opcional: instala `secrets/tls-ca-cert` como CA de confianza para que no aparezca.)

### Desde la terminal (Windows, macOS o Linux)

```bash
npm install
npm run setup        # .env + secretos + bases de datos + carta y cuentas del local (sin datos ficticios)
npm start            # página + API en https://localhost:8443  (Ctrl+C para detener)
```

| Qué | Dónde |
|---|---|
| **Página de Fukusuke** (frontend + API) | https://localhost:8443 |
| Bandeja de correos de prueba (verificación de cuenta, boletas) | http://localhost:8025 |
| Pasarela Servipag de prueba (aprobar / rechazar pagos) | http://localhost:8090 |
| Logs de cada servicio | carpeta `.run/logs/` |

**Cuentas del local:** `admin@fukusuke.cl` (panel admin), `despacho@fukusuke.cl` (panel de despacho) y
`dueno@fukusuke.cl` (reporte de ventas). Sus contraseñas se generan al instalar y están en la carpeta `secrets/`
(archivos `seed-admin-password`, `seed-despacho-password`, `seed-dueno-password`).
**Clientes:** se registran desde la página (Registro); el correo de verificación llega a la bandeja http://localhost:8025.

### Si algo falla

| Mensaje | Solución |
|---|---|
| `No se pudo conectar a MySQL en 127.0.0.1:3306` | Enciende MySQL en XAMPP. Si usa otro puerto, cámbialo en `DB_PORT` del archivo `.env`. |
| `MySQL rechazó al usuario "root"` | Tu MySQL tiene contraseña: escríbela en `DB_ROOT_PASSWORD` del archivo `.env` y vuelve a correr `npm run setup`. |
| `Puertos ocupados: 8443 ...` | Ya está corriendo en otra ventana (ciérrala o `npm stop`). Si es otro programa, cambia `GATEWAY_PORT` en `.env`. |
| `"node" no se reconoce como comando` | Instala Node.js (LTS) y abre una ventana nueva. |
| Quiero borrar los datos y empezar de cero | `npm run setup:reset` (borra TODO: pedidos, clientes y cambios en la carta) |

> **Importante:** abre la página por **https://localhost:8443**, no desde `htdocs` de XAMPP: el gateway sirve
> la página y la API desde el mismo origen (cookies seguras, anti-CSRF).

---

## Arquitectura

| Componente | Puerto | Naturaleza | Base de datos |
|---|---|---|---|
| `gateway` (API Gateway HTTPS; también sirve la página) | 8443 (Docker: **443**) | Borde | — |
| `auth` (Auth Service, JWT RS256 + JWKS) | 8086 | Seguridad | `fk_auth` |
| `inventory` | 8081 | Transaccional | `fk_inventory` |
| `orders` | 8082 | Transaccional | `fk_orders` |
| `clients` | 8083 | Transaccional | `fk_clients` |
| `payments` (cajero virtual y boletas) | 8084 | Transaccional | `fk_payments` |
| `analytics` | 8085 | Analítica | `fk_analytics` |
| `graphql` (GraphQL Gateway privado) | 4000 | Agregación | — |
| `servipag-sandbox`, `mail-sandbox` | 8090, 8025 | **Simuladores de proveedores externos** | — |

* En tu PC todos los servicios escuchan solo en `127.0.0.1`; en Docker los microservicios están en la red `backend` (`internal: true`), MySQL en `data` y solo el gateway publica un puerto.
* Cada servicio tiene **su esquema y su usuario de MySQL** (solo SELECT/INSERT/UPDATE/DELETE sobre su esquema) y recibe **solo los secretos que necesita**. La cuenta root solo la usa `npm run setup`.
* Rutas públicas: lista explícita R01–R23 en `gateway/routes.js` (todo lo demás responde 404/405).
* Compatible con **MySQL 8** y **MariaDB 10.4+** (la de XAMPP).

## Puesta en marcha con Docker (opcional)

Requisitos: Docker Desktop y Node.js 20+ (solo para generar los secretos).

```bash
npm install
npm run secrets                                  # crea ./secrets (ignorada por git): tokens, claves, TLS de desarrollo
docker compose up -d --build                     # mysql → db-init → servicios → gateway (+ frontend en Apache/PHP)
docker compose --profile tools run --rm seed     # carta y cuentas del local (agregar "node scripts/seed.js --demo" para datos ficticios)
```

Abrir **https://localhost**. Detener: `docker compose down` (agregar `-v` para borrar la base de datos).

## Pruebas

Las pruebas automáticas usan **datos ficticios de prueba** (lo que pide la pauta: 201 clientes inventados y
1.000 pedidos históricos), separados de la base real. Úsalos en una base de pruebas, no en la que usas con datos reales:

```bash
npm run seed:demo    # carga los datos ficticios de prueba (una vez)
npm run start:bg     # levanta todo en segundo plano
npm test             # integración + seguridad (T01–T13, V1–V10) → tests/resultados/resultados.json
npm stop
```

Opcionales: `python tests/ui/flujo_ui.py` (recorrido en el navegador con Playwright) y
`k6 run tests/load/fukusuke.js` (carga; ver encabezado del archivo).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run setup` | Crea `.env`, secretos, bases de datos/usuarios, carta y cuentas del local (no borra datos existentes) |
| `npm run setup:reset` | Igual, pero borra todos los datos antes |
| `npm run seed:demo` | Agrega los datos ficticios de prueba (para `npm test`, prueba de carga e informe) |
| `npm start` / `npm run start:bg` / `npm stop` | Levantar en primer plano / en segundo plano / detener |
| `node scripts/start.js --solo <servicio>` | (Re)iniciar un solo servicio (ej. `inventory`) |
| `npm test` | Pruebas de integración y seguridad |

## Secretos

Los servicios piden secretos **por referencia** a un `SecretProvider`:

* `SECRET_PROVIDER=file` (por defecto): carpeta `./secrets` en tu PC, o Docker secrets en `/run/secrets/<referencia>` (cada contenedor recibe solo los suyos).
* `SECRET_PROVIDER=vault`: HashiCorp Vault (KV v2 + AppRole por servicio). Opcional: `docker compose -f docker-compose.yml -f docker-compose.vault.yml up -d` y luego `scripts/vault-init.sh`.

La carpeta `secrets/` y el archivo `.env` están en `.gitignore`: **nunca se suben al repositorio**. Cada equipo genera los suyos con `npm run setup`.
Rotación: regenerar el archivo (o la versión en Vault) y reiniciar solo el servicio consumidor.
