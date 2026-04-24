"""
Qilin — API
FastAPI con WebSockets para el dashboard en tiempo real.
JWT para autenticación; sin credenciales el endpoint /auth/login devuelve token.
"""

import asyncio
import functools
import hashlib
import json
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote

import asyncpg
import httpx
import bcrypt
import jwt
import yaml
import yfinance as yf
import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status, BackgroundTasks, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [API] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL   = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL      = os.getenv("DB_URL", "")
REPORTS_DIR = os.getenv("REPORTS_DIR", "/app/reports")
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

PLAN_LIMITS: dict[str, int | None] = {
    "free":     2,
    "scout":    5,
    "analyst":  20,
    "pro":      None,  # unlimited
}

# ── Market assets ─────────────────────────────────────────────────────────────
MARKET_ASSETS = [
    {"symbol": "CL=F",  "name": "WTI Crude Oil",         "group": "Materias primas"},
    {"symbol": "BZ=F",  "name": "Brent Crude",            "group": "Materias primas"},
    {"symbol": "CC=F",  "name": "Cacao",                  "group": "Materias primas"},
    {"symbol": "GC=F",  "name": "Oro",                    "group": "Materias primas"},
    {"symbol": "NG=F",  "name": "Gas natural",            "group": "Materias primas"},
    {"symbol": "ZW=F",  "name": "Trigo",                  "group": "Materias primas"},
    {"symbol": "HG=F",  "name": "Cobre",                  "group": "Materias primas"},
    {"symbol": "ALI=F", "name": "Aluminio",               "group": "Materias primas"},
    {"symbol": "LMT",   "name": "Lockheed Martin",        "group": "Defensa EEUU"},
    {"symbol": "RTX",   "name": "Raytheon",               "group": "Defensa EEUU"},
    {"symbol": "BA",    "name": "Boeing",                 "group": "Defensa EEUU"},
    {"symbol": "NOC",   "name": "Northrop Grumman",       "group": "Defensa EEUU"},
    {"symbol": "GD",    "name": "General Dynamics",       "group": "Defensa EEUU"},
    {"symbol": "LHX",   "name": "L3Harris",               "group": "Defensa EEUU"},
    {"symbol": "RHM.DE","name": "Rheinmetall",            "group": "Defensa Europa"},
    {"symbol": "BA.L",  "name": "BAE Systems",            "group": "Defensa Europa"},
    {"symbol": "AIR.PA","name": "Airbus",                 "group": "Defensa Europa"},
    {"symbol": "HO.PA", "name": "Thales",                 "group": "Defensa Europa"},
    {"symbol": "LDO.MI","name": "Leonardo",               "group": "Defensa Europa"},
    {"symbol": "XOM",   "name": "ExxonMobil",             "group": "Energía"},
    {"symbol": "CVX",   "name": "Chevron",                "group": "Energía"},
    {"symbol": "SHEL",  "name": "Shell",                  "group": "Energía"},
    {"symbol": "BP",    "name": "BP",                     "group": "Energía"},
    {"symbol": "TTE",   "name": "TotalEnergies",          "group": "Energía"},
    {"symbol": "EQNR",  "name": "Equinor",               "group": "Energía"},
    {"symbol": "NVDA",  "name": "NVIDIA",                 "group": "Semiconductores"},
    {"symbol": "TSM",   "name": "TSMC",                   "group": "Semiconductores"},
    {"symbol": "ASML",  "name": "ASML",                   "group": "Semiconductores"},
    {"symbol": "INTC",  "name": "Intel",                  "group": "Semiconductores"},
    {"symbol": "FCX",   "name": "Freeport-McMoRan",       "group": "Minería crítica"},
    {"symbol": "VALE",  "name": "Vale",                   "group": "Minería crítica"},
    {"symbol": "RIO",   "name": "Rio Tinto",              "group": "Minería crítica"},
    {"symbol": "USO",   "name": "Oil ETF",                "group": "ETFs"},
    {"symbol": "GLD",   "name": "Gold ETF",               "group": "ETFs"},
    {"symbol": "XLE",   "name": "Energy Select ETF",      "group": "ETFs"},
    {"symbol": "ITA",   "name": "Aerospace & Defense ETF","group": "ETFs"},
]

_PERIOD_INTERVAL = {"1d": "5m", "5d": "1h", "1mo": "1d", "3mo": "1d", "1y": "1wk"}
_VALID_SYMBOLS = {a["symbol"] for a in MARKET_ASSETS}

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


# ── CAPA DE CACHE (2 + 3) ─────────────────────────────────────────────────────
# 1) @cached(prefix, ttl): guarda el resultado JSON en Redis por hash de kwargs.
# 2) Middleware HTTP: añade ETag + Cache-Control + Vary: Authorization y responde
#    304 si If-None-Match coincide. Para rutas NO cacheables fuerza no-store.
#
# CACHEABLE_PATHS usa la ruta INTERNA que ve FastAPI (nginx hace strip de /api/).
# Ej.: el cliente pide /api/news/feed → FastAPI ve /news/feed.
# Excepción: /api/stats está registrado literal para la landing pública.
CACHEABLE_PATHS: dict[str, int] = {
    "/news/feed":        60,
    "/news/sources":    300,
    "/social/feed":      60,
    "/social/accounts": 300,
    "/docs/feed":       120,
    "/docs/sources":    300,
    "/sec/feed":        120,
    "/sec/sources":     300,
    "/polymarket/feed":  60,
    "/markets/quotes":   60,
    "/intel/timeline":   30,
    "/intel/spend":      10,
    "/stats":            60,
    "/aircraft/history": 60,
    "/topics":           3600,
}


