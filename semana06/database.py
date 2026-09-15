"""
Conexion a MongoDB usando PyMongo.

Cambia MONGO_URI y DB_NAME segun tu caso (por ejemplo, si usas
MongoDB Atlas, pega aca la URI de conexion que te entrega Atlas).
"""

from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "tienda"  # <-- cambia esto por el nombre de tu base de datos
COLLECTION_NAME = "productos"  # <-- cambia esto por el nombre de tu coleccion

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
coleccion = db[COLLECTION_NAME]
