from fastapi import FastAPI
import httpx
app = FastAPI(title="local api gateway")

BACKEND_URL = "http://localhost:9000"
BACKEND_URL_ES = "http://localhost:9100"
@app.get("/api/products")
async def products():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/products")
        return response.json()

@app.get("/api/productos")
async def products():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/products")
        return response.json()

@app.get("/api/orders")
async def orders():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/orders")
        return response.json()
    