def cached(prefix: str, ttl: int):
    """Cachea la respuesta JSON de un endpoint FastAPI en Redis.

    Key: ``cache:{prefix}:{sha1(kwargs)[:16]}``. Se ignoran kwargs con prefijo
    ``_`` (p.ej. ``_user``) y objetos ``Request``. Si Redis no está disponible
    o falla, sirve sin cache — no rompe el endpoint.
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            redis = getattr(app.state, "redis", None)
            if redis is None:
                return await func(*args, **kwargs)

            key_parts: list[str] = []
            for k in sorted(kwargs.keys()):
                if k.startswith("_"):
                    continue
                v = kwargs[k]
                if isinstance(v, Request):
                    continue
                key_parts.append(f"{k}={v!r}")
            keyhash = hashlib.sha1("|".join(key_parts).encode()).hexdigest()[:16]
            cache_key = f"cache:{prefix}:{keyhash}"

            try:
                raw = await redis.get(cache_key)
                if raw:
                    return json.loads(raw)
            except Exception as e:
                log.warning(f"[cache] read error {cache_key}: {e}")

            result = await func(*args, **kwargs)
            try:
                payload = json.dumps(jsonable_encoder(result))
                await redis.setex(cache_key, ttl, payload)
            except Exception as e:
                log.warning(f"[cache] write error {cache_key}: {e}")
            return result
        return wrapper
    return decorator


async def invalidate_cache(prefix: str) -> int:
    """Borra todas las claves ``cache:{prefix}:*`` en Redis.

    No se llama automáticamente desde los ingestores (decisión abierta). Devuelve
    el número de claves borradas.
    """
    redis = getattr(app.state, "redis", None)
    if redis is None:
        return 0
    pattern = f"cache:{prefix}:*"
    deleted = 0
    try:
        async for key in redis.scan_iter(match=pattern, count=500):
            await redis.delete(key)
            deleted += 1
        if deleted:
            log.info(f"[cache] invalidated {deleted} keys for prefix={prefix}")
    except Exception as e:
        log.warning(f"[cache] invalidate error {prefix}: {e}")
    return deleted


async def _get_user_topic_ids(username: str) -> list[str]:
    """Return topic IDs subscribed by a user. Returns [] if DB unavailable."""
    db = app.state.db
    if not db:
        return []
    try:
        row = await db.fetchrow("SELECT id FROM users WHERE username=$1", username)
        if not row:
            return []
        rows = await db.fetch(
            "SELECT topic_id FROM user_topics WHERE user_id=$1", row["id"]
        )
        return [r["topic_id"] for r in rows]
    except Exception as exc:
        log.warning("[topics] _get_user_topic_ids error: %s", exc)
        return []


@app.middleware("http")
async def etag_and_cache_control(request: Request, call_next):
    response = await call_next(request)

    if request.method != "GET":
        return response

    content_type = response.headers.get("content-type", "")
    if response.status_code != 200 or "application/json" not in content_type:
        return response

    body_chunks: list[bytes] = []
    async for chunk in response.body_iterator:
        body_chunks.append(chunk)
    body = b"".join(body_chunks)

    etag = '"' + hashlib.sha1(body).hexdigest()[:16] + '"'
    path = request.url.path
    ttl = CACHEABLE_PATHS.get(path)

    headers = dict(response.headers)
    headers.pop("content-length", None)
    headers["etag"] = etag
    headers["vary"] = "Authorization"
    headers["cache-control"] = f"private, max-age={ttl}" if ttl is not None else "no-store"

    # nginx convierte ETag strong → weak ("W/...") al gzipar, así que comparamos
    # normalizando el prefijo en ambos lados (RFC 7232 weak comparison).
    def _norm(e: str) -> str:
        return e.strip().removeprefix("W/").strip()

    if _norm(request.headers.get("if-none-match", "")) == _norm(etag):
        no_body_headers = {k: v for k, v in headers.items() if k.lower() != "content-type"}
        return Response(status_code=304, headers=no_body_headers)

    return Response(content=body, status_code=200, headers=headers)


DB_POOL_MIN = int(os.getenv("DB_POOL_MIN", "4"))
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "20"))


@app.on_event("startup")
async def startup():
    app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    if DB_URL:
        try:
            # Pool de conexiones: permite que N endpoints no-cacheados corran
            # queries concurrentes. Los métodos .fetch/.fetchrow/.fetchval/
            # .execute del Pool adquieren y liberan conexión automáticamente,
            # así que el código cliente queda idéntico al de una Connection.
            app.state.db = await asyncpg.create_pool(
                DB_URL,
                min_size=DB_POOL_MIN,
                max_size=DB_POOL_MAX,
                command_timeout=30,
            )
            log.info(f"Pool TimescaleDB listo (min={DB_POOL_MIN} max={DB_POOL_MAX}).")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Endpoints de DB desactivados.")
            app.state.db = None
    else:
        app.state.db = None

    # Suscriptor pub/sub para invalidación reactiva desde ingestores.
    # Los ingestores publican `cache.invalidate` con el prefix afectado y
    # cualquier réplica del API borra sus entradas cache:{prefix}:* en Redis.
    app.state._invalidate_task = asyncio.create_task(_cache_invalidate_listener())
    log.info("Qilin API lista.")


@app.on_event("shutdown")
async def shutdown():
    task = getattr(app.state, "_invalidate_task", None)
    if task:
        task.cancel()
    if app.state.db:
        await app.state.db.close()


async def _cache_invalidate_listener():
    """Escucha el canal Redis ``cache.invalidate`` y borra los prefijos
    publicados por los ingestores. Reintenta si Redis cae momentáneamente."""
    while True:
        try:
            redis = getattr(app.state, "redis", None)
            if redis is None:
                await asyncio.sleep(1)
                continue
            pubsub = redis.pubsub()
            await pubsub.subscribe("cache.invalidate")
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                prefix = str(message.get("data", "")).strip()
                if not prefix:
                    continue
                await invalidate_cache(prefix)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning(f"[cache.invalidate] listener error: {e}; reintentando en 2s")
            await asyncio.sleep(2)


# ── AUTH ──────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


@app.post("/auth/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    # 1. Check env-var users first (existing behaviour)
    if verify_password(form.username, form.password):
        token = create_token(form.username)
        log.info(f"Login correcto: {form.username}")
        return TokenResponse(access_token=token, username=form.username)

    # 2. Fallback: check DB users table
    db = app.state.db
    if db:
        row = await db.fetchrow(
            "SELECT username, password_hash FROM users WHERE username=$1",
            form.username.lower()
        )
        if row:
            try:
                match = bcrypt.checkpw(form.password.encode(), row["password_hash"].encode())
            except Exception:
                match = False
            if match:
                token = create_token(row["username"])
                log.info(f"Login correcto (DB): {row['username']}")
                return TokenResponse(access_token=token, username=row["username"])

    raise HTTPException(status_code=401, detail="Credenciales incorrectas")


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


@app.post("/auth/register")
async def register(req: RegisterRequest):
    if len(req.username) < 3:
        raise HTTPException(status_code=422, detail="Username mínimo 3 caracteres")
    if len(req.password) < 8:
        raise HTTPException(status_code=422, detail="Contraseña mínimo 8 caracteres")
    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=422, detail="Email inválido")

    db = app.state.db
    if not db:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")

    # Check duplicate username or email
    existing = await db.fetchrow(
        "SELECT id FROM users WHERE username=$1 OR email=$2",
        req.username.lower(), req.email.lower()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Usuario o email ya registrado")

    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt(12)).decode()
    try:
        await db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
            req.username.lower(), req.email.lower(), hashed
        )
    except asyncpg.exceptions.UniqueViolationError:
        raise HTTPException(status_code=409, detail="Usuario o email ya registrado")
    except Exception as e:
        log.error(f"Error al registrar usuario: {e}")
        raise HTTPException(status_code=500, detail="Error al crear la cuenta")
    log.info(f"Nuevo usuario registrado: {req.username.lower()}")
    token = create_token(req.username.lower())
    return {"access_token": token, "token_type": "bearer", "username": req.username.lower()}


# ── REST ENDPOINTS ────────────────────────────────────────────────────────────

@app.get("/stats")
@cached("api.stats", ttl=60)
async def public_stats():
    """Estadísticas públicas para la landing page. Sin autenticación.

    Registrada como ``/stats`` — accesible externamente via ``/api/stats``
    porque nginx hace strip de ``/api/`` (proxy_pass con trailing slash).
    """
    redis = app.state.redis
    if not redis:
        return {"aircraft_active": 0}
    try:
        cached = await redis.get("cache:stats:aircraft")
        if cached:
            return {"aircraft_active": int(cached)}
        # Count live aircraft keys
        keys = await redis.keys("current:aircraft:*")
        count = len(keys)
        await redis.set("cache:stats:aircraft", count, ex=15)
        return {"aircraft_active": count}
    except Exception as e:
        log.warning(f"stats endpoint error: {e}")
        return {"aircraft_active": 0}


# ── TOPIC CATALOG ─────────────────────────────────────────────────────────────

@app.get("/topics")
@cached("topics.catalog", ttl=3600)
async def get_topics_catalog(request: Request):
    """Public topic catalog from config/topics.yaml."""
    from topic_utils import load_catalog
    catalog = load_catalog(os.getenv("TOPICS_CONFIG_PATH", "/app/config/topics.yaml"))
    return {"topics": [
        {"id": t["id"], "label_es": t.get("label_es", t["id"]),
         "label_en": t.get("label_en", t["id"]), "type": t.get("type", "sector")}
        for t in catalog
    ]}


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class FavoriteRequest(BaseModel):
    callsign: str | None = None


class SourceFavoriteRequest(BaseModel):
    source_name: str | None = None


class VesselFavoriteRequest(BaseModel):
    mmsi: str
    name: str | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class TopicsUpdateRequest(BaseModel):
    topics: list[str]

class TelegramUpdateRequest(BaseModel):
    chat_id: str


_LANDING_CHAT_SYSTEM = """Eres Qilin, el asistente de la plataforma de inteligencia geopolítica Qilin.

Tu función es ayudar a visitantes de la web a entender la plataforma y elegir el plan correcto.

Sobre Qilin:
- Plataforma de inteligencia geopolítica en tiempo real
- Monitoriza aeronaves militares y privadas, flotas navales, alertas con IA y señales satelitales
- Agrega más de 500 fuentes de noticias e inteligencia globales
- Mercados de predicción integrados para cruzar probabilidades con eventos geopolíticos

Planes:
- Scout ($0/mes): mapa militar con retraso, 20 noticias/día, 5 alertas/día. Para explorar.
- Analyst ($49/mes): tiempo real completo, aviones privados, tráfico naval, alertas ilimitadas, historial 30 días. Para analistas e investigadores.
- Command ($199/mes): todo de Analyst + señales satelitales, informes semanales con IA, API REST, hasta 5 usuarios. Para equipos e instituciones.

