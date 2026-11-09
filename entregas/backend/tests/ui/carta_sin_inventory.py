"""Captura C21 (flujo F01, recuperación): con inventory detenido la carta muestra un error sin datos
inventados y el botón Reintentar; al reiniciar inventory la carta vuelve.
Uso (con el sistema levantado):  python3 tests/ui/carta_sin_inventory.py
"""
import os
import subprocess
import sys
import time
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BASE = os.environ.get("BASE_URL", "https://localhost:8443")
OUT = os.path.join(RAIZ, "tests", "resultados", "capturas")
os.makedirs(OUT, exist_ok=True)


def abrir_carta(browser):
    ctx = browser.new_context(ignore_https_errors=True, viewport={"width": 1280, "height": 720})
    pg = ctx.new_page()
    pg.goto(f"{BASE}/menu.php?categoria=rolls")
    return pg


pid = int(open(os.path.join(RAIZ, ".run", "pids", "inventory.pid")).read())
os.kill(pid, 15)
time.sleep(62)  # deja vencer la caché de 60 s que el gateway aplica a la carta anónima
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = abrir_carta(b)
        pg.wait_for_selector("text=No pudimos cargar la carta", timeout=15000)
        pg.screenshot(path=os.path.join(OUT, "21_carta_sin_inventory.png"))
        sin_datos = pg.locator(".tarjeta-producto").count() == 0
        b.close()
finally:
    subprocess.run(["node", os.path.join(RAIZ, "scripts", "start.js"), "--solo", "inventory"],
                   cwd=RAIZ, capture_output=True)
    time.sleep(1.5)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = abrir_carta(b)
    pg.wait_for_selector(".tarjeta-producto", timeout=15000)
    recuperada = pg.locator(".tarjeta-producto").count()
    b.close()

print(f"{'OK' if sin_datos and recuperada else 'FALLA'} carta sin inventory: mensaje y 0 productos; tras reiniciar: {recuperada} productos (rolls)")
