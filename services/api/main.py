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
import yaml
import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status, BackgroundTasks
from fastapi.responses import FileResponse
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


# ── SOCIAL FEED ───────────────────────────────────────────────────────────────

@app.get("/social/feed")
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
        params.append(min(limit, 200))
        rows = await app.state.db.fetch(
            f"SELECT * FROM social_posts {where} ORDER BY time DESC LIMIT ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows]

    # Fallback Redis
    redis = app.state.redis
    entries = await redis.xrevrange("stream:social", count=min(limit, 200))
    return [json.loads(msg["data"]) for _, msg in entries]


@app.get("/social/accounts")
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
        params.append(min(limit, 200))
        rows = await app.state.db.fetch(
            f"SELECT * FROM news_events {where} ORDER BY time DESC LIMIT ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows]

    # Fallback Redis
    entries = await app.state.redis.xrevrange("stream:news", count=min(limit, 200))
    return [json.loads(msg["data"]) for _, msg in entries]


@app.get("/news/sources")
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
