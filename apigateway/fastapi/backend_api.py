import os
import secrets
from fastapi import FastAPI

from fastapi import(
    FastAPI,
    Header,
    HTTPException,
    Depends
)
app = FastAPI(
    title="Backend API en",
    description="API UBICADA y enrutada por API gateway",

)

INTERNAL_GATEWAY_SECRET= os.getenv( 
    "INTERNAL_GATEWAY_SECRET"
)
if not INTERNAL_GATEWAY_SECRET:
    raise RuntimeError("INTERNAL_GATEWAY_SECRET environment variable is not set")

def veify_gateway(
        x_gateway_secret: str = Header(default="")
):
    valid = secrets.compare_digest(
        x_gateway_secret, INTERNAL_GATEWAY_SECRET
    )
    if not valid:
        raise HTTPException(status_code=401, detail="solicitud no autorizada")

@app.get("/health", dependencies=[Depends(veify_gateway)])
def health():
    return{
        "status": "ok",
        "service": "backend API",
    }

@app.get("/products", dependencies=[Depends(veify_gateway)])
def products():
    x_authenticated_client: str | None = Header(default=None)
    return{
        "authenticated_client": x_authenticated_client, 
        "products": [
            {"id": 1, "name": "Notebook", "price": 100000},
            {"id": 2, "name": "Monitor", "price": 1900}
        ]
    }

@app.get("/orders", dependencies=[Depends(veify_gateway)])
def orders():
    x_authenticated_client: str | None = Header(default=None)
    return{
        "authenticated_client": x_authenticated_client, 
        "orders": [
            {"id": 1001, "status": "paid"},
            {"id": 1002, "status": "pending"}
        ]
    }