Responde SOLO sobre Qilin, sus funcionalidades y planes. Si preguntan algo fuera de este contexto, redirige amablemente a la plataforma.
Sé conciso y útil. Responde en el idioma del usuario."""


@app.post("/api/chat/public")
async def chat_public(req: ChatRequest, request: Request):
    """Chat público para la landing page. Sin auth, limitado por IP."""
    client_ip = request.client.host if request.client else "unknown"
    redis = app.state.redis

    # Rate limiting: 20 req/hour per IP
    rate_key = f"ratelimit:chat:public:{client_ip}"
    try:
        count = await redis.incr(rate_key)
        if count == 1:
            await redis.expire(rate_key, 3600)
        if count > 20:
            raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Inténtalo en una hora.")
    except HTTPException:
        raise
    except Exception:
        pass  # Redis error → allow through

    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        raise HTTPException(status_code=503, detail="Chatbot no disponible")

    messages = [{"role": m.role, "content": m.content} for m in req.messages[-6:]]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": anthropic_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 300,
                    "system": _LANDING_CHAT_SYSTEM,
                    "messages": messages,
                },
                timeout=30,
            )
            resp.raise_for_status()
            reply = resp.json()["content"][0]["text"].strip()
            return {"reply": reply}
    except HTTPException:
        raise
    except Exception as e:
        log.warning(f"chat/public error: {e}")
        raise HTTPException(status_code=500, detail="Error del chatbot")


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


@app.get("/aircraft/history")
@cached("aircraft.history", ttl=60)
async def get_aircraft_history(
    hours: int = 72,
    _user: str = Depends(get_current_user),
):
    if not app.state.db:
        return []
    hours = max(1, min(hours, 72))
    rows = await app.state.db.fetch(
        """
        SELECT icao24,
               MAX(callsign)  AS callsign,
               MAX(time)      AS last_seen,
               MIN(time)      AS first_seen,
               COUNT(*)       AS point_count,
               MAX(zone)      AS zone
        FROM aircraft_positions
        WHERE time > NOW() - ($1 * INTERVAL '1 hour')
          AND lat IS NOT NULL
        GROUP BY icao24
        ORDER BY last_seen DESC
        LIMIT 500
        """,
        hours,
    )
    return [
        {
            "icao24":      r["icao24"],
            "callsign":    r["callsign"],
            "last_seen":   r["last_seen"].isoformat(),
            "first_seen":  r["first_seen"].isoformat(),
            "point_count": r["point_count"],
            "zone":        r["zone"],
        }
        for r in rows
    ]


@app.get("/aircraft/{icao24}/trail")
async def get_aircraft_trail(
    icao24: str,
    hours: int = 6,
    _user: str = Depends(get_current_user),
):
    """Trayectoria histórica de una aeronave desde aircraft_positions."""
    if not app.state.db:
        return []
    hours = max(1, min(hours, 72))
    rows = await app.state.db.fetch(
        """
        SELECT time, lat, lon, altitude, heading, velocity, on_ground, callsign, zone
        FROM aircraft_positions
        WHERE icao24 = $1
          AND time > NOW() - ($2 * INTERVAL '1 hour')
          AND lat IS NOT NULL AND lon IS NOT NULL
        ORDER BY time ASC
        """,
        icao24.lower(), hours,
    )
    return [
        {
            "time":      r["time"].isoformat(),
            "lat":       r["lat"],
            "lon":       r["lon"],
            "altitude":  r["altitude"],
            "heading":   r["heading"],
            "velocity":  r["velocity"],
            "on_ground": r["on_ground"],
            "callsign":  r["callsign"],
            "zone":      r["zone"],
        }
        for r in rows
    ]


@app.get("/aircraft/{icao24}/bases")
async def get_aircraft_bases(
    icao24: str,
    _user: str = Depends(get_current_user),
):
    """Bases conocidas de una aeronave ordenadas por visitas."""
    if not app.state.db:
        return []
    try:
        rows = await app.state.db.fetch(
            """
            SELECT airfield_icao, airfield_name, airfield_type,
                   country, lat, lon, is_military,
                   first_seen, last_seen, visit_count, callsign, category
            FROM aircraft_bases
            WHERE icao24 = $1
            ORDER BY visit_count DESC, last_seen DESC
            """,
            icao24.lower(),
        )
        return [
            {
                **dict(r),
                "first_seen": r["first_seen"].isoformat(),
                "last_seen":  r["last_seen"].isoformat(),
            }
            for r in rows
        ]
    except Exception:
        return []


@app.get("/aircraft/{icao24}/routes")
async def get_aircraft_routes(
    icao24: str,
    _user: str = Depends(get_current_user),
):
    """Rutas detectadas de una aeronave (origen→destino)."""
    if not app.state.db:
        return []
    try:
        rows = await app.state.db.fetch(
            """
            SELECT r.origin_icao, r.dest_icao, r.origin_name, r.dest_name,
                   r.flight_count, r.last_seen,
                   o.lat AS origin_lat, o.lon AS origin_lon,
                   d.lat AS dest_lat,   d.lon AS dest_lon,
                   o.is_military AS origin_mil, d.is_military AS dest_mil
            FROM aircraft_routes r
            LEFT JOIN airfields o ON o.icao = r.origin_icao
            LEFT JOIN airfields d ON d.icao = r.dest_icao
            WHERE r.icao24 = $1
            ORDER BY r.flight_count DESC
            """,
            icao24.lower(),
        )
        return [
            {**dict(r), "last_seen": r["last_seen"].isoformat()}
            for r in rows
        ]
    except Exception:
        return []


@app.get("/bases/recent")
async def get_recent_bases(
    limit: int = 30,
    military_only: bool = False,
    _user: str = Depends(get_current_user),
):
    """Aterrizajes recientes detectados."""
    if not app.state.db:
        return []
    try:
        where = "WHERE is_military = TRUE" if military_only else ""
        rows = await app.state.db.fetch(
            f"""
            SELECT icao24, airfield_icao, airfield_name, airfield_type,
                   country, lat, lon, is_military,
                   last_seen, visit_count, callsign, category
            FROM aircraft_bases
            {where}
            ORDER BY last_seen DESC
            LIMIT $1
            """,
            limit,
        )
        return [
            {**dict(r), "last_seen": r["last_seen"].isoformat()}
            for r in rows
        ]
    except Exception:
        return []


@app.get("/airfields/search")
async def search_airfields(
    q: str = "",
    country: str = "",
    military_only: bool = False,
    limit: int = 20,
    _user: str = Depends(get_current_user),
):
    """Búsqueda de aeródromos por nombre o código ICAO."""
    if not app.state.db:
        return []
    try:
        conditions = []
        params: list = []
        if q:
            params.append(f"%{q.upper()}%")
            conditions.append(f"(UPPER(name) LIKE ${len(params)} OR UPPER(icao) LIKE ${len(params)})")
        if country:
            params.append(country.upper())
            conditions.append(f"country = ${len(params)}")
        if military_only:
            conditions.append("is_military = TRUE")
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        rows = await app.state.db.fetch(
            f"SELECT icao, iata, name, type, lat, lon, country, is_military FROM airfields {where} LIMIT ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows]
    except Exception:
        return []


# ── VESSEL ENDPOINTS ──────────────────────────────────────────────────────────

@app.get("/vessels")
async def get_vessels_api(_user: str = Depends(get_current_user)):
    redis = app.state.redis
    keys  = await redis.keys("current:vessel:*")
    if not keys:
        return []
    values = await redis.mget(*keys)
    return [json.loads(v) for v in values if v]


@app.get("/vessels/{mmsi}/info")
async def get_vessel_info(mmsi: str, _user: str = Depends(get_current_user)):
    """Fetch ship photo from Wikipedia. Result cached 24h in Redis."""
    redis = app.state.redis
    cache_key = f"meta:vessel:{mmsi}"

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    raw = await redis.get(f"current:vessel:{mmsi}")
    if not raw:
        raise HTTPException(status_code=404, detail="Vessel not found")
    vessel = json.loads(raw)
    name = vessel.get("name", "")
    if not name:
        result = {}
        await redis.setex(cache_key, 86400, json.dumps(result))
        return result

    result = {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(name.replace(' ', '_'), safe='')}",
                headers={"User-Agent": "QilinIntelligence/1.0 carlosqc.work@gmail.com"},
            )
            if resp.status_code == 200:
                data = resp.json()
                result = {
                    "thumbnail": data.get("thumbnail", {}).get("source"),
                    "extract":   data.get("extract", ""),
                    "url":       data.get("content_urls", {}).get("desktop", {}).get("page"),
                }
    except Exception as e:
        log.warning(f"Wikipedia lookup failed for vessel {mmsi} ({name}): {e}")

    await redis.setex(cache_key, 86400, json.dumps(result))
    return result


@app.get("/vessels/{mmsi}/ports")
async def get_vessel_ports(mmsi: str, _user: str = Depends(get_current_user)):
    if not app.state.db:
        return []
    try:
        rows = await app.state.db.fetch(
            """
            SELECT port_id, port_name, country, lat, lon, is_military,
                   first_seen, last_seen, visit_count
            FROM vessel_ports
            WHERE mmsi = $1
            ORDER BY visit_count DESC, last_seen DESC
            """,
            mmsi,
        )
        return [
            {**dict(r), "first_seen": r["first_seen"].isoformat(), "last_seen": r["last_seen"].isoformat()}
            for r in rows
        ]
    except Exception:
        return []


@app.get("/vessels/{mmsi}/routes")
async def get_vessel_routes(mmsi: str, _user: str = Depends(get_current_user)):
    if not app.state.db:
        return []
    try:
        rows = await app.state.db.fetch(
            """
            SELECT origin_port, dest_port, origin_name, dest_name, route_count, last_seen
            FROM vessel_routes
            WHERE mmsi = $1
            ORDER BY route_count DESC
            """,
            mmsi,
        )
        return [
            {**dict(r), "last_seen": r["last_seen"].isoformat()}
            for r in rows
        ]
    except Exception:
        return []


@app.get("/vessel-favorites")
async def list_vessel_favorites(_user: str = Depends(get_current_user)):
    if not app.state.db:
        return []
    try:
        rows = await app.state.db.fetch(
            "SELECT mmsi, name, added_at FROM vessel_favorites WHERE username=$1 ORDER BY added_at DESC",
            _user
        )
        return [{"mmsi": r["mmsi"], "name": r["name"], "added_at": r["added_at"].isoformat()} for r in rows]
    except Exception as e:
        log.error(f"Error fetching vessel favorites: {e}")
        return []


@app.post("/vessel-favorites")
async def add_vessel_favorite(req: VesselFavoriteRequest, _user: str = Depends(get_current_user)):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="DB no disponible")
    try:
        await app.state.db.execute(
            "INSERT INTO vessel_favorites (username, mmsi, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
            _user, req.mmsi, req.name
        )
    except Exception as e:
        log.error(f"Error adding vessel favorite: {e}")
        raise HTTPException(status_code=500, detail="Error guardando favorito")
    return {"ok": True}


@app.delete("/vessel-favorites/{mmsi}")
async def remove_vessel_favorite(mmsi: str, _user: str = Depends(get_current_user)):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="DB no disponible")
    try:
        await app.state.db.execute(
            "DELETE FROM vessel_favorites WHERE username=$1 AND mmsi=$2",
            _user, mmsi
        )
    except Exception as e:
        log.error(f"Error removing vessel favorite: {e}")
        raise HTTPException(status_code=500, detail="Error eliminando favorito")
    return {"ok": True}


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


# ── SOCIAL FEED ───────────────────────────────────────────────────────────────

@app.get("/social/feed")
@cached("social.feed", ttl=60)
async def get_social_feed(
    limit: int = 50,
    category: str | None = None,
    zone: str | None = None,
    handle: str | None = None,
    q: str | None = None,
    since: datetime | None = None,
    _user: str = Depends(get_current_user),
):
    """
    Feed de tweets de cuentas monitorizadas.
    Lee de TimescaleDB ordenado por tiempo DESC.
    Fallback a Redis stream:social si DB no disponible.
    """
    if app.state.db:
        conditions: list[str] = []
        params: list = []

        if category:
            params.append(category)
            conditions.append(f"category = ${len(params)}")
        if zone:
            params.append(zone)
            conditions.append(f"zone = ${len(params)}")
        if handle:
            params.append(handle)
            conditions.append(f"handle = ${len(params)}")
        if q:
            params.append(f"%{q}%")
            conditions.append(f"content ILIKE ${len(params)}")
        if since:
            params.append(since)
            conditions.append(f"time >= ${len(params)}")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(min(limit, 1000))
        rows = await app.state.db.fetch(
            f"SELECT * FROM social_posts {where} ORDER BY time DESC LIMIT ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows]

    # Fallback Redis
    redis = app.state.redis
    entries = await redis.xrevrange("stream:social", count=min(limit, 1000))
    return [json.loads(msg["data"]) for _, msg in entries]


@app.get("/social/accounts")
@cached("social.accounts", ttl=300)
async def get_social_accounts(_user: str = Depends(get_current_user)):
    """Lista de cuentas monitorizadas con sus metadatos desde social_accounts.yaml."""
    config_path = "/app/config/social_accounts.yaml"
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        return cfg.get("accounts", [])
    except Exception as e:
        log.warning(f"Error leyendo social_accounts.yaml: {e}")
        return []


# ── NEWS FEED ────────────────────────────────────────────────────────────────

@app.get("/news/feed")
@cached("news.feed", ttl=60)
async def get_news_feed(
    limit: int = 50,
    zone: str | None = None,
    country: str | None = None,
    source_type: str | None = None,
    sector: str | None = None,
    severity: str | None = None,
    q: str | None = None,
    since: datetime | None = None,
    _user: str = Depends(get_current_user),
):
    """
    Feed de noticias RSS clasificadas.
    Lee de TimescaleDB con filtros dinámicos, ORDER BY time DESC.
    Fallback a stream:news en Redis si DB no disponible.
    """
    if app.state.db:
        conditions: list[str] = []
        params: list = []

        if zone:
            params.append(zone)
            conditions.append(f"${len(params)} = ANY(zones)")
        if country:
            params.append(country)
            conditions.append(f"source_country = ${len(params)}")
        if source_type:
            params.append(source_type)
            conditions.append(f"source_type = ${len(params)}")
        if sector:
            params.append(sector)
            conditions.append(f"${len(params)} = ANY(sectors)")
        if severity:
            params.append(severity)
            conditions.append(f"severity = ${len(params)}")
        if q:
            params.append(f"%{q}%")
            conditions.append(f"(title ILIKE ${len(params)} OR summary ILIKE ${len(params)})")
        if since:
            params.append(since)
            conditions.append(f"time >= ${len(params)}")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(min(limit, 1000))
        rows = await app.state.db.fetch(
            f"SELECT * FROM news_events {where} ORDER BY time DESC LIMIT ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows]

    # Fallback Redis
    entries = await app.state.redis.xrevrange("stream:news", count=min(limit, 1000))
    return [json.loads(msg["data"]) for _, msg in entries]


@app.get("/news/sources")
@cached("news.sources", ttl=300)
async def get_news_sources(_user: str = Depends(get_current_user)):
    """Lista de fuentes RSS monitorizadas desde news_sources.yaml."""
    config_path = "/app/config/news_sources.yaml"
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        return cfg.get("sources", [])
    except Exception as e:
        log.warning(f"Error leyendo news_sources.yaml: {e}")
        return []


# ── DOCS FEED ─────────────────────────────────────────────────────────────────

@app.get("/docs/feed")
@cached("docs.feed", ttl=120)
async def get_docs_feed(
    limit:      int            = 50,
    org_type:   str | None     = None,
    country:    str | None     = None,
    sector:     str | None     = None,
    severity:   str | None     = None,
    since:      datetime | None = None,
    q:          str | None     = None,
    _user: str = Depends(get_current_user),
):
    """
    Feed de documentos oficiales clasificados.
    Lee de TimescaleDB con filtros dinámicos, ORDER BY time DESC.
    Devuelve lista vacía si DB no disponible.
    """
    if not app.state.db:
        return []

    conditions: list[str] = []
    params: list = []

    if org_type:
        params.append(org_type)
        conditions.append(f"org_type = ${len(params)}")
    if country:
        params.append(country)
        conditions.append(f"source_country = ${len(params)}")
    if sector:
        params.append(sector)
        conditions.append(f"${len(params)} = ANY(sectors)")
    if severity:
        params.append(severity)
        conditions.append(f"severity = ${len(params)}")
    if since:
        params.append(since)
        conditions.append(f"time >= ${len(params)}")
    if q:
        params.append(f"%{q}%")
        conditions.append(f"(title ILIKE ${len(params)} OR summary ILIKE ${len(params)})")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.append(min(limit, 200))
    rows = await app.state.db.fetch(
        f"""SELECT id, time, discovered_at, title, url, source, source_country,
                   org_type, sectors, relevance, severity, page_count,
                   file_size_kb, summary, status
            FROM documents {where}
            ORDER BY time DESC LIMIT ${len(params)}""",
        *params,
    )
    return [dict(r) for r in rows]


@app.get("/docs/sources")
@cached("docs.sources", ttl=300)
async def get_docs_sources(_user: str = Depends(get_current_user)):
    """
    Lista de fuentes de documentos desde doc_sources.yaml.
    Incluye contador de fallos consecutivos desde Redis.
    """
    config_path = "/app/config/doc_sources.yaml"
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        sources = cfg.get("sources", [])
        redis = app.state.redis
        for source in sources:
            failures = await redis.get(f"docs:failures:{source['slug']}")
            source["consecutive_failures"] = int(failures) if failures else 0
        return sources
    except Exception as e:
        log.warning(f"Error leyendo doc_sources.yaml: {e}")
        return []


# ── SEC FILINGS FEED ─────────────────────────────────────────────────────────

@app.get("/sec/feed")
@cached("sec.feed", ttl=120)
async def get_sec_feed(
    limit:     int             = 50,
    sector:    str | None      = None,
    ticker:    str | None      = None,
    form_type: str | None      = None,
    severity:  str | None      = None,
    since:     datetime | None = None,
    q:         str | None      = None,
    _user: str = Depends(get_current_user),
):
    """
    Feed de filings 8-K de empresas S&P 500 geopolíticamente relevantes.
    Lee de TimescaleDB con filtros dinámicos, ORDER BY time DESC.
    Devuelve lista vacía si DB no disponible.
    """
    if not app.state.db:
        return []

    conditions: list[str] = []
    params: list = []

    if sector:
        params.append(sector)
        conditions.append(f"sector = ${len(params)}")
    if ticker:
        params.append(ticker.upper())
        conditions.append(f"ticker = ${len(params)}")
    if form_type:
        params.append(form_type)
        conditions.append(f"form_type = ${len(params)}")
    if severity:
        params.append(severity)
        conditions.append(f"severity = ${len(params)}")
    if since:
        params.append(since)
        conditions.append(f"time >= ${len(params)}")
    if q:
        params.append(f"%{q}%")
        conditions.append(
            f"(ticker ILIKE ${len(params)} OR company_name ILIKE ${len(params)} OR title ILIKE ${len(params)})"
        )

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.append(min(limit, 200))
    rows = await app.state.db.fetch(
        f"""SELECT id, time, discovered_at, ticker, company_name, cik, form_type,
                   accession_number, title, filing_url, sector, severity, relevance,
                   summary, status
            FROM sec_filings {where}
            ORDER BY time DESC LIMIT ${len(params)}""",
        *params,
    )
    return [dict(r) for r in rows]


@app.get("/sec/sources")
@cached("sec.sources", ttl=300)
async def get_sec_sources(_user: str = Depends(get_current_user)):
    """
    Lista de empresas monitorizadas desde sec_sources.yaml.
    Incluye contador de fallos consecutivos desde Redis.
    """
    config_path = "/app/config/sec_sources.yaml"
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        companies = cfg.get("companies", [])
        redis = app.state.redis
        for company in companies:
            failures = await redis.get(f"sec:failures:{company['ticker']}")
            company["consecutive_failures"] = int(failures) if failures else 0
        return companies
    except Exception as e:
        log.warning(f"Error leyendo sec_sources.yaml: {e}")
        return []


# ── POLYMARKET ────────────────────────────────────────────────────────────────

@app.get("/polymarket/feed")
@cached("polymarket.feed", ttl=60)
async def get_polymarket_feed(_user: str = Depends(get_current_user)):
    try:
        raw = await app.state.redis.get("cache:polymarket:markets")
        if raw:
            return json.loads(raw)
    except Exception as e:
        log.warning(f"polymarket feed error: {e}")
    return []


@app.get("/polymarket/analysis")
async def get_polymarket_analysis(_user: str = Depends(get_current_user)):
    redis = app.state.redis
    try:
        cached = await redis.get("cache:polymarket:analysis")
        if cached:
            return json.loads(cached)
    except Exception as e:
        log.warning(f"polymarket analysis cache read: {e}")

    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        return {"picks": [], "summary": "Análisis LLM no disponible (sin API key)", "generated_at": None}

    try:
        markets_raw = await redis.get("cache:polymarket:markets")
        markets = json.loads(markets_raw) if markets_raw else []
    except Exception:
        markets = []

    if not markets:
        return {"picks": [], "summary": "Sin datos de mercados disponibles aún", "generated_at": None}

    try:
        alerts_raw = await redis.xrevrange("stream:alerts", count=10)
        recent_alerts = []
        for _, msg in alerts_raw:
            try:
                recent_alerts.append(json.loads(msg.get("data", "{}")))
            except Exception:
                pass
    except Exception:
        recent_alerts = []

    top_markets = markets[:40]
    market_lines = "\n".join(
        f"- [{m['category'].upper()}] {m['question']} | YES={m['yes_price']:.0%} | Vol=${m['volume']:,.0f}"
        for m in top_markets
    )
    alert_lines = "\n".join(
        f"- [{a.get('severity','?').upper()}] {a.get('title','')}"
        for a in recent_alerts[:5]
    ) or "Sin alertas activas"

    prompt = f"""Eres un analista de inteligencia geopolítica y mercados de predicción.

