"""
Modelos Pydantic para validar los datos que entran y salen de la API.

Esto es solo un EJEMPLO con un "producto" (nombre, precio, stock).
Cambia los campos por los que necesite tu entidad real.
"""

from pydantic import BaseModel, Field
from typing import Optional


class ProductoBase(BaseModel):
    nombre: str
    precio: float
    stock: int = 0


class ProductoCrear(ProductoBase):
    """Datos que se reciben al insertar (POST). No lleva id, lo genera Mongo."""
    pass


class ProductoActualizar(BaseModel):
    """Datos que se reciben al actualizar (PUT). Todos opcionales."""
    nombre: Optional[str] = None
    precio: Optional[float] = None
    stock: Optional[int] = None


class Producto(ProductoBase):
    """Lo que devuelve la API (incluye el id como string)."""
    id: str = Field(..., alias="_id")

    class Config:
        populate_by_name = True
