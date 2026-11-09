# Fukusuke Sushi-Delivery (Caso 19) — Entregas

Equipo: **Osvaldo Caraccioli · Benjamín Orellana** — Desarrollo web y móvil, UNAB.

| Carpeta | Evaluación | Qué contiene |
|---|---|---|
| [`frontend/`](frontend/) | Evaluación 1 | Frontend responsivo tal como se entregó (PHP + Bootstrap, carrito en el navegador). Funciona solo: copiar a `htdocs` de XAMPP y abrir `index.php`. |
| [`backend/`](backend/) | Evaluación 2 | Backend seguro: API Gateway, Auth Service, GraphQL Gateway, microservicios inventory, orders, clients, payments y analytics, base de datos, scripts y pruebas. |
| [`backend/docs/`](backend/docs/) | Evaluación 2 | Informe (`Fukusuke_Evaluacion2_Backend.docx`), diagramas editables (`Fukusuke_Diagramas.drawio`) y modelo C4 (`Fukusuke.dsl`). |
| [`backend/web/`](backend/web/) | Evaluación 2 | La misma página en versión v1.1, conectada a la API (la sirve el gateway en https://localhost:8443). |
| [`backend/tests/resultados/`](backend/tests/resultados/) | Evaluación 2 | Resultados: `npm test` 25/25, prueba de carga k6 y capturas. |

**Datos:** el backend usa los datos del frontend de la Evaluación 1 (la carta: los mismos 11 productos y precios)
y las cuentas del personal. Los datos ficticios de prueba se cargan aparte con `npm run seed:demo`.

**Ejecutar el backend en Windows** (Node.js 20+ y MySQL de XAMPP encendido):
`backend\instalar.bat` (una vez) y luego `backend\iniciar.bat` → https://localhost:8443.
Detalle en [`backend/README.md`](backend/README.md).
