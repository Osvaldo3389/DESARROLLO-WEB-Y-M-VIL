// Las imágenes son fotografías reales (libres de uso, obtenidas de Wikimedia Commons)
// guardadas localmente en la carpeta img/ para que el sitio funcione sin conexión a internet.
const productos = [
    {
        id: 1,
        nombre: "California Roll",
        precio: 5990,
        categoria: "rolls",
        categoriaNombre: "Rolls",
        piezas: "8 piezas",
        emoji: "🍣",
        imagen: "img/california-roll.jpg",
        descripcion:
            "Roll clásico relleno de kanikama, palta y pepino, cubierto con sésamo tostado. Disponible con o sin salsa acevichada."
    },
    {
        id: 2,
        nombre: "Ebi Tempura Roll",
        precio: 7490,
        categoria: "rolls",
        categoriaNombre: "Rolls",
        piezas: "8 piezas",
        emoji: "🍤",
        imagen: "img/ebi-tempura.png",
        descripcion:
            "Roll frito relleno de camarón tempura y palta, cubierto con salsa acevichada y ciboulette."
    },
    {
        id: 3,
        nombre: "Sashimi Salmón",
        precio: 8990,
        categoria: "sashimi",
        categoriaNombre: "Sashimi",
        piezas: "10 láminas",
        emoji: "🐟",
        imagen: "img/sashimi-salmon.jpg",
        descripcion:
            "Finas láminas de salmón fresco, cortadas al momento. Se sirve con jengibre encurtido y salsa de soya."
    },
    {
        id: 4,
        nombre: "Temaki Salmón",
        precio: 4990,
        categoria: "temaki",
        categoriaNombre: "Temaki",
        piezas: "1 unidad",
        emoji: "🍙",
        imagen: "img/temaki-salmon.jpg",
        descripcion:
            "Cono de alga nori relleno de arroz, salmón, palta y cebollín. Ideal para llevar."
    },
    {
        id: 5,
        nombre: "Combo Fukusuke 30 piezas",
        precio: 15990,
        categoria: "combos",
        categoriaNombre: "Combos",
        piezas: "30 piezas",
        emoji: "🍱",
        imagen: "img/combo-fukusuke.jpg",
        descripcion:
            "Selección de nuestros rolls más pedidos: California, Ebi Tempura y Acevichado. Ideal para compartir."
    },
    {
        id: 6,
        nombre: "Gyozas de Cerdo",
        precio: 4490,
        categoria: "entradas",
        categoriaNombre: "Entradas",
        piezas: "6 unidades",
        emoji: "🥟",
        imagen: "img/gyozas.jpg",
        descripcion:
            "Empanaditas japonesas rellenas de cerdo y vegetales, selladas a la plancha y servidas con salsa ponzu."
    },
    {
        id: 7,
        nombre: "Roll Acevichado",
        precio: 6990,
        categoria: "rolls",
        categoriaNombre: "Rolls",
        piezas: "8 piezas",
        emoji: "🍣",
        imagen: "img/roll-acevichado.jpg",
        descripcion:
            "Roll relleno de camarón y palta, bañado en salsa acevichada picante y cebollín."
    },
    {
        id: 8,
        nombre: "Bebida Lata 350cc",
        precio: 1490,
        categoria: "bebidas",
        categoriaNombre: "Bebidas",
        piezas: "350cc",
        emoji: "🥤",
        imagen: "img/bebida-lata.jpg",
        descripcion:
            "Bebida a elección (línea Cola, Naranja o Lima-Limón) para acompañar tu pedido."
    },
    {
        id: 9,
        nombre: "Jugo Natural",
        precio: 1990,
        categoria: "bebidas",
        categoriaNombre: "Bebidas",
        piezas: "300cc",
        emoji: "🧃",
        imagen: "img/jugo-natural.jpg",
        descripcion:
            "Jugo de naranja natural, exprimido al momento. Sin azúcar añadida."
    },
    {
        id: 10,
        nombre: "Agua Mineral",
        precio: 1490,
        categoria: "bebidas",
        categoriaNombre: "Bebidas",
        piezas: "500cc",
        emoji: "💧",
        imagen: "img/agua-mineral.jpg",
        descripcion:
            "Agua mineral con o sin gas, ideal para acompañar sushi."
    },
    {
        id: 11,
        nombre: "Bebida Botella 1 L",
        precio: 2490,
        categoria: "bebidas",
        categoriaNombre: "Bebidas",
        piezas: "1 L",
        emoji: "🥤",
        imagen: "img/bebida-1l.png",
        descripcion:
            "Formato botella de 1 litro, ideal para compartir en pedidos familiares."
    }
];
