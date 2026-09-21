from fastapi import FastAPI
app = FastAPI(
    title="Backend API es",
    description="API UBICADA y enrutada por API gateway",

)

@app.get("/health")
def health():
    return{
        "status": "ok",
        "service": "backend API",
    }

@app.get("/productos")
def products():
    return{
        "products": [
            {"id": 1, "name": "Notebook", "precio": 10000},
            {"id": 2, "name": "Monitor", "precio": 1900}
        ]
    }

@app.get("/ordenes")
def orders():
    return{
        "orders": [
            {"id": 1001, "status": "paid"},
            {"id": 1002, "status": "pending"}
        ]
    }