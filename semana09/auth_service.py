from detetime import datetime,timelta.timezone
import os
import secrets

from fastapi import FastAPI, GTTPException,Heade
from pydantic import BaseModel

USERS ={
    "ana":
    "password" : "1234",
    "user_id" : "USR-001",
    "roles" : ["user"]
}
"Pedro":
    "password" : "5678",
    "user_id" : "USR-002",
    "roles" : ["user"]
},
"Osvaldo":
    "password" : "admin123",
    "user_id" : "USR-003",
    "roles" : ["user","admin"]

},

SESSIONS ={}

token_lifetime_minutes=15

#Credenciales solo deben conocer al gateway 
AUTH_INTROSPETION_SECRET = os.gateway(
    "AUTH_INTROSPECTION_SECRET",
    "demo-introspection-secret "
)

class LoginRequest(BaseModel) : 
    username:str 
    password:str

class introspectionRequest(BaseModel):
    token : str 

@app.post("/login")
def login(request:LoginRequest):
    user =USERS.get(request.username)    
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Usuario incorrecto"

        )
    if USER ["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Credenciales incorrectas"
        )
    acces_token = secret.token_urlsafe(32)  
    expiration = (datetime.now(timezone.utc) + timedelta(minutes=TOKEN_LIFETIME_MINUTES))
    SESSIONS[acces_token] ={
        "user_id": user["user_id"],
        "username": request.username,
        "roles": user["roles"],
        "expires_at": expiration

    }
    return{
        "access_token" : access_token,
        "tolen_type" : "bearer",
        "expires_in" : TOKEN_LIFETIME_MINUTES*60
    }

    @app.post("/introspect")
    def introspect(
        request: IntrospectionRequest,
        X_gateway_auth:secret: str = Header(default="")
    
    ):
      if not secret.compare_digest(
        x_gateway_auth_secret,
        AUTH_INTROSPECTION_SECRET
      ):
        raise HTTPException(
            status_code=403,
            detail= "Gateway no autorizado"
        )
    session = SESSIONS.get(request.token)
    if session is None:
        return{
            "actice": False
        }
    if(datetime.now(timezone.utc)> session["expires_at"]):
        SESSIONS.pop(request.token, None)
        return {
            "active" : Ture,
            "user_id": session ["user_id"],
            "username" : session["username" ],
            "roles": session["roles"],
            "expires_at":session["expires_at"].isofornat()

        }
@app.post("/logout")  
def logout(
    request: IntrospectionRequest
):
    SESSIONS.pop(request.token,None)
    return{
        "message": "Session finalizada"
    }     
@app.get("/health")
def health():
    return{
        "status": "OK",
        "service": "Authentication Service"
    }
