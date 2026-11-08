"""Prueba de interfaz T12: recorrido completo en el frontend real contra el backend (Playwright).
Genera capturas en tests/resultados/capturas/. Uso: python3 tests/ui/flujo_ui.py
"""
import json
import os
import re
import sys
import time
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "https://localhost:8443")
MAIL = os.environ.get("MAIL_URL", "http://localhost:8025")
RAIZ = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(RAIZ, "tests", "resultados", "capturas")
os.makedirs(OUT, exist_ok=True)
secreto = lambda ref: open(os.path.join(RAIZ, "secrets", ref)).read().strip()


def run_valido(n):
    cuerpo = str(n)
    suma, mult = 0, 2
    for d in reversed(cuerpo):
        suma += int(d) * mult
        mult = 2 if mult == 7 else mult + 1
    r = 11 - (suma % 11)
    dv = "0" if r == 11 else "K" if r == 10 else str(r)
    return f"{cuerpo[:-6]}.{cuerpo[-6:-3]}.{cuerpo[-3:]}-{dv}"


resultado = {"pasos": [], "errores_consola": [], "red_boleta": []}


def paso(nombre, ok=True, detalle=""):
    resultado["pasos"].append({"paso": nombre, "ok": ok, "detalle": detalle})
    print(("OK " if ok else "XX ") + nombre + (f" — {detalle}" if detalle else ""))


def captura(page, nombre, full=False):
    page.screenshot(path=os.path.join(OUT, nombre), full_page=full)


