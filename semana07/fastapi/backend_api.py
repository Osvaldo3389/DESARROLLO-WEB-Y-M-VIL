from fastapi import FastAPI
app = FastAPI(
    title="Backend API en",
    description="API UBICADA y enrutada por API gateway",

)

@app.get("/health")
def health():
    return{
        "status": "ok",
        "service": "backend API",
    }

@app.get("/products")
def products():
    return{
        "products": [
            {"id": 1, "name": "Notebook", "price": 10000},
            {"id": 2, "name": "Monitor", "price": 1900}
        ]
    }

@app.get("/orders")
def orders():
    return{
        "orders": [
            {"id": 1001, "status": "paid"},
            {"id": 1002, "status": "pending"}
        ]
    }