ALERTAS ACTIVAS EN QILIN:
{alert_lines}

TOP MERCADOS DE PREDICCIÓN (Polymarket):
{market_lines}

TAREA: Selecciona 3-5 mercados que tengan valor especulativo real basado en el contexto geopolítico actual.
Para cada mercado, indica:
1. question (texto exacto)
2. badge: "HIGH VALUE" (precio alejado de extremos con alta incertidumbre real), "WATCH" (movimiento fuerte reciente), o "PRICED IN" (probabilidad ya alta >85%)
3. reasoning (1-2 frases en español explicando por qué es relevante ahora)

Responde SOLO con JSON válido (sin markdown):
{{"summary": "...", "picks": [{{"question": "...", "badge": "...", "reasoning": "..."}}]}}"""

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": anthropic_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": "claude-haiku-4-5-20251001", "max_tokens": 800, "messages": [{"role": "user", "content": prompt}]},
                timeout=30,
            )
            resp.raise_for_status()
            text = resp.json()["content"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            analysis = json.loads(text)
    except Exception as e:
        log.warning(f"polymarket LLM error: {e}")
        analysis = {"picks": [], "summary": "Error generando análisis", "generated_at": None}

    analysis["generated_at"] = datetime.now(timezone.utc).isoformat()
    for pick in analysis.get("picks", []):
        for m in markets:
            if pick.get("question") == m.get("question"):
                pick["market_id"] = m["market_id"]
                pick["yes_price"] = m["yes_price"]
                pick["volume"] = m["volume"]
                pick["slug"] = m.get("slug", "")
                break

    try:
        await redis.set("cache:polymarket:analysis", json.dumps(analysis), ex=1800)
    except Exception as e:
        log.warning(f"polymarket analysis cache write: {e}")

    return analysis


# ── REPORTS ───────────────────────────────────────────────────────────────────

@app.get("/reports")
async def list_reports(
    limit: int = 20,
    _user: str = Depends(get_current_user),
):
    """Lista todos los informes generados, ordenados por fecha desc."""
    if not app.state.db:
        return []
    rows = await app.state.db.fetch(
        """
        SELECT id, report_type, period_start, period_end, generated_at,
               filename, file_size_kb, alert_count, top_severity
        FROM reports
        ORDER BY generated_at DESC LIMIT $1
        """,
        limit,
    )
    return [dict(r) for r in rows]


@app.get("/reports/latest/daily")
async def latest_daily_report(_user: str = Depends(get_current_user)):
    """Devuelve el último informe diario como FileResponse."""
    if not app.state.db:
        raise HTTPException(status_code=503, detail="DB no disponible")
    row = await app.state.db.fetchrow(
        "SELECT file_path, filename FROM reports WHERE report_type='daily' ORDER BY generated_at DESC LIMIT 1"
    )
    if not row:
        raise HTTPException(status_code=404, detail="No hay informes diarios generados")
    path = row["file_path"]
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco")
    return FileResponse(path, media_type="application/pdf", filename=row["filename"])


@app.get("/reports/latest/weekly")
async def latest_weekly_report(_user: str = Depends(get_current_user)):
    """Devuelve el último informe semanal como FileResponse."""
    if not app.state.db:
        raise HTTPException(status_code=503, detail="DB no disponible")
    row = await app.state.db.fetchrow(
        "SELECT file_path, filename FROM reports WHERE report_type='weekly' ORDER BY generated_at DESC LIMIT 1"
    )
    if not row:
        raise HTTPException(status_code=404, detail="No hay informes semanales generados")
    path = row["file_path"]
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco")
    return FileResponse(path, media_type="application/pdf", filename=row["filename"])


@app.get("/reports/{report_id}/download")
async def download_report(
    report_id: int,
    _user: str = Depends(get_current_user),
):
    """Descarga un informe por ID."""
    if not app.state.db:
        raise HTTPException(status_code=503, detail="DB no disponible")
    row = await app.state.db.fetchrow(
        "SELECT file_path, filename FROM reports WHERE id=$1", report_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Informe no encontrado")
    path = row["file_path"]
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=row["filename"],
        headers={"Content-Disposition": f'attachment; filename="{row["filename"]}"'},
    )


class GenerateReportRequest(BaseModel):
    type: str = "daily"    # "daily" or "weekly"
    date: str = ""         # YYYY-MM-DD, defaults to today


@app.post("/reports/generate", status_code=202)
async def generate_report_ondemand(
    req: GenerateReportRequest,
    _user: str = Depends(get_current_user),
):
    """
    Triggers on-demand report generation via Redis queue.
    Returns 202 Accepted immediately; report-engine processes asynchronously.
    """
    if req.type not in ("daily", "weekly"):
        raise HTTPException(status_code=400, detail="type must be 'daily' or 'weekly'")
    date_str = req.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD format")

    payload = json.dumps({"type": req.type, "date": date_str})
    await app.state.redis.rpush("reports:queue", payload)
    log.info(f"[API] Informe on-demand encolado: {req.type} {date_str}")
    return {"status": "accepted", "type": req.type, "date": date_str}


# ── ANALYZED EVENTS ──────────────────────────────────────────────────────────

@app.get("/analyzed-events")
async def get_analyzed_events(
    zone:         str | None = None,
    severity_min: int        = 1,
    event_type:   str | None = None,
    hours:        int        = 24,
    limit:        int        = 50,
    _user: str = Depends(get_current_user),
):
    if not app.state.db:
        return []

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    conditions = ["time >= $1", "severity >= $2"]
    params: list = [since, severity_min]

    if zone:
        params.append(zone)
        conditions.append(f"zone = ${len(params)}")
    if event_type:
        params.append(event_type)
        conditions.append(f"event_type = ${len(params)}")

    params.append(min(limit, 200))
    where = " AND ".join(conditions)
    rows = await app.state.db.fetch(
        f"""SELECT id, time, zone, event_type, severity, confidence,
                   headline, signals_used, recommended_action, tags
            FROM analyzed_events
            WHERE {where}
            ORDER BY time DESC LIMIT ${len(params)}""",
        *params,
    )
    return [dict(r) for r in rows]


@app.get("/analyzed-events/{event_id}")
async def get_analyzed_event(
    event_id: int,
    _user: str = Depends(get_current_user),
):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="DB no disponible")
    row = await app.state.db.fetchrow(
        """SELECT id, time, zone, event_type, severity, confidence,
                  headline, summary, signals_used, market_implications,
                  polymarket_implications, recommended_action, tags,
                  raw_input, processing_time_ms
           FROM analyzed_events WHERE id = $1""",
        event_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return dict(row)


# ── ANALYTICS ────────────────────────────────────────────────────────────────

@app.get("/analytics/summary")
async def get_analytics_summary(
    hours: int = 24,
    _user: str = Depends(get_current_user),
):
    if not app.state.db:
        return {}

    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    rows = await app.state.db.fetch(
        "SELECT severity, event_type, zone, tags FROM analyzed_events WHERE time >= $1",
        since,
    )

    total = len(rows)
    by_severity = {"high": 0, "medium": 0, "low": 0}
    by_type: dict[str, int] = {}
    zone_counts: dict[str, list] = {}
    tag_counts: dict[str, int] = {}
    severity_sum = 0.0

    for r in rows:
        sev = r["severity"] or 0
        severity_sum += sev
        if sev >= 7:
            by_severity["high"] += 1
        elif sev >= 4:
            by_severity["medium"] += 1
        else:
            by_severity["low"] += 1

        etype = r["event_type"] or "UNKNOWN"
        by_type[etype] = by_type.get(etype, 0) + 1

        zone = r["zone"] or "unknown"
        if zone not in zone_counts:
            zone_counts[zone] = []
        zone_counts[zone].append(sev)

        for tag in (r["tags"] or []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    by_zone = sorted(
        [
            {"zone": z, "count": len(sevs), "avg_severity": round(sum(sevs) / len(sevs), 1)}
            for z, sevs in zone_counts.items()
        ],
        key=lambda x: x["count"],
        reverse=True,
    )

    top_tags = sorted(
        [{"tag": t, "count": c} for t, c in tag_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # Market and polymarket signal counts for the period
    market_count = 0
    poly_count = 0
    try:
        row = await app.state.db.fetchrow(
            "SELECT COUNT(*) AS cnt FROM market_signals WHERE time >= $1", since
        )
        market_count = int(row["cnt"]) if row else 0
    except Exception:
        pass
    try:
        row = await app.state.db.fetchrow(
            "SELECT COUNT(*) AS cnt FROM polymarket_signals WHERE time >= $1 AND signal_type IS NOT NULL",
            since,
        )
        poly_count = int(row["cnt"]) if row else 0
    except Exception:
        pass

    return {
        "total_events":            total,
        "by_severity":             by_severity,
        "by_type":                 by_type,
        "by_zone":                 by_zone,
        "top_tags":                top_tags,
        "market_signals_count":    market_count,
        "polymarket_signals_count": poly_count,
        "avg_severity":            round(severity_sum / total, 2) if total else 0.0,
    }


@app.get("/analytics/timeline")
async def get_analytics_timeline(
    hours: int        = 24,
    zone:  str | None = None,
    _user: str = Depends(get_current_user),
):
    if not app.state.db:
        return []

    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Group by hour when ≤72h, by day otherwise
    trunc = "hour" if hours <= 72 else "day"

    conditions = ["time >= $1"]
    params: list = [since]
    if zone:
        params.append(zone)
        conditions.append(f"zone = ${len(params)}")

    where = " AND ".join(conditions)
    rows = await app.state.db.fetch(
        f"""SELECT DATE_TRUNC('{trunc}', time) AS bucket,
                   COUNT(*) AS count,
                   ROUND(AVG(severity)::numeric, 2) AS avg_severity,
                   MAX(severity) AS max_severity
            FROM analyzed_events
            WHERE {where}
            GROUP BY bucket
            ORDER BY bucket""",
        *params,
    )
    return [
        {
            "timestamp":    r["bucket"].isoformat(),
            "count":        int(r["count"]),
            "avg_severity": float(r["avg_severity"] or 0),
            "max_severity": int(r["max_severity"] or 0),
        }
        for r in rows
    ]


# ── SENTINEL ──────────────────────────────────────────────────────────────────

@app.get("/sentinel/zones")
async def get_sentinel_zones(_user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"zones": []}
    try:
        current_rows = await app.state.db.fetch("""
            SELECT DISTINCT ON (zone_id, product)
              zone_id, product, mean_value, baseline_mean, anomaly_ratio, time
            FROM sentinel_observations
            ORDER BY zone_id, product, time DESC
        """)
        history_rows = await app.state.db.fetch("""
            SELECT zone_id, product,
              DATE(time AT TIME ZONE 'UTC') AS date,
              AVG(mean_value) AS value
            FROM sentinel_observations
            WHERE time >= NOW() - INTERVAL '7 days'
            GROUP BY zone_id, product, DATE(time AT TIME ZONE 'UTC')
            ORDER BY zone_id, product, date ASC
        """)
    except Exception as e:
        log.error(f"sentinel/zones error: {e}")
        return {"zones": []}

    zones_map = {}
    for row in current_rows:
        zid = row["zone_id"]
        if zid not in zones_map:
            zones_map[zid] = {"zone_id": zid, "no2": None, "so2": None}
        gas_key = "no2" if row["product"] == "NO2" else "so2"
        zones_map[zid][gas_key] = {
            "current": row["mean_value"],
            "baseline": row["baseline_mean"],
            "ratio": row["anomaly_ratio"],
            "history": [],
        }

    for row in history_rows:
        zid = row["zone_id"]
        if zid not in zones_map:
            continue
        gas_key = "no2" if row["product"] == "NO2" else "so2"
        if zones_map[zid][gas_key] is None:
            continue
        zones_map[zid][gas_key]["history"].append({
            "date": str(row["date"]),
            "value": float(row["value"]) if row["value"] is not None else None,
        })

    return {"zones": list(zones_map.values())}


@app.get("/favorites")
async def get_favorites(user: str = Depends(get_current_user)):
    if not app.state.db:
        return []
    try:
        rows = await app.state.db.fetch(
            "SELECT icao24, callsign, added_at FROM user_favorites WHERE username=$1 ORDER BY added_at DESC",
            user,
        )
        return [
            {"icao24": r["icao24"], "callsign": r["callsign"], "added_at": r["added_at"].isoformat()}
            for r in rows
        ]
    except Exception as e:
        log.error(f"get_favorites error: {e}")
        return []


@app.post("/favorites/{icao24}")
async def add_favorite(icao24: str, req: FavoriteRequest, user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"ok": False}
    try:
        await app.state.db.execute(
            "INSERT INTO user_favorites (username, icao24, callsign) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            user, icao24.lower(), req.callsign,
        )
    except Exception as e:
        log.error(f"add_favorite error: {e}")
        return {"ok": False}
    return {"ok": True}


@app.delete("/favorites/{icao24}")
async def remove_favorite(icao24: str, user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"ok": False}
    try:
        await app.state.db.execute(
            "DELETE FROM user_favorites WHERE username=$1 AND icao24=$2",
            user, icao24.lower(),
        )
    except Exception as e:
        log.error(f"remove_favorite error: {e}")
        return {"ok": False}
    return {"ok": True}


VALID_SOURCE_TYPES = {"news", "social", "docs"}
SOURCE_LIMIT = 10

@app.get("/source-favorites")
async def get_source_favorites(user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"news": [], "social": [], "docs": []}
    try:
        rows = await app.state.db.fetch(
            "SELECT source_type, source_id, source_name, added_at FROM user_source_favorites WHERE username=$1 ORDER BY added_at DESC",
            user,
        )
        result: dict = {"news": [], "social": [], "docs": []}
        for r in rows:
            t = r["source_type"]
            if t in result:
                result[t].append({
                    "source_id": r["source_id"],
                    "source_name": r["source_name"],
                    "added_at": r["added_at"].isoformat(),
                })
        return result
    except Exception as e:
        log.error(f"get_source_favorites error: {e}")
        return {"news": [], "social": [], "docs": []}


@app.post("/source-favorites/{source_type}/{source_id:path}")
async def add_source_favorite(
    source_type: str,
    source_id: str,
    req: SourceFavoriteRequest,
    user: str = Depends(get_current_user),
):
    if source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail="source_type must be news, social, or docs")
    if not app.state.db:
        return {"ok": False}
    try:
        count = await app.state.db.fetchval(
            "SELECT COUNT(*) FROM user_source_favorites WHERE username=$1 AND source_type=$2",
            user, source_type,
        )
        if count >= SOURCE_LIMIT:
            raise HTTPException(status_code=400, detail=f"Limit of {SOURCE_LIMIT} favorites per type reached")
        await app.state.db.execute(
            "INSERT INTO user_source_favorites (username, source_type, source_id, source_name) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
            user, source_type, source_id, req.source_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"add_source_favorite error: {e}")
        return {"ok": False}
    return {"ok": True}


@app.delete("/source-favorites/{source_type}/{source_id:path}")
async def remove_source_favorite(
    source_type: str,
    source_id: str,
    user: str = Depends(get_current_user),
):
    if source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail="source_type must be news, social, or docs")
    if not app.state.db:
        return {"ok": False}
    try:
        await app.state.db.execute(
            "DELETE FROM user_source_favorites WHERE username=$1 AND source_type=$2 AND source_id=$3",
            user, source_type, source_id,
        )
    except Exception as e:
        log.error(f"remove_source_favorite error: {e}")
        return {"ok": False}
    return {"ok": True}


# ── PROFILE ───────────────────────────────────────────────────────────────────

@app.get("/me")
async def get_me(user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"username": user, "email": None, "plan": "free", "created_at": None,
                "topics": [], "telegram_configured": False}
    try:
        row = await app.state.db.fetchrow(
            "SELECT id, username, email, plan, created_at, telegram_chat_id FROM users WHERE username=$1",
            user,
        )
        if not row:
            return {"username": user, "email": None, "plan": "free", "created_at": None,
                    "topics": [], "telegram_configured": False}
        topic_rows = await app.state.db.fetch(
            "SELECT topic_id FROM user_topics WHERE user_id=$1", row["id"]
        )
        return {
            "username": row["username"],
            "email": row["email"],
            "plan": row["plan"] or "free",
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "topics": [r["topic_id"] for r in topic_rows],
            "telegram_configured": bool(row["telegram_chat_id"]),
        }
    except Exception as e:
        log.error("[me] get error: %s", e)
        return {"username": user, "email": None, "plan": "free", "created_at": None,
                "topics": [], "telegram_configured": False}


@app.get("/me/topics")
async def get_my_topics(user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"topics": [], "limit": 2, "plan": "free"}
    try:
        row = await app.state.db.fetchrow(
            "SELECT id, plan FROM users WHERE username=$1", user
        )
        if not row:
            return {"topics": [], "limit": 2, "plan": "free"}
        rows = await app.state.db.fetch(
            "SELECT topic_id FROM user_topics WHERE user_id=$1 ORDER BY created_at ASC",
            row["id"],
        )
        plan = row["plan"] or "free"
        limit = PLAN_LIMITS.get(plan, 2)
        return {"topics": [r["topic_id"] for r in rows], "limit": limit, "plan": plan}
    except Exception as exc:
        log.error("[me/topics] get error: %s", exc)
        raise HTTPException(status_code=503, detail="Error obteniendo topics")


@app.put("/me/topics")
async def put_my_topics(req: TopicsUpdateRequest, user: str = Depends(get_current_user)):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    row = await app.state.db.fetchrow(
        "SELECT id, plan FROM users WHERE username=$1", user
    )
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    plan = row["plan"] or "free"
    limit = PLAN_LIMITS.get(plan, 2)
    if limit is not None and len(req.topics) > limit:
        raise HTTPException(
            status_code=400,
            detail={"error": "exceeds_plan_limit", "limit": limit},
        )
    from topic_utils import load_catalog
    catalog = load_catalog(os.getenv("TOPICS_CONFIG_PATH", "/app/config/topics.yaml"))
    if catalog:  # skip validation if catalog unavailable
        valid_ids = {t["id"] for t in catalog}
        invalid = [tid for tid in req.topics if tid not in valid_ids]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_topic_ids", "ids": invalid},
            )
    user_id = row["id"]
    try:
        async with app.state.db.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "DELETE FROM user_topics WHERE user_id=$1", user_id
                )
                for topic_id in req.topics:
                    await conn.execute(
                        "INSERT INTO user_topics (user_id, topic_id) VALUES ($1, $2) "
                        "ON CONFLICT DO NOTHING",
                        user_id, topic_id,
                    )
    except Exception as exc:
        log.error("[me/topics] put error: %s", exc)
        raise HTTPException(status_code=500, detail="Error guardando topics")
    return {"ok": True}


@app.get("/me/telegram")
async def get_my_telegram(user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"chat_id": None, "configured": False}
    try:
        row = await app.state.db.fetchrow(
            "SELECT telegram_chat_id FROM users WHERE username=$1", user
        )
        chat_id = row["telegram_chat_id"] if row else None
        return {"chat_id": chat_id, "configured": bool(chat_id)}
    except Exception as exc:
        log.error("[me/telegram] get error: %s", exc)
        return {"chat_id": None, "configured": False}


@app.put("/me/telegram")
async def put_my_telegram(req: TelegramUpdateRequest, user: str = Depends(get_current_user)):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    try:
        await app.state.db.execute(
            "UPDATE users SET telegram_chat_id=$1 WHERE username=$2",
            req.chat_id.strip() or None, user,
        )
    except Exception as exc:
        log.error("[me/telegram] put error: %s", exc)
        raise HTTPException(status_code=500, detail="Error guardando Telegram")
    return {"ok": True}


@app.post("/me/telegram/test")
async def test_my_telegram(user: str = Depends(get_current_user)):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    try:
        row = await app.state.db.fetchrow(
            "SELECT telegram_chat_id FROM users WHERE username=$1", user
        )
        chat_id = row["telegram_chat_id"] if row else None
    except Exception as exc:
        log.error("[me/telegram/test] db error: %s", exc)
        raise HTTPException(status_code=503, detail="Error accediendo a la base de datos")
    if not chat_id:
        raise HTTPException(status_code=400, detail={"error": "no_chat_id"})

    token = os.getenv("TELEGRAM_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="Telegram no configurado en el servidor")

    try:
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": "✅ Qilin alert test — your notifications are working."},
                timeout=10,
            )
            resp.raise_for_status()
    except Exception as exc:
        log.warning("[me/telegram/test] error: %s", exc)
        raise HTTPException(status_code=502, detail="No se pudo enviar el mensaje")
    return {"ok": True}


@app.post("/me/password")
async def change_password(req: PasswordChangeRequest, user: str = Depends(get_current_user)):
    if len(req.new_password) < 8:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 8 caracteres")
    if not app.state.db:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    try:
        row = await app.state.db.fetchrow(
            "SELECT password_hash FROM users WHERE username=$1", user
        )
    except Exception as e:
        log.error(f"change_password fetch error: {e}")
        raise HTTPException(status_code=500, detail="Error interno")
    if not row:
        raise HTTPException(status_code=403, detail="Contraseña gestionada por el administrador")
    loop = asyncio.get_event_loop()
    try:
        match = await loop.run_in_executor(
            None, lambda: bcrypt.checkpw(req.current_password.encode(), row["password_hash"].encode())
        )
    except Exception:
        match = False
    if not match:
        raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")
    new_hash = await loop.run_in_executor(
        None, lambda: bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt(12)).decode()
    )
    try:
        await app.state.db.execute(
            "UPDATE users SET password_hash=$1 WHERE username=$2", new_hash, user
        )
    except Exception as e:
        log.error(f"change_password update error: {e}")
        raise HTTPException(status_code=500, detail="Error al actualizar la contraseña")
    return {"ok": True}


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


# ── CHATBOT ───────────────────────────────────────────────────────────────────

_CHAT_SYSTEM = """Eres el asistente de Qilin, una plataforma de inteligencia geopolítica en tiempo real.