def nuevo_contexto(browser, movil=False):
    if movil:
        ctx = browser.new_context(ignore_https_errors=True, viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    else:
        ctx = browser.new_context(ignore_https_errors=True, viewport={"width": 1280, "height": 860})
    page = ctx.new_page()
    page.on("dialog", lambda d: d.accept("Me equivoqué de bebida") if d.type == "prompt" else d.accept())
    page.on("console", lambda m: resultado["errores_consola"].append(m.text) if m.type == "error" else None)
    return ctx, page


def login(page, email, password):
    page.goto(f"{BASE}/registro.php")
    page.fill("#login-email", email)
    page.fill("#login-password", password)
    page.click("#tab-login button.btn-principal")
    page.wait_for_load_state("networkidle")


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx, page = nuevo_contexto(browser)

    # 1-2. Inicio y carta servidos por el gateway, carta desde S01
    page.goto(f"{BASE}/index.php")
    page.wait_for_selector("#destacados .tarjeta-producto")
    captura(page, "01_inicio.png")
    page.goto(f"{BASE}/menu.php")
    page.wait_for_selector("#lista-productos .tarjeta-producto")
    n = page.locator("#lista-productos .tarjeta-producto").count()
    captura(page, "02_carta.png")
    paso("Carta cargada desde S01", n >= 10, f"{n} productos")

    # 3-5. Registro, correo de verificación (sandbox) y activación
    email = f"ui.{int(time.time())}@example.com"
    page.goto(f"{BASE}/registro.php")
    page.click("button[data-bs-target='#tab-registro']")
    page.fill("#reg-run", run_valido(40000000 + int(time.time()) % 9000000))
    page.fill("#reg-nombre", "Valentina Soto")
    page.fill("#reg-direccion", "Av. Pajaritos 2450")
    page.fill("#reg-nacimiento", "1998-07-15")
    page.select_option("#reg-sexo", "F")
    page.fill("#correo-registro", email)
    page.fill("#reg-telefono", "+56 9 8765 4321")
    page.fill("#reg-password", "ClaveSegura2026")
    page.click("#tab-registro button.btn-principal")
    page.wait_for_selector("#mensaje-validacion:has-text('Te enviamos un correo')")
    captura(page, "03_registro.png")
    paso("Registro S03 desde registro.php", True, email)

    time.sleep(0.8)
    page.goto(MAIL + "/")
    captura(page, "04_correo_sandbox.png")
    enlace = page.locator(f"div:has-text('{email}') a").first.get_attribute("href")
    page.goto(enlace)
    page.wait_for_selector("#panel-verificacion:has-text('Correo confirmado')")
    captura(page, "05_correo_confirmado.png")
    paso("Verificación de correo S04 (RF11)", True)

    # 6. Login y armado del carrito
    login(page, email, "ClaveSegura2026")
    paso("Login S05 (cookie HttpOnly)", "menu.php" in page.url, page.url)
    page.wait_for_selector("#lista-productos .tarjeta-producto")
    page.click(".tarjeta-producto:has-text('California Roll') .btn-agregar")
    page.click(".tarjeta-producto:has-text('California Roll') .btn-agregar")
    page.click(".tarjeta-producto:has-text('Bebida Lata') .btn-agregar")
    page.goto(f"{BASE}/carrito.php")
    page.wait_for_selector("#lista-carrito .item-carrito")
    page.wait_for_selector("#direccion-entrega")
    captura(page, "06_carrito_borrador.png")

    # 7-8. Pedido creado en el servidor (S06) y anulación con motivo (S08)
    page.click("#btn-continuar")
    page.wait_for_selector("#lista-carrito:has-text('Pedido N°')")
    captura(page, "07_pedido_servidor.png")
    total_servidor = page.inner_text("#total-carrito")
    page.click(".item-carrito:has-text('Bebida Lata') .btn-anular")
    page.wait_for_selector(".item-anulado:has-text('Anulado: Me equivoqué de bebida')")
    captura(page, "08_anulacion_motivo.png")
    paso("Pedido S06 y anulación con motivo S08 (RF3)", True, f"total servidor {total_servidor}")

    # 9-11. Pago Servipag (sandbox) y boleta
    page.click("#btn-continuar")
    page.wait_for_url(re.compile(r".*/pago\.php"))
    page.wait_for_function("document.getElementById('total-pago').textContent !== '$0'")
    page.click(".opcion-pago:has-text('Servipag')")
    captura(page, "09_pago.png")
    page.click("button:has-text('Confirmar pago')")
    page.wait_for_url(re.compile(r".*localhost:8090/pagar/.*"))
    captura(page, "10_servipag_sandbox.png")
    red = []
    page.on("response", lambda r: red.append({"metodo": r.request.method, "url": r.url.replace(BASE, ""), "status": r.status})
            if "/api/v1/" in r.url else None)
    page.click("button:has-text('Pagar')")
    page.wait_for_url(re.compile(r".*/boleta\.php.*"))
    page.wait_for_selector("#sello-boleta:has-text('Pago confirmado')", timeout=20000)
    page.wait_for_selector("#emision-boleta:has-text('Cajero Virtual')")
    captura(page, "11_boleta.png", full=True)
    folio = page.inner_text("#folio-boleta")
    url_boleta = page.url
    resultado["red_boleta"] = red
    paso("Pago Servipag sandbox → boleta (G01 + S13)", True, folio)

    # 13. Panel de despacho (G02 + S18)
    ctx2, p2 = nuevo_contexto(browser)
    login(p2, "despacho@fukusuke.cl", secreto("seed-despacho-password"))
    p2.wait_for_selector(".tarjeta-despacho")
    captura(p2, "13_despacho.png")
    paso("Panel de despacho P10 (G02)", "despacho.php" in p2.url, f"{p2.locator('.tarjeta-despacho').count()} pedidos en cola")

    # 14-16. Panel de administración
    ctx3, p3 = nuevo_contexto(browser)
    login(p3, "admin@fukusuke.cl", secreto("seed-admin-password"))
    p3.wait_for_selector("#tabla-productos tr")
    captura(p3, "14_admin_productos.png")
    p3.click("button[data-bs-target='#tab-depositos']")
    p3.wait_for_selector("#tab-depositos.show.active")
    p3.wait_for_timeout(700)
    captura(p3, "15_admin_depositos.png")
    p3.click("button[data-bs-target='#tab-reporte']")
    p3.wait_for_selector("#tab-reporte.show.active #reporte .barra-reporte")
    p3.wait_for_timeout(700)
    captura(p3, "16_admin_reporte.png")
    paso("Panel de administración P11 (S01 todos, S21, S19)", True)

    # 17-18. Vista móvil (RF15)
    ctx4, p4 = nuevo_contexto(browser, movil=True)
    p4.goto(f"{BASE}/menu.php")
    p4.wait_for_selector("#lista-productos .tarjeta-producto")
    captura(p4, "17_movil_carta.png")
    login(p4, email, "ClaveSegura2026")
    p4.goto(url_boleta)
    p4.wait_for_selector("#sello-boleta:has-text('Pago confirmado')", timeout=20000)
    captura(p4, "18_movil_boleta.png", full=True)
    paso("Vista móvil 390 px (RF15) con APIs reales", True)

    browser.close()

resultado["errores_consola"] = [e for e in resultado["errores_consola"] if "favicon" not in e]
json.dump(resultado, open(os.path.join(OUT, "..", "ui.json"), "w"), ensure_ascii=False, indent=2)
print("errores de consola:", resultado["errores_consola"])
sys.exit(0 if all(x["ok"] for x in resultado["pasos"]) else 1)
