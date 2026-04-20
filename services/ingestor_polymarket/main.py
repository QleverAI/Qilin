import asyncio
import httpx
import redis.asyncio as aioredis
import asyncpg
import os
import json
import logging
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [POLYMARKET] %(message)s",
)
log = logging.getLogger(__name__)

POLYMARKET_MARKETS_URL = "https://clob.polymarket.com/markets"

POLL_INTERVAL = int(os.getenv("POLYMARKET_POLL_INTERVAL", "300"))
DB_URL = os.getenv("DB_URL", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
MIN_VOLUME = float(os.getenv("POLYMARKET_MIN_VOLUME", "1000"))
MAX_MARKETS = int(os.getenv("POLYMARKET_MAX_MARKETS", "500"))

RELEVANT_TAGS = {
    "politics", "political", "geopolitics", "geopolitical", "conflict",
    "economics", "economy", "energy", "finance", "war", "elections",
    "sanctions", "trade", "military",
}

ZONE_KEYWORDS: dict[str, list[str]] = {
    "north_america": ["usa", "united states", "america", "mexico", "canada", "trump", "harris", "us election", "us president"],
    "europe": ["europe", "european", "france", "germany", "britain", "uk", "nato", "eu", "macron", "scholz", "italy", "spain", "poland"],
    "china": ["china", "taiwan", "chinese", "beijing", "hong kong", "xi jinping", "pla", "ccp"],
    "korea": ["korea", "north korea", "south korea", "pyongyang", "kim jong"],
    "iran": ["iran", "iranian", "tehran", "irgc", "nuclear deal", "khamenei"],
    "gulf_ormuz": ["gulf", "hormuz", "persian gulf", "saudi", "uae", "emirates", "opec", "aramco"],
    "iraq_syria": ["iraq", "syria", "iraqi", "syrian", "baghdad", "damascus", "isis", "isil"],
    "yemen": ["yemen", "yemeni", "houthi", "red sea", "bab el mandeb"],
    "levante": ["israel", "gaza", "hamas", "hezbollah", "lebanon", "west bank", "palestin", "idf", "netanyahu"],
    "libya": ["libya", "libyan", "tripoli", "benghazi"],
    "ukraine_black_sea": ["ukraine", "russia", "russian", "putin", "zelensky", "black sea", "crimea", "donbas", "kyiv", "moscow"],
    "baltic_sea": ["baltic", "finland", "sweden", "estonia", "latvia", "lithuania", "kaliningrad"],
    "south_caucasus": ["armenia", "azerbaijan", "nagorno", "karabakh", "caucasus", "georgia"],
    "india_pakistan": ["india", "pakistan", "kashmir", "modi", "bangladesh"],
    "south_china_sea": ["south china sea", "philippines", "vietnam", "spratly", "paracel"],
    "sahel": ["mali", "niger", "burkina", "sahel", "chad", "sudan", "wagner"],
    "somalia_horn": ["somalia", "horn of africa", "somali", "aden"],
    "venezuela": ["venezuela", "maduro", "guyana", "essequibo"],
    "myanmar": ["myanmar", "burma", "burmese", "junta"],
}


def detect_zones(question: str) -> list[str]:
    q = question.lower()
    return [zone for zone, kws in ZONE_KEYWORDS.items() if any(kw in q for kw in kws)]


def is_relevant(market: dict) -> bool:
    if not market.get("active") or market.get("closed"):
        return False
    volume = float(market.get("volume", 0) or 0)
    if volume < MIN_VOLUME:
        return False
    tags = {t.get("label", "").lower() for t in (market.get("tags") or [])}
    if tags & RELEVANT_TAGS:
        return True
    question = market.get("question", "").lower()
    for kws in ZONE_KEYWORDS.values():
        if any(kw in question for kw in kws):
            return True
    return False


async def fetch_relevant_markets(client: httpx.AsyncClient) -> list[dict]:
    relevant: list[dict] = []
    next_cursor = ""
    total_fetched = 0

    while total_fetched < MAX_MARKETS:
        params: dict = {"limit": 100}
        if next_cursor:
            params["next_cursor"] = next_cursor
        try:
            resp = await client.get(POLYMARKET_MARKETS_URL, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            log.error(f"Error fetching markets: {exc}")
            break

        batch = data.get("data", [])
        for m in batch:
            if is_relevant(m):
                relevant.append(m)
        total_fetched += len(batch)

        next_cursor = data.get("next_cursor", "")
        if not next_cursor or next_cursor == "LTE=":
            break

    log.info(f"Fetched {total_fetched} markets total, {len(relevant)} relevant")
    return relevant


async def process_market(
    market: dict,
    redis_client: aioredis.Redis,
    db: asyncpg.Connection | None,
) -> dict | None:
    market_id = market.get("condition_id") or market.get("market_slug", "")
    if not market_id:
        return None

    question = market.get("question", "")

    yes_price: float | None = None
    for token in market.get("tokens") or []:
        if token.get("outcome", "").upper() == "YES":
            try:
                yes_price = float(token.get("price", 0))
            except (TypeError, ValueError):
                pass
            break
    if yes_price is None or not (0.0 < yes_price < 1.0):
        return None

    zones = detect_zones(question)
    tags = [t.get("label", "") for t in (market.get("tags") or [])]
    category = tags[0] if tags else "unknown"
    volume = float(market.get("volume", 0) or 0)

    key_1h = f"polymarket:price_1h:{market_id}"
    key_24h = f"polymarket:price_24h:{market_id}"
    key_extreme_cd = f"polymarket:extreme_cd:{market_id}"

    stored_1h = await redis_client.get(key_1h)
    stored_24h = await redis_client.get(key_24h)

    prev_1h = float(stored_1h) if stored_1h else None
    prev_24h = float(stored_24h) if stored_24h else None

    # Snapshots expire and auto-refresh: 1h window = 75 min TTL, 24h = 25h TTL
    await redis_client.set(key_1h, str(yes_price), ex=4500, nx=True)
    await redis_client.set(key_24h, str(yes_price), ex=90000, nx=True)

    signals: list[str] = []
    change_1h: float | None = None
    change_24h: float | None = None

    if prev_1h is not None and prev_1h > 0:
        change_1h = (yes_price - prev_1h) / prev_1h
        if abs(change_1h) >= 0.05:
            signals.append("MOMENTUM")

    if prev_24h is not None and prev_24h > 0:
        change_24h = (yes_price - prev_24h) / prev_24h
        if abs(change_24h) >= 0.15:
            signals.append("STRONG_MOVE")

    # Extreme probability — 3h cooldown to avoid repeated alerts
    current_extreme = "HIGH" if yes_price >= 0.75 else ("LOW" if yes_price <= 0.25 else None)
    if current_extreme:
        extreme_stored = await redis_client.get(key_extreme_cd)
        stored_val = extreme_stored if extreme_stored else None
        if stored_val != current_extreme:
            signals.append(f"EXTREME_{current_extreme}")
            await redis_client.setex(key_extreme_cd, 10800, current_extreme)

    if not signals:
        return None

    now = datetime.now(timezone.utc)
    signal: dict = {
        "time": now.isoformat(),
        "market_id": market_id,
        "question": question,
        "category": category,
        "yes_price": yes_price,
        "prev_1h_price": prev_1h,
        "prev_24h_price": prev_24h,
        "change_1h": change_1h,
        "change_24h": change_24h,
        "signal_type": ",".join(signals),
        "zones": zones,
        "volume": volume,
        "end_date": market.get("end_date_iso"),
    }

    if db:
        try:
            end_dt = None
            if signal["end_date"]:
                try:
                    end_dt = datetime.fromisoformat(
                        signal["end_date"].replace("Z", "+00:00")
                    )
                except Exception:
                    pass
            await db.execute(
                """
                INSERT INTO polymarket_signals (
                    time, market_id, question, category, yes_price,
                    prev_1h_price, prev_24h_price, change_1h, change_24h,
                    signal_type, zones, volume, end_date
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                """,
                now,
                signal["market_id"],
                signal["question"],
                signal["category"],
                signal["yes_price"],
                signal["prev_1h_price"],
                signal["prev_24h_price"],
                signal["change_1h"],
                signal["change_24h"],
                signal["signal_type"],
                signal["zones"] or [],
                signal["volume"],
                end_dt,
            )
        except Exception as exc:
            log.warning(f"DB insert error for {market_id}: {exc}")

    return signal


async def publish_signal(redis_client: aioredis.Redis, signal: dict) -> None:
    payload = {
        k: json.dumps(v) if isinstance(v, list) else ("" if v is None else str(v))
        for k, v in signal.items()
    }
    await redis_client.xadd("stream:polymarket", payload, maxlen=1000)
    chg_1h = f"{signal['change_1h']*100:+.1f}%" if signal["change_1h"] is not None else "n/a"
    log.info(
        f"[SIGNAL] {signal['signal_type']} | {signal['question'][:60]} "
        f"| p={signal['yes_price']:.2f} | Δ1h={chg_1h}"
    )


async def poll_loop(redis_client: aioredis.Redis, db: asyncpg.Connection | None) -> None:
    async with httpx.AsyncClient() as client:
        while True:
            try:
                markets = await fetch_relevant_markets(client)
                emitted = 0
                for market in markets:
                    signal = await process_market(market, redis_client, db)
                    if signal:
                        await publish_signal(redis_client, signal)
                        emitted += 1
                log.info(f"Poll completo: {len(markets)} mercados relevantes, {emitted} señales")
            except Exception as exc:
                log.error(f"Error en poll: {exc}")
            await asyncio.sleep(POLL_INTERVAL)


async def main() -> None:
    log.info("Ingestor Polymarket iniciando...")

    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

    db: asyncpg.Connection | None = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB")
        except Exception as exc:
            log.warning(f"Sin conexión a DB, continuando sin persistencia: {exc}")

    try:
        await poll_loop(redis_client, db)
    finally:
        await redis_client.aclose()
        if db:
            await db.close()


if __name__ == "__main__":
    asyncio.run(main())
