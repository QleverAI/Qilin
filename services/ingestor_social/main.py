"""
Qilin — Ingestor Social (X / Twitter)
Fuente: X API v2 Basic — Bearer token de app, sin OAuth de usuario.

Estrategia:
  1. Arranque: resuelve handles a user IDs en grupos de 100.
  2. Cada SOCIAL_POLL_INTERVAL segundos: GET /2/users/:id/tweets por cuenta.
  3. Deduplica por tweet_id en Redis (TTL 24h).
  4. Publica en stream:social + persiste en social_posts (TimescaleDB).
  5. Cuentas con priority=high se procesan primero cada ciclo.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import asyncpg
import httpx
import redis.asyncio as aioredis
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SOCIAL] %(message)s")
log = logging.getLogger(__name__)

BASE_URL      = "https://api.twitter.com/2"
BEARER_TOKEN  = os.getenv("X_BEARER_TOKEN", "")
REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL        = os.getenv("DB_URL", "")
POLL_INTERVAL = int(os.getenv("SOCIAL_POLL_INTERVAL", "900"))  # 15 min por defecto
DAILY_CAP     = int(os.getenv("TWITTER_DAILY_CAP", "300"))


# ── Carga de configuracion ─────────────────────────────────────────────────────

def load_accounts() -> list[dict]:
    with open("/app/config/social_accounts.yaml") as f:
        cfg = yaml.safe_load(f)
    return cfg["accounts"]


# ── Quota guards ───────────────────────────────────────────────────────────────

async def get_quota(redis, cap: int = DAILY_CAP) -> tuple[int, bool]:
    """
    Obtiene el contador de tweets del dia y retorna (count, reached_cap).
    """
    key = f"twitter:quota:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    val = await redis.get(key)
    count = int(val) if val else 0
    return count, count >= cap


async def increment_quota(redis) -> int:
    """
    Incrementa el contador de tweets del dia. Retorna el nuevo contador.
    Si es el primer incremento del dia, establece TTL de 90000 segundos.
    """
    key = f"twitter:quota:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 90000)
    return count


# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_tweet(raw: dict, account: dict, media_map: dict) -> dict:
    """
    Convierte un tweet de la API v2 al formato interno de Qilin.
    media_map: {media_key: {type, url, preview_image_url}}
    """
    media_url = None
    media_type = None
    keys = raw.get("attachments", {}).get("media_keys", [])
    if keys and keys[0] in media_map:
        m = media_map[keys[0]]
        media_type = m.get("type")
        media_url = m.get("url") or m.get("preview_image_url")

    metrics = raw.get("public_metrics", {})
    tweet_id = raw["id"]

    return {
        "tweet_id":   tweet_id,
        "handle":     account["handle"],
        "display":    account["display"],
        "category":   account["category"],
        "zone":       account["zone"],
        "content":    raw["text"],
        "lang":       raw.get("lang"),
        "likes":      metrics.get("like_count", 0),
        "retweets":   metrics.get("retweet_count", 0),
        "url":        f"https://x.com/{account['handle']}/status/{tweet_id}",
        "media_url":  media_url,
        "media_type": media_type,
        "time":       raw.get("created_at", datetime.now(timezone.utc).isoformat()),
    }


# ── HTTP helpers ───────────────────────────────────────────────────────────────

async def resolve_user_ids(client: httpx.AsyncClient, accounts: list[dict]) -> dict[str, str]:
    """
    Resuelve handles a user IDs numericos en batches de 100.
    Devuelve {handle_lower: user_id}.
    """
    id_map: dict[str, str] = {}
    for i in range(0, len(accounts), 100):
        batch = accounts[i:i + 100]
        handles = ",".join(a["handle"] for a in batch)
        try:
            r = await client.get(
                f"{BASE_URL}/users/by",
                params={"usernames": handles, "user.fields": "id,name"},
                timeout=15,
            )
            if r.status_code == 200:
                for u in r.json().get("data", []):
                    id_map[u["username"].lower()] = u["id"]
            else:
                log.warning(f"Error resolviendo IDs batch {i}: HTTP {r.status_code}")
        except Exception as e:
            log.warning(f"Error resolviendo IDs batch {i}: {e}")
        await asyncio.sleep(1)
    return id_map


async def fetch_user_tweets(
    client: httpx.AsyncClient, user_id: str
) -> tuple[list[dict], dict[str, dict]]:
    """
    Devuelve (tweets, media_map) para un user_id.
    En caso de 429 espera el tiempo indicado por x-rate-limit-reset.
    """
    try:
        r = await client.get(
            f"{BASE_URL}/users/{user_id}/tweets",
            params={
                "max_results": 10,
                "tweet.fields": "created_at,public_metrics,lang,attachments",
                "expansions": "attachments.media_keys",
                "media.fields": "url,preview_image_url,type",
            },
            timeout=15,
        )
        if r.status_code == 429:
            reset = int(r.headers.get("x-rate-limit-reset", "60"))
            wait  = max(reset - int(datetime.now(timezone.utc).timestamp()), 10)
            log.warning(f"Rate limit — esperando {wait}s")
            await asyncio.sleep(wait)
            return [], {}
        if r.status_code != 200:
            log.warning(f"HTTP {r.status_code} para user {user_id}")
            return [], {}
        data = r.json()
        tweets    = data.get("data", []) or []
        media_map = {
            m["media_key"]: m
            for m in data.get("includes", {}).get("media", [])
        }
        return tweets, media_map
    except Exception as e:
        log.warning(f"Error fetching tweets user {user_id}: {e}")
        return [], {}


# ── Publicacion ───────────────────────────────────────────────────────────────

async def publish(redis, db, tweet: dict) -> bool:
    """
    Publica tweet nuevo en Redis stream y TimescaleDB.
    Retorna True si era nuevo, False si ya existia (deduplicacion).
    """
    key = f"current:tweet:{tweet['tweet_id']}"
    if await redis.exists(key):
        return False

    payload = json.dumps(tweet)
    await redis.setex(key, 86400, payload)
    await redis.xadd("stream:social", {"data": payload}, maxlen=2000)
    await increment_quota(redis)

    if db:
        try:
            async with db.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO social_posts
                        (time, tweet_id, handle, display, category, zone,
                         content, lang, likes, retweets, url, media_url, media_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (tweet_id) DO NOTHING
                    """,
                    tweet["time"], tweet["tweet_id"], tweet["handle"],
                    tweet["display"], tweet["category"], tweet["zone"],
                    tweet["content"], tweet["lang"], tweet["likes"],
                    tweet["retweets"], tweet["url"],
                    tweet["media_url"], tweet["media_type"],
                )
        except Exception as e:
            log.error(f"Error guardando tweet {tweet['tweet_id']} en DB: {e}")

    return True


