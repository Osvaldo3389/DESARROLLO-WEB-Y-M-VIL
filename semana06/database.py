"""
Conexion a MongoDB usando PyMongo.


"""

from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "tienda"  
COLLECTION_NAME = "productos"  

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
coleccion = db[COLLECTION_NAME]
