"""
Servicio FastAPI con CRUD completo contra MongoDB.

Endpoints:
    GET    /productos        -> consultar todos
    GET    /productos/{id}   -> consultar por id
    POST   /productos        -> insertar
    PUT    /productos/{id}   -> actualizar
    DELETE /productos/{id}   -> eliminar

Para correrlo:
    pip install -r requirements.txt
    uvicorn main:app --reload

Luego abre http://127.0.0.1:8000/docs para probar cada endpoint
desde el navegador (Swagger UI, se genera solo).
"""

from fastapi import FastAPI, HTTPException
from bson import ObjectId
from bson.errors import InvalidId

from database import coleccion
from models import Producto, ProductoCrear, ProductoActualizar

app = FastAPI(title="CRUD Productos - MongoDB")


def doc_a_producto(doc: dict) -> dict:
    """Convierte el _id de Mongo (ObjectId) a string para que Pydantic lo acepte."""
    doc["_id"] = str(doc["_id"])
    return doc


def validar_object_id(id: str) -> ObjectId:
    try:
        return ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="El id no tiene un formato valido")


# ---------- CONSULTAR TODOS ----------
@app.get("/productos", response_model=list[Producto])
def listar_productos():
    docs = coleccion.find()
    return [doc_a_producto(d) for d in docs]


# ---------- CONSULTAR POR ID ----------
@app.get("/productos/{id}", response_model=Producto)
def obtener_producto(id: str):
    oid = validar_object_id(id)
    doc = coleccion.find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return doc_a_producto(doc)


# ---------- INSERTAR ----------
@app.post("/productos", response_model=Producto, status_code=201)
def crear_producto(producto: ProductoCrear):
    resultado = coleccion.insert_one(producto.model_dump())
    nuevo = coleccion.find_one({"_id": resultado.inserted_id})
    return doc_a_producto(nuevo)


# ---------- ACTUALIZAR ----------
@app.put("/productos/{id}", response_model=Producto)
def actualizar_producto(id: str, producto: ProductoActualizar):
    oid = validar_object_id(id)

    # Solo actualiza los campos que vinieron en el body (no pisa con None)
    datos = {k: v for k, v in producto.model_dump().items() if v is not None}
    if not datos:
        raise HTTPException(status_code=400, detail="No enviaste ningun campo para actualizar")

    resultado = coleccion.update_one({"_id": oid}, {"$set": datos})
    if resultado.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    actualizado = coleccion.find_one({"_id": oid})
    return doc_a_producto(actualizado)


# ---------- ELIMINAR ----------
@app.delete("/productos/{id}", status_code=204)
def eliminar_producto(id: str):
    oid = validar_object_id(id)
    resultado = coleccion.delete_one({"_id": oid})
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return None
