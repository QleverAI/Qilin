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

GAMMA_URL    = "https://gamma-api.polymarket.com/markets"
POLL_INTERVAL = int(os.getenv("POLYMARKET_POLL_INTERVAL", "300"))
DB_URL        = os.getenv("DB_URL", "")
REDIS_URL     = os.getenv("REDIS_URL", "redis://redis:6379")
MIN_VOLUME    = float(os.getenv("POLYMARKET_MIN_VOLUME", "5000"))
MAX_OFFSET    = int(os.getenv("POLYMARKET_MAX_MARKETS", "2000"))

ZONE_KEYWORDS: dict[str, list[str]] = {
    "north_america":   ["usa", "united states", "america", "mexico", "canada", "trump", "harris", "us election", "us president"],
    "europe":          ["europe", "european", "france", "germany", "britain", "uk", "nato", "eu", "macron", "italy", "spain", "poland"],
    "china":           ["china", "taiwan", "chinese", "beijing", "hong kong", "xi jinping", "pla", "ccp"],
    "korea":           ["korea", "north korea", "south korea", "pyongyang", "kim jong"],
    "iran":            ["iran", "iranian", "tehran", "irgc", "nuclear deal", "khamenei"],
    "gulf_ormuz":      ["gulf", "hormuz", "persian gulf", "saudi", "uae", "emirates", "opec", "aramco"],
    "iraq_syria":      ["iraq", "syria", "iraqi", "syrian", "baghdad", "damascus", "isis"],
    "yemen":           ["yemen", "yemeni", "houthi", "red sea", "bab el mandeb"],
    "levante":         ["israel", "gaza", "hamas", "hezbollah", "lebanon", "west bank", "palestin", "idf", "netanyahu"],
    "ukraine_black_sea": ["ukraine", "russia", "russian", "putin", "zelensky", "black sea", "crimea", "donbas", "kyiv"],
    "baltic_sea":      ["baltic", "finland", "sweden", "estonia", "latvia", "lithuania", "kaliningrad"],
    "south_caucasus":  ["armenia", "azerbaijan", "nagorno", "karabakh", "caucasus", "georgia"],
    "india_pakistan":  ["india", "pakistan", "kashmir", "modi", "bangladesh"],
    "south_china_sea": ["south china sea", "philippines", "vietnam", "spratly", "paracel"],
    "sahel":           ["mali", "niger", "burkina", "sahel", "chad", "sudan", "wagner"],
    "venezuela":       ["venezuela", "maduro", "guyana", "essequibo"],
}

GEO_KEYWORDS = {
    "war", "ceasefire", "invasion", "conflict", "military", "nato", "sanction",
    "election", "president", "prime minister", "minister", "government", "coup",
    "nuclear", "missile", "drone", "attack", "strike", "bomb",
    "oil", "gas", "energy", "opec", "pipeline", "trade", "tariff",
    "bitcoin", "crypto", "ethereum", "btc", "eth", "fed", "rate", "inflation",
    "gdp", "recession", "default", "debt",
}

CATEGORY_MAP = {
    "politics":       "politics",
    "political":      "politics",
    "geopolitics":    "geopolitics",
    "crypto":         "crypto",
    "cryptocurrency": "crypto",
    "bitcoin":        "crypto",
    "economics":      "economics",
    "finance":        "economics",
    "sports":         "sports",
    "entertainment":  "entertainment",
    "science":        "science",
}


def detect_zones(question: str) -> list[str]:
    q = question.lower()
    return [z for z, kws in ZONE_KEYWORDS.items() if any(kw in q for kw in kws)]


def detect_category(question: str, tags: list[str]) -> str:
    tag_labels = [t.lower() if isinstance(t, str) else t.get("label", "").lower() for t in tags]
    for t in tag_labels:
        if t in CATEGORY_MAP:
            return CATEGORY_MAP[t]
    q = question.lower()
    if any(w in q for w in ["bitcoin", "btc", "ethereum", "eth", "crypto"]):
        return "crypto"
    if any(w in q for w in ["election", "president", "vote", "poll"]):
        return "politics"
    if any(kws for z, kws in ZONE_KEYWORDS.items() if any(kw in q for kw in kws)):
        return "geopolitics"
    return "other"


def is_relevant(market: dict) -> bool:
    if not market.get("active") or market.get("closed"):
        return False
    volume = float(market.get("volume", 0) or 0)
    if volume < MIN_VOLUME:
        return False
    question = market.get("question", "").lower()
    tags = market.get("tags", []) or []
    tag_labels = {(t.lower() if isinstance(t, str) else t.get("label", "").lower()) for t in tags}

    # Accept crypto markets by tag
    if tag_labels & {"crypto", "cryptocurrency", "bitcoin", "ethereum"}:
        return True
    # Accept if question contains geo keywords
    if any(kw in question for kw in GEO_KEYWORDS):
        return True
    # Accept if zone detected
    if detect_zones(question):
        return True
    return False


def _parse_json_or_list(val) -> list:
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            pass
    return []


def extract_yes_price(market: dict) -> float | None:
    outcomes = _parse_json_or_list(market.get("outcomes", []))
    prices   = _parse_json_or_list(market.get("outcomePrices", []))
    if not prices:
        return None
    try:
        for i, o in enumerate(outcomes):
            if str(o).upper() == "YES" and i < len(prices):
                p = float(prices[i])
                return p if 0.0 < p < 1.0 else None
        # Binary market: first outcome = YES by convention
        if len(prices) >= 1:
            p = float(prices[0])
            return p if 0.0 < p < 1.0 else None
    except (TypeError, ValueError, IndexError):
        pass
    return None


async def fetch_all_relevant(client: httpx.AsyncClient) -> list[dict]:
    relevant: list[dict] = []
    offset = 0
    batch_size = 100

    while offset < MAX_OFFSET:
        params = {
            "active": "true",
            "closed": "false",
            "limit":  batch_size,
            "offset": offset,
        }
        try:
            resp = await client.get(GAMMA_URL, params=params, timeout=30)
            resp.raise_for_status()
            batch = resp.json()
        except Exception as exc:
            log.error(f"Error fetching markets offset={offset}: {exc}")
            break

        if not batch:
            break

        for m in batch:
            if is_relevant(m):
                relevant.append(m)

        if len(batch) < batch_size:
            break
        offset += batch_size

    log.info(f"Fetched up to offset {offset}, {len(relevant)} relevant")
    return relevant


