"""
Qilin — API
FastAPI con WebSockets para el dashboard en tiempo real.
JWT para autenticación; sin credenciales el endpoint /auth/login devuelve token.
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone

import asyncpg
import httpx
import bcrypt
import jwt
import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [API] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL   = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL      = os.getenv("DB_URL", "")
JWT_SECRET  = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGO    = "HS256"
JWT_TTL_H   = 24  # horas de validez del token

# ── Carga usuarios desde env ──────────────────────────────────────────────────
# Formato: AUTH_USER_1=carlos:$2b$12$hash...
# Si el hash está vacío (cuenta no configurada), se usa la contraseña en texto plano
# solo en modo desarrollo para facilitar el arranque inicial.
def _load_users() -> dict[str, str]:
    users = {}
    for key, val in os.environ.items():
        if key.startswith("AUTH_USER_") and ":" in val:
            username, hashed = val.split(":", 1)
            users[username.strip()] = hashed.strip()
    # Fallback de desarrollo si no hay usuarios configurados
    if not users:
        log.warning("No hay usuarios configurados en AUTH_USER_*. Usando carlos/12345 (solo dev).")
        users["carlos"] = ""  # contraseña vacía → se compara en texto plano con "12345"
    return users

USERS = _load_users()

# ── Helpers JWT ───────────────────────────────────────────────────────────────

def verify_password(username: str, plain: str) -> bool:
    hashed = USERS.get(username)
    if hashed is None:
        return False
    if not hashed:
        # Modo desarrollo: sin hash, acepta "12345"
        return plain == "12345"
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_H),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> str:
    """Devuelve el username o lanza HTTPException."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    return decode_token(token)


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Qilin API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    if DB_URL:
        try:
            app.state.db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Endpoints de DB desactivados.")
            app.state.db = None
    else:
        app.state.db = None
    log.info("Qilin API lista.")


@app.on_event("shutdown")
async def shutdown():
    if app.state.db:
        await app.state.db.close()


# ── AUTH ──────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


