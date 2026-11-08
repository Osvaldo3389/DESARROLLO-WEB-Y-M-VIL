// Cliente de la API de Fukusuke (todas las llamadas pasan por el API Gateway, mismo origen).
// La sesión vive en cookies HttpOnly (el JavaScript no puede leer los tokens).
// Este archivo solo guarda en sessionStorage el nombre y el rol para pintar el menú.
const Api = (() => {
    const BASE = "/api/v1";
    const CATEGORIAS = { rolls: "Rolls", temaki: "Temaki", sashimi: "Sashimi", combos: "Combos", entradas: "Entradas", bebidas: "Bebidas" };

    const leerCookie = (n) => {
        const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"));
        return m ? m[1] : "";
    };

    async function pedir(method, ruta, body, headers = {}, reintentar = true) {
        const h = { ...headers };
        if (body !== undefined) h["Content-Type"] = "application/json";
        if (method !== "GET") h["X-CSRF-Token"] = leerCookie("fk_csrf");
        const r = await fetch(BASE + ruta, {
            method, headers: h, credentials: "same-origin",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try { data = await r.json(); } catch (e) { data = null; }
        if (r.status === 401 && reintentar && data && data.error && data.error.code === "TOKEN_EXPIRED") {
            const rr = await fetch(BASE + "/auth/refresh", { method: "POST", credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": leerCookie("fk_csrf") }, body: "{}" });
            if (rr.ok) return pedir(method, ruta, body, headers, false);
            Sesion.limpiar();
        }
        if (!r.ok) {
            const e = new Error((data && data.error && data.error.message) || ("Error " + r.status));
            e.status = r.status;
            e.code = data && data.error && data.error.code;
            e.data = data;
            throw e;
        }
        return data;
    }

    // Carta desde el backend (S01) con la misma forma que usaba datos-productos.js
    async function cargarCarta() {
        const r = await pedir("GET", "/products?size=50");
        return r.items.map((p) => ({
            id: p.id, nombre: p.nombre, precio: p.precio, categoria: p.categoria,
            categoriaNombre: CATEGORIAS[p.categoria] || p.categoria, piezas: p.formato, imagen: p.imagen, descripcion: p.descripcion,
        }));
    }

    const graphql = (operationName, variables) => pedir("POST", "/graphql", { operationName, variables });
    const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

    return { pedir, cargarCarta, graphql, uuid, CATEGORIAS };
})();

const Sesion = {
    actual() {
        try { return JSON.parse(sessionStorage.getItem("fukusukeSesion")); } catch (e) { return null; }
    },
    guardar(s) { sessionStorage.setItem("fukusukeSesion", JSON.stringify({ nombre: s.nombre, rol: s.rol })); },
    limpiar() { sessionStorage.removeItem("fukusukeSesion"); sessionStorage.removeItem("fukusukePedido"); },
    async iniciar(email, password) {
        const s = await Api.pedir("POST", "/auth/login", { email, password });
        this.guardar(s);
        return s;
    },
    async cerrar() {
        try { await Api.pedir("POST", "/auth/logout", {}); } catch (e) { /* sin sesión */ }
        this.limpiar();
        window.location = "index.php";
    },
    destinoPorRol(rol) {
        return { ADMIN: "admin.php", DUENO: "admin.php#reporte", DESPACHO: "despacho.php" }[rol] || "menu.php";
    },
};

const escapar = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Menú: muestra el nombre y el acceso del rol cuando hay sesión
document.addEventListener("DOMContentLoaded", () => {
    const s = Sesion.actual();
    const boton = document.querySelector(".boton-ingresar");
    if (!s || !boton) return;
    boton.textContent = "Salir (" + s.nombre.split(" ")[0] + ")";
    boton.href = "#";
    boton.addEventListener("click", (e) => { e.preventDefault(); Sesion.cerrar(); });
    if (s.rol !== "CLIENTE") {
        const li = document.createElement("li");
        li.className = "nav-item";
        li.innerHTML = s.rol === "DESPACHO"
            ? '<a class="nav-link" href="despacho.php">Despacho</a>'
            : '<a class="nav-link" href="admin.php">Panel</a>';
        boton.parentElement.parentElement.insertBefore(li, boton.parentElement);
    }
});