def build_cache_entry(market: dict) -> dict:
    question   = market.get("question", "")
    yes_price  = extract_yes_price(market)
    tags       = market.get("tags", []) or []
    tag_labels = [t if isinstance(t, str) else t.get("label", "") for t in tags]
    return {
        "market_id": market.get("conditionId", market.get("id", "")),
        "question":  question,
        "category":  detect_category(question, tags),
        "tags":      tag_labels,
        "yes_price": yes_price,
        "volume":    float(market.get("volume", 0) or 0),
        "zones":     detect_zones(question),
        "end_date":  market.get("endDate"),
        "slug":      market.get("slug", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def cache_markets(redis_client: aioredis.Redis, markets: list[dict]) -> None:
    entries = []
    for m in markets:
        e = build_cache_entry(m)
        if e["yes_price"] is not None:
            entries.append(e)

    entries.sort(key=lambda x: x["volume"], reverse=True)
    ttl = POLL_INTERVAL * 3
    await redis_client.set("cache:polymarket:markets", json.dumps(entries), ex=ttl)
    log.info(f"Cached {len(entries)} markets (TTL {ttl}s)")


async def process_signals(
    markets: list[dict],
    redis_client: aioredis.Redis,
    db: asyncpg.Connection | None,
) -> int:
    emitted = 0
    now = datetime.now(timezone.utc)

    for market in markets:
        market_id = market.get("conditionId", market.get("id", ""))
        if not market_id:
            continue
        yes_price = extract_yes_price(market)
        if yes_price is None:
            continue

        question = market.get("question", "")
        volume   = float(market.get("volume", 0) or 0)

        key_1h  = f"polymarket:price_1h:{market_id}"
        key_24h = f"polymarket:price_24h:{market_id}"
        key_cd  = f"polymarket:extreme_cd:{market_id}"

        stored_1h  = await redis_client.get(key_1h)
        stored_24h = await redis_client.get(key_24h)
        prev_1h    = float(stored_1h)  if stored_1h  else None
        prev_24h   = float(stored_24h) if stored_24h else None

        await redis_client.set(key_1h,  str(yes_price), ex=4500,  nx=True)
        await redis_client.set(key_24h, str(yes_price), ex=90000, nx=True)

        signals: list[str] = []
        change_1h = change_24h = None

        if prev_1h and prev_1h > 0:
            change_1h = (yes_price - prev_1h) / prev_1h
            if abs(change_1h) >= 0.05:
                signals.append("MOMENTUM")

        if prev_24h and prev_24h > 0:
            change_24h = (yes_price - prev_24h) / prev_24h
            if abs(change_24h) >= 0.15:
                signals.append("STRONG_MOVE")

        extreme = "HIGH" if yes_price >= 0.75 else ("LOW" if yes_price <= 0.25 else None)
        if extreme:
            stored_ex = await redis_client.get(key_cd)
            if stored_ex != extreme:
                signals.append(f"EXTREME_{extreme}")
                await redis_client.setex(key_cd, 10800, extreme)

        if not signals:
            continue

        payload = {
            "time":        now.isoformat(),
            "market_id":   market_id,
            "question":    question,
            "category":    detect_category(question, market.get("tags", [])),
            "yes_price":   str(yes_price),
            "change_1h":   str(change_1h) if change_1h is not None else "",
            "change_24h":  str(change_24h) if change_24h is not None else "",
            "signal_type": ",".join(signals),
            "zones":       json.dumps(detect_zones(question)),
            "volume":      str(volume),
        }
        await redis_client.xadd("stream:polymarket", payload, maxlen=1000)

        if db:
            try:
                end_dt = None
                end_raw = market.get("endDate")
                if end_raw:
                    try:
                        end_dt = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
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
                    now, market_id, question,
                    detect_category(question, market.get("tags", [])),
                    yes_price, prev_1h, prev_24h, change_1h, change_24h,
                    ",".join(signals), detect_zones(question), volume, end_dt,
                )
            except Exception as exc:
                log.warning(f"DB insert {market_id}: {exc}")

        emitted += 1
        chg = f"{change_1h*100:+.1f}%" if change_1h else "n/a"
        log.info(f"[SIGNAL] {','.join(signals)} | {question[:55]} | p={yes_price:.2f} | Δ1h={chg}")

    return emitted


async def poll_loop(redis_client: aioredis.Redis, db: asyncpg.Connection | None) -> None:
    async with httpx.AsyncClient(headers={"User-Agent": "Qilin/1.0"}) as client:
        while True:
            try:
                markets = await fetch_all_relevant(client)
                await cache_markets(redis_client, markets)
                emitted = await process_signals(markets, redis_client, db)
                log.info(f"Ciclo completo: {len(markets)} relevantes, {emitted} señales emitidas")
                # Los mercados refrescan en cada ciclo (~2-5 min) — invalidamos
                # siempre, ya que /polymarket/feed sirve el cache:polymarket:markets.
                try:
                    await redis_client.publish("cache.invalidate", "polymarket.feed")
                except Exception as e:
                    log.warning(f"[cache.invalidate] publish error: {e}")
            except Exception as exc:
                log.error(f"Error en ciclo: {exc}")
            await asyncio.sleep(POLL_INTERVAL)


async def main() -> None:
    log.info("Ingestor Polymarket iniciando (Gamma API)...")

    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

    db: asyncpg.Connection | None = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB")
        except Exception as exc:
            log.warning(f"Sin DB, continuando: {exc}")

    try:
        await poll_loop(redis_client, db)
    finally:
        await redis_client.aclose()
        if db:
            await db.close()


if __name__ == "__main__":
    asyncio.run(main())