@app.post("/auth/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    if not verify_password(form.username, form.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_token(form.username)
    log.info(f"Login correcto: {form.username}")
    return TokenResponse(access_token=token, username=form.username)


# ── REST ENDPOINTS ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "qilin-api"}


@app.get("/alerts")
async def get_alerts(
    limit: int = 50,
    zone: str | None = None,
    _user: str = Depends(get_current_user),
):
    if not app.state.db:
        return []
    if zone:
        rows = await app.state.db.fetch(
            "SELECT * FROM alerts WHERE zone=$1 ORDER BY time DESC LIMIT $2", zone, limit
        )
    else:
        rows = await app.state.db.fetch(
            "SELECT * FROM alerts ORDER BY time DESC LIMIT $1", limit
        )
    return [dict(r) for r in rows]


@app.get("/aircraft")
async def get_aircraft(_user: str = Depends(get_current_user)):
    redis = app.state.redis
    keys  = await redis.keys("current:aircraft:*")
    if not keys:
        return []
    values = await redis.mget(*keys)
    return [json.loads(v) for v in values if v]


@app.get("/vessels")
async def get_vessels(_user: str = Depends(get_current_user)):
    redis = app.state.redis
    keys  = await redis.keys("current:vessel:*")
    if not keys:
        return []
    values = await redis.mget(*keys)
    return [json.loads(v) for v in values if v]


# ── RUTAS DE VUELO ───────────────────────────────────────────────────────────

OPENSKY_CLIENT_ID     = os.getenv("OPENSKY_CLIENT_ID", "")
OPENSKY_CLIENT_SECRET = os.getenv("OPENSKY_CLIENT_SECRET", "")
OPENSKY_TOKEN_URL     = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"

_api_token: str | None = None
_api_token_exp: float  = 0.0


async def _get_opensky_token(client: httpx.AsyncClient) -> str | None:
    global _api_token, _api_token_exp
    import time
    if not OPENSKY_CLIENT_ID or not OPENSKY_CLIENT_SECRET:
        return None
    if _api_token and time.time() < _api_token_exp - 30:
        return _api_token
    try:
        resp = await client.post(
            OPENSKY_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": OPENSKY_CLIENT_ID,
                "client_secret": OPENSKY_CLIENT_SECRET,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        _api_token = data["access_token"]
        _api_token_exp = time.time() + data.get("expires_in", 3600)
        return _api_token
    except Exception as e:
        log.warning(f"Error obteniendo token OpenSky para rutas: {e}")
        return None


@app.get("/routes/{callsign}")
async def get_route(callsign: str, _user: str = Depends(get_current_user)):
    """
    Proxy hacia OpenSky /api/routes para obtener origen/destino de un vuelo.
    Cache en Redis 5 minutos para no saturar la API de OpenSky.
    """
    cs = callsign.upper().strip()
    redis = app.state.redis

    cached = await redis.get(f"route:{cs}")
    if cached:
        return json.loads(cached)

    result: dict = {}
    try:
        async with httpx.AsyncClient() as client:
            headers = {}
            token = await _get_opensky_token(client)
            if token:
                headers["Authorization"] = f"Bearer {token}"
            resp = await client.get(
                "https://opensky-network.org/api/routes",
                params={"callsign": cs},
                headers=headers,
                timeout=8,
            )
            if resp.status_code == 200:
                data = resp.json()
                route = data.get("route", [])
                result = {
                    "origin":      route[0] if len(route) > 0 else None,
                    "destination": route[1] if len(route) > 1 else None,
                    "operator":    data.get("operatorIata"),
                    "flight":      data.get("flightNumber"),
                }
            elif resp.status_code == 404:
                result = {}
            else:
                log.warning(f"OpenSky routes HTTP {resp.status_code} para {cs}")
    except Exception as e:
        log.warning(f"Error consultando ruta {cs}: {e}")

    await redis.setex(f"route:{cs}", 300, json.dumps(result))
    return result


@app.get("/meta/{icao24}")
async def get_aircraft_meta(icao24: str, _user: str = Depends(get_current_user)):
    """
    Metadata de una aeronave: modelo, matrícula y foto.
    - Modelo/tipo: OpenSky aircraft database (requiere credenciales, opcional)
    - Foto:        Planespotters.net public API (sin auth)
    Cache Redis 24h — el modelo de un avión no cambia.
    """
    ic = icao24.lower().strip()
    redis = app.state.redis

    cached = await redis.get(f"meta:{ic}")
    if cached:
        return json.loads(cached)

    result: dict = {"icao24": ic, "model": None, "typecode": None,
                    "registration": None, "photo_url": None, "photographer": None}

    async with httpx.AsyncClient() as client:
        # ── OpenSky aircraft metadata ──
        try:
            headers = {}
            token = await _get_opensky_token(client)
            if token:
                headers["Authorization"] = f"Bearer {token}"
            resp = await client.get(
                f"https://opensky-network.org/api/metadata/aircraft/icao/{ic}",
                headers=headers,
                timeout=8,
            )
            if resp.status_code == 200:
                data = resp.json()
                result["model"]        = data.get("model")
                result["typecode"]     = data.get("typecode")
                result["registration"] = data.get("registration")
                result["owner"]        = data.get("owner")
        except Exception as e:
            log.warning(f"OpenSky metadata error para {ic}: {e}")

        # ── Planespotters foto ──
        try:
            resp = await client.get(
                f"https://api.planespotters.net/pub/photos/hex/{ic}",
                headers={"User-Agent": "Qilin/1.0 (geopolitical intelligence platform)"},
                timeout=8,
            )
            if resp.status_code == 200:
                data = resp.json()
                photos = data.get("photos", [])
                if photos:
                    result["photo_url"]    = photos[0].get("thumbnail_large", {}).get("src")
                    result["photographer"] = photos[0].get("photographer")
        except Exception as e:
            log.warning(f"Planespotters error para {ic}: {e}")

    await redis.setex(f"meta:{ic}", 86400, json.dumps(result))
    return result


# ── WEBSOCKET ─────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, msg: dict):
        for ws in list(self.active):
            try:
                await ws.send_json(msg)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str | None = None):
    """
    WebSocket para actualizaciones en tiempo real.
    Autenticación: pasar token como query param: /ws?token=<jwt>
    Si JWT_SECRET es el de desarrollo, se acepta sin token (modo dev).
    """
    # Verificar token
    is_dev = JWT_SECRET == "dev-secret-change-in-production"
    if not is_dev:
        if not token:
            await ws.close(code=4001, reason="Token requerido")
            return
        try:
            decode_token(token)
        except HTTPException:
            await ws.close(code=4001, reason="Token inválido")
            return

    await manager.connect(ws)
    redis = app.state.redis
    last_alert_id = "$"

    try:
        while True:
            results = await redis.xread({"stream:alerts": last_alert_id}, count=10, block=500)
            for _, messages in (results or []):
                for msg_id, msg in messages:
                    await ws.send_json({"type": "alert", "data": json.loads(msg["data"])})
                    last_alert_id = msg_id
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        log.error(f"WebSocket error: {e}")
        manager.disconnect(ws)