Responde SOLO sobre estos temas:
- Qué es Qilin y cómo funciona
- Secciones del dashboard: Inicio (resumen estadístico), Mapa táctico (aviones y buques en tiempo real con trails), Alertas geopolíticas, Noticias (104 medios geopolíticos), Social (cuentas X/Twitter relevantes), Mercados (Polymarket — predicciones), Documentos y filings SEC
- Interpretación de datos: aviones militares (triángulo rojo), civiles (cyan), VIP/billonarios/presidentes (dorado), buques AIS, alertas con severidad alta/media/baja
- Fuentes de datos: ADS-B vía Airplanes.live (aeronaves militares globales), AIS vía AISStream (buques), RSS de 104 medios geopolíticos, RSSHub para Twitter/X, Polymarket, Copernicus Sentinel-5P (NO₂/SO₂ por zona), filings SEC de empresas de defensa
- Aeronaves VIP monitorizadas: jefes de estado, billonarios tech (Musk, Bezos, Zuckerberg...), magnates financieros, oligarcas rusos
- Reglas de alerta: surge militar (≥5 aviones en zona), patrullas ASW, AIS dark (buques tanker que apagan señal), grupos navales (≥3 buques militares)
- Motor de alertas: correlación con LLM (Claude Haiku), notificaciones Telegram, cooldown 1h por regla+zona

