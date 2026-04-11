"""
Qilin — API
FastAPI con WebSockets para el dashboard en tiempo real.
"""

import asyncio
import json
import logging
import os

import asyncpg
import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [API] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL    = os.getenv("DB_URL", "")

app = FastAPI(title="Qilin API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── CONEXIONES ───────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    app.state.db    = await asyncpg.connect(DB_URL)
    log.info("Qilin API lista.")


@app.on_event("shutdown")
async def shutdown():
    await app.state.db.close()


# ─── REST ENDPOINTS ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "qilin-api"}


@app.get("/alerts")
async def get_alerts(limit: int = 50, zone: str | None = None):
    """Últimas alertas, opcionalmente filtradas por zona."""
    if zone:
        rows = await app.state.db.fetch(
            "SELECT * FROM alerts WHERE zone=$1 ORDER BY time DESC LIMIT $2",
            zone, limit
        )
    else:
        rows = await app.state.db.fetch(
            "SELECT * FROM alerts ORDER BY time DESC LIMIT $1", limit
        )
    return [dict(r) for r in rows]


@app.get("/aircraft")
async def get_aircraft():
    """Posiciones actuales de aeronaves (desde cache Redis)."""
    redis = app.state.redis
    keys  = await redis.keys("current:aircraft:*")
    if not keys:
        return []
    values = await redis.mget(*keys)
    return [json.loads(v) for v in values if v]


@app.get("/vessels")
async def get_vessels():
    """Posiciones actuales de embarcaciones (desde cache Redis)."""
    redis = app.state.redis
    keys  = await redis.keys("current:vessel:*")
    if not keys:
        return []
    values = await redis.mget(*keys)
    return [json.loads(v) for v in values if v]


# ─── WEBSOCKET ────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, msg: dict):
        for ws in list(self.active):
            try:
                await ws.send_json(msg)
            except Exception:
                self.active.remove(ws)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    redis = app.state.redis
    last_alert_id = "$"
    try:
        while True:
            # Enviar nuevas alertas al cliente
            results = await redis.xread({"stream:alerts": last_alert_id}, count=10, block=500)
            for _, messages in (results or []):
                for msg_id, msg in messages:
                    await ws.send_json({"type": "alert", "data": json.loads(msg["data"])})
                    last_alert_id = msg_id
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        manager.disconnect(ws)