# ── Loop principal ─────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin Social ingestor (X/Twitter) arrancando...")

    if not BEARER_TOKEN:
        log.error("X_BEARER_TOKEN no configurado — saliendo.")
        return

    accounts = load_accounts()
    log.info(f"Cargadas {len(accounts)} cuentas desde social_accounts.yaml")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.create_pool(DB_URL, min_size=1, max_size=3)
            log.info("Pool TimescaleDB creado.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Tweets no se persistiran.")

    headers = {
        "Authorization": f"Bearer {BEARER_TOKEN}",
        "User-Agent":    "Qilin/1.0 geopolitical-intelligence-platform",
    }

    async with httpx.AsyncClient(headers=headers) as client:
        log.info("Resolviendo user IDs de X...")
        id_map = await resolve_user_ids(client, accounts)
        log.info(f"Resueltos {len(id_map)}/{len(accounts)} user IDs")

        # high priority primero cada ciclo
        ordered = (
            [a for a in accounts if a.get("priority") == "high"] +
            [a for a in accounts if a.get("priority") != "high"]
        )

        while True:
            count, reached = await get_quota(redis)
            if reached:
                log.warning(f"Cuota diaria alcanzada ({count}/{DAILY_CAP}) — esperando hasta mañana")
                await asyncio.sleep(3600)
                continue

            new_count = 0

            for account in ordered:
                handle  = account["handle"].lower()
                user_id = id_map.get(handle)
                if not user_id:
                    log.warning(f"Sin user ID para @{account['handle']} — omitido")
                    continue

                tweets, media_map = await fetch_user_tweets(client, user_id)
                for raw in tweets:
                    tweet = parse_tweet(raw, account, media_map)
                    if await publish(redis, db, tweet):
                        new_count += 1

                await asyncio.sleep(1)  # 1s entre cuentas — cortesia rate limit

            log.info(f"Ciclo completo — {new_count} tweets nuevos de {len(ordered)} cuentas")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
