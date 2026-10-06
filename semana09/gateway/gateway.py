import os
import secrets
import httpx
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Request,
    Response
)
from fastapi.security import(
    HTTPBearer,
    HTTPAuthorizationCredentials
)

app = FastAPI(title="local api gateway")

security = HTTPBearer(
    auto_error=False
)

AUTH_SERVICE_URL =os.getenv(
    "AUTH_SERVICE_URL",
    "http://127.0.0.1:8100"
)

VAULT_ADDR= os.getenv(
    "VAULT_ADDR", "http://localhost:8200"
)

VAULT_TOKEN= os.getenv(
    "VAULT_TOKEN" # dev-only-token
)
if not VAULT_TOKEN:
    raise RuntimeError(
        "VAULT_TOKEN no configurado"
        )

async def get_gateway_secrets():
    url=(
        f"{VAULT_ADDR}"
        "/v1/secret/data/gateway"
    )
    headers={
        "X-Vault-Token": VAULT_TOKEN # dev-only-token
    }

    async with httpx.AsyncClient(timeout=5.0) as client:
        response= await client.get(
            url=url,
            headers=headers
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"no fue posible acceder al vault:{response.status_code}"
            )
        vault_response= response.json()
        return vault_response["data"]["data"]
async def autenticate_client(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="barer token no proporcionado"
        )
    gateway_secrets= (
        await get_gateway_secrets()
    )
   instrospection_secret=(
       gateway_secrets["auth_instrospection_secrets"]
   )
try:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(
            f"{AUTH_SERVICE_URL}/introspect",
            json={"token": credentials.credentials},
            headers={"X-Gateway-Auth-Secret": introspection_secret
                    }
        )
        expect httpx.RequestError:
            raise HTTPException(
                status_code=503,
                detail="Authentication service no disponible"
            )
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Authentication service no disponible"
BACKEND_URL = "http://localhost:9000"
BACKEND_URL2 = "http://localhost:9100"
#@app.get("/api/products")
#async def products():
#    async with httpx.AsyncClient() as client:
#        response = await client.get(f"{BACKEND_URL}/products")
#        return response.json()

#@app.get("/api/productos")
#async def products():
#    async with httpx.AsyncClient() as client:
#        response = await client.get(f"{BACKEND_URL2}/productos")
#        return response.json()

#@app.get("/api/orders")
#async def orders():
#    async with httpx.AsyncClient() as client:
#        response = await client.get(f"{BACKEND_URL}/orders")
#        return response.json()
#    
#@app.get("/api/ordenes")
#async def orders():
#    async with httpx.AsyncClient() as client:
#        response = await client.get(f"{BACKEND_URL2}/ordenes")
#        return response.json()
#    
@app.api_route(
    "/api/{path:path}", #products health orders
    methods=["GET", "POST", "PUT", "DELETE"]
    )
async def proxy(
    path: str,
    request: Request,
    auth=Depends(autenticate_client)
    ):
        target_url = (
            f"{BACKEND_URL}/{path}" 
        )
        body = await request.body()
        gateway_headers = {
            "X-Gateway-Secret": auth["backend_secret"],
            "X-Authenticated-Client": auth["client_id"]
        }
        content_type = request.headers.get("content-type")