Si te preguntan algo fuera de Qilin o inteligencia geopolítica, responde amablemente que solo puedes ayudar con la plataforma.
Sé conciso. Responde en el idioma del usuario."""


@app.post("/chat")
async def chat(req: ChatRequest, _user: str = Depends(get_current_user)):
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        raise HTTPException(status_code=503, detail="Chatbot no disponible (sin API key)")

    messages = [{"role": m.role, "content": m.content} for m in req.messages[-10:]]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": anthropic_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 400,
                    "system": _CHAT_SYSTEM,
                    "messages": messages,
                },
                timeout=30,
            )
            resp.raise_for_status()
            reply = resp.json()["content"][0]["text"].strip()
            return {"reply": reply}
    except Exception as e:
        log.warning(f"chat error: {e}")
        raise HTTPException(status_code=500, detail="Error del chatbot")


# ── Markets ────────────────────────────────────────────────────────────────────

@app.get("/markets/quotes")
@cached("markets.quotes", ttl=60)
async def get_market_quotes(_user: str = Depends(get_current_user)):
    redis = app.state.redis
    cached = await redis.get("cache:markets:quotes")
    if cached:
        return json.loads(cached)

    symbols = [a["symbol"] for a in MARKET_ASSETS]

    def _fetch():
        tickers_obj = yf.Tickers(" ".join(symbols))
        results = []
        for asset in MARKET_ASSETS:
            sym = asset["symbol"]
            try:
                fi = tickers_obj.tickers[sym].fast_info
                price = fi.last_price
                prev  = fi.previous_close
                pct   = round((price - prev) / prev * 100, 2) if prev else None
                results.append({
                    "symbol":     sym,
                    "name":       asset["name"],
                    "group":      asset["group"],
                    "price":      round(price, 4) if price is not None else None,
                    "change_pct": pct,
                    "currency":   getattr(fi, "currency", None),
                })
            except Exception:
                results.append({
                    "symbol": sym, "name": asset["name"], "group": asset["group"],
                    "price": None, "change_pct": None, "currency": None,
                })
        return results

    loop = asyncio.get_event_loop()
    try:
        quotes = await loop.run_in_executor(None, _fetch)
    except Exception as e:
        log.error(f"Error fetching market quotes: {e}")
        raise HTTPException(status_code=503, detail="Error fetching market data")

    await redis.setex("cache:markets:quotes", 300, json.dumps(quotes))
    return quotes


@app.get("/markets/history")
async def get_market_history(
    symbol: str,
    period: str = "1mo",
    _user: str = Depends(get_current_user),
):
    if period not in _PERIOD_INTERVAL:
        raise HTTPException(status_code=400, detail=f"period must be one of {list(_PERIOD_INTERVAL)}")
    if symbol not in _VALID_SYMBOLS:
        raise HTTPException(status_code=400, detail="Unknown symbol")

    cache_key = f"cache:markets:history:{symbol}:{period}"
    redis = app.state.redis
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    interval = _PERIOD_INTERVAL[period]

    def _fetch():
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period=period, interval=interval)
        rows   = []
        for ts, row in hist.iterrows():
            rows.append({
                "time":   int(ts.timestamp()),
                "open":   round(float(row["Open"]),   4),
                "high":   round(float(row["High"]),   4),
                "low":    round(float(row["Low"]),    4),
                "close":  round(float(row["Close"]),  4),
                "volume": int(row["Volume"]),
            })
        return rows

    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(None, _fetch)
    except Exception as e:
        log.error(f"Error fetching history for {symbol}: {e}")
        raise HTTPException(status_code=503, detail="Error fetching market history")

    await redis.setex(cache_key, 3600, json.dumps(data))
    return data


@app.get("/intel/timeline")
@cached("intel.timeline", ttl=30)
async def intel_timeline(
    hours: int = 48,
    min_score: int = 0,
    domain: str = "all",
    _user: str = Depends(get_current_user),
):
    """Unified timeline: master analyses + agent findings, DESC."""
    db = app.state.db
    if not db:
        return {"items": [], "count": 0}
    hours = max(1, min(hours, 168))

    masters = await db.fetch(
        """
        SELECT id, time, cycle_id, zone, event_type, severity, confidence,
               headline, summary, signals_used, recommended_action, tags
        FROM analyzed_events
        WHERE time >= NOW() - $1::interval
          AND cycle_id IS NOT NULL
          AND severity >= $2
        ORDER BY time DESC
        LIMIT 200
        """,
        timedelta(hours=hours), min_score,
    )
    domain_filter = ""
    params: list = [timedelta(hours=hours), min_score]
    if domain and domain != "all":
        domain_filter = " AND agent_name = $3"
        params.append(f"{domain}_agent")
    findings = await db.fetch(
        f"""
        SELECT id, time, cycle_id, agent_name, anomaly_score, summary,
               raw_output, tools_called, duration_ms, telegram_sent
        FROM agent_findings
        WHERE time >= NOW() - $1::interval
          AND anomaly_score >= $2
          {domain_filter}
        ORDER BY time DESC
        LIMIT 500
        """,
        *params,
    )

    items = []
    for m in masters:
        items.append({
            "type": "master",
            "time": m["time"].isoformat(),
            "cycle_id": str(m["cycle_id"]) if m["cycle_id"] else None,
            "zone": m["zone"],
            "event_type": m["event_type"],
            "severity": m["severity"],
            "confidence": m["confidence"],
            "headline": m["headline"],
            "summary": m["summary"],
            "signals_used": m["signals_used"],
            "recommended_action": m["recommended_action"],
            "tags": m["tags"],
        })
    for f in findings:
        raw = f["raw_output"]
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = {}
        items.append({
            "type": "finding",
            "time": f["time"].isoformat(),
            "cycle_id": str(f["cycle_id"]) if f["cycle_id"] else None,
            "agent_name": f["agent_name"],
            "anomaly_score": f["anomaly_score"],
            "summary": f["summary"],
            "raw_output": raw,
            "tools_called": f["tools_called"],
            "duration_ms": f["duration_ms"],
            "telegram_sent": f["telegram_sent"],
        })
    items.sort(key=lambda x: x["time"], reverse=True)
    return {"items": items, "count": len(items)}


@app.get("/intel/cycle/{cycle_id}")
async def intel_cycle(cycle_id: str, _user: str = Depends(get_current_user)):
    db = app.state.db
    if not db:
        return {"master": None, "findings": []}
    master_row = await db.fetchrow(
        "SELECT * FROM analyzed_events WHERE cycle_id = $1 ORDER BY time DESC LIMIT 1",
        cycle_id,
    )
    findings = await db.fetch(
        "SELECT * FROM agent_findings WHERE cycle_id = $1 ORDER BY time ASC",
        cycle_id,
    )

    def _row_to_dict(r):
        d = dict(r)
        for k, v in list(d.items()):
            if isinstance(v, datetime):
                d[k] = v.isoformat()
            elif hasattr(v, "hex"):  # UUID
                d[k] = str(v)
        return d

    return {
        "master": _row_to_dict(master_row) if master_row else None,
        "findings": [_row_to_dict(r) for r in findings],
    }


@app.get("/intel/spend")
@cached("intel.spend", ttl=10)
async def intel_spend(_user: str = Depends(get_current_user)):
    """Current day's AI spend (USD)."""
    today = date.today().isoformat()
    key = f"daily_spend:{today}"
    cap = float(os.getenv("DAILY_SPEND_CAP", "5.00"))
    redis = app.state.redis
    raw = await redis.get(key) if redis else None
    spent = float(raw) if raw else 0.0
    return {"date": today, "spent_usd": round(spent, 4), "cap_usd": cap}


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
    last_ids = {"stream:alerts": "$", "stream:intel": "$"}

    try:
        while True:
            results = await redis.xread(last_ids, count=10, block=500)
            for stream_name, messages in (results or []):
                for msg_id, msg in messages:
                    if stream_name == "stream:intel":
                        await ws.send_json({"type": "intel", "data": msg})
                    else:
                        try:
                            payload = json.loads(msg["data"])
                        except Exception:
                            payload = msg
                        await ws.send_json({"type": "alert", "data": payload})
                    last_ids[stream_name] = msg_id
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        log.error(f"WebSocket error: {e}")
        manager.disconnect(ws)
