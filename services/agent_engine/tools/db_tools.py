import json
import logging
from datetime import datetime, timezone

import asyncpg

log = logging.getLogger(__name__)


async def get_aircraft_history(
    pool: asyncpg.Pool,
    zone_bbox: dict,
    hours: int,
    military_only: bool = True,
) -> list[dict]:
    query = """
        SELECT time, icao24, callsign, lat, lon, altitude, velocity,
               heading, on_ground, category, origin_country, zone
        FROM aircraft_positions
        WHERE time >= NOW() - $1::interval
          AND lat BETWEEN $2 AND $3
          AND lon BETWEEN $4 AND $5
    """
    params = [
        f"{hours} hours",
        zone_bbox["min_lat"], zone_bbox["max_lat"],
        zone_bbox["min_lon"], zone_bbox["max_lon"],
    ]
    if military_only:
        query += " AND category = 'military'"
    query += " ORDER BY time DESC LIMIT 500"
    rows = await pool.fetch(query, *params)
    return [dict(r) for r in rows]


async def get_vessel_history(
    pool: asyncpg.Pool,
    zone_bbox: dict,
    hours: int,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT time, mmsi, name, lat, lon, speed, course, heading,
               ship_type, category, flag, destination, ais_active, zone
        FROM vessel_positions
        WHERE time >= NOW() - $1::interval
          AND lat BETWEEN $2 AND $3
          AND lon BETWEEN $4 AND $5
        ORDER BY time DESC LIMIT 500
        """,
        f"{hours} hours",
        zone_bbox["min_lat"], zone_bbox["max_lat"],
        zone_bbox["min_lon"], zone_bbox["max_lon"],
    )
    return [dict(r) for r in rows]


async def get_ais_dark_events(
    pool: asyncpg.Pool,
    zone_bbox: dict,
    hours: int,
) -> list[dict]:
    """Return vessels that were in the zone but have ais_active=FALSE."""
    rows = await pool.fetch(
        """
        SELECT DISTINCT ON (mmsi)
            time, mmsi, name, lat, lon, ship_type, category, flag, zone
        FROM vessel_positions
        WHERE time >= NOW() - $1::interval
          AND lat BETWEEN $2 AND $3
          AND lon BETWEEN $4 AND $5
          AND ais_active = FALSE
        ORDER BY mmsi, time DESC
        """,
        f"{hours} hours",
        zone_bbox["min_lat"], zone_bbox["max_lat"],
        zone_bbox["min_lon"], zone_bbox["max_lon"],
    )
    return [dict(r) for r in rows]


async def search_news(
    pool: asyncpg.Pool,
    keywords: list[str],
    hours: int,
    limit: int = 20,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT id, time, source, title, url, summary, zones, keywords,
               severity, relevance, source_country, source_type, sectors
        FROM news_events
        WHERE time >= NOW() - $1::interval
          AND EXISTS (
              SELECT 1 FROM unnest($2::text[]) AS kw
              WHERE title ILIKE '%' || kw || '%'
                 OR summary ILIKE '%' || kw || '%'
          )
        ORDER BY relevance DESC, time DESC
        LIMIT $3
        """,
        f"{hours} hours",
        keywords,
        limit,
    )
    return [dict(r) for r in rows]


async def search_social(
    pool: asyncpg.Pool,
    keywords: list[str],
    hours: int,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT time, tweet_id, handle, display, category, zone, content,
               lang, likes, retweets, url
        FROM social_posts
        WHERE time >= NOW() - $1::interval
          AND EXISTS (
              SELECT 1 FROM unnest($2::text[]) AS kw
              WHERE content ILIKE '%' || kw || '%'
          )
        ORDER BY likes DESC, time DESC
        LIMIT 50
        """,
        f"{hours} hours",
        keywords,
    )
    return [dict(r) for r in rows]


async def get_market_signals(
    pool: asyncpg.Pool,
    tickers: list[str],
    hours: int,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT time, ticker, name, sector, asset_type, geo_relevance,
               price, volume, rsi, macd, bb_upper, bb_lower,
               sma20, sma50, sma200, atr, technical_score, signals
        FROM market_signals
        WHERE time >= NOW() - $1::interval
          AND ticker = ANY($2::text[])
        ORDER BY time DESC
        """,
        f"{hours} hours",
        tickers,
    )
    return [dict(r) for r in rows]


async def get_polymarket_signals(
    pool: asyncpg.Pool,
    zone: str,
    hours: int,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT time, market_id, question, category, yes_price,
               prev_1h_price, prev_24h_price, change_1h, change_24h,
               signal_type, zones, volume, end_date
        FROM polymarket_signals
        WHERE time >= NOW() - $1::interval
          AND $2 = ANY(zones)
        ORDER BY time DESC
        LIMIT 50
        """,
        f"{hours} hours",
        zone,
    )
    return [dict(r) for r in rows]


async def get_sentinel_data(
    pool: asyncpg.Pool,
    zone_id: str,
    hours: int,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT time, zone_id, product, mean_value, max_value, p95_value,
               baseline_mean, anomaly_ratio, granule_id
        FROM sentinel_observations
        WHERE time >= NOW() - $1::interval
          AND zone_id = $2
        ORDER BY time DESC
        """,
        f"{hours} hours",
        zone_id,
    )
    return [dict(r) for r in rows]


async def get_analyzed_events(
    pool: asyncpg.Pool,
    zone: str,
    hours: int,
    min_severity: int = 5,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT id, time, zone, event_type, severity, confidence, headline,
               summary, signals_used, market_implications,
               polymarket_implications, recommended_action, tags,
               processing_time_ms
        FROM analyzed_events
        WHERE time >= NOW() - $1::interval
          AND zone = $2
          AND severity >= $3
        ORDER BY time DESC
        LIMIT 20
        """,
        f"{hours} hours",
        zone,
        min_severity,
    )
    return [dict(r) for r in rows]


async def save_analyzed_event(pool: asyncpg.Pool, event: dict) -> int:
    """Insert into analyzed_events and return the generated id."""
    ts = event.get("time") or datetime.now(timezone.utc)
    row = await pool.fetchrow(
        """
        INSERT INTO analyzed_events (
            time, zone, event_type, severity, confidence, headline, summary,
            signals_used, market_implications, polymarket_implications,
            recommended_action, tags, raw_input, processing_time_ms, cycle_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10,
            $11, $12, $13, $14, $15
        ) RETURNING id
        """,
        ts,
        event.get("zone"),
        event.get("event_type"),
        event.get("severity"),
        event.get("confidence"),
        event.get("headline"),
        event.get("summary"),
        event.get("signals_used") or [],
        event.get("market_implications"),
        event.get("polymarket_implications"),
        event.get("recommended_action"),
        event.get("tags") or [],
        event.get("raw_input"),
        event.get("processing_time_ms"),
        event.get("cycle_id"),
    )
    return row["id"]


async def save_agent_finding(pool: asyncpg.Pool, finding: dict) -> int:
    """Insert into agent_findings. Returns generated id."""
    ts = finding.get("time") or datetime.now(timezone.utc)
    row = await pool.fetchrow(
        """
        INSERT INTO agent_findings (
            time, cycle_id, agent_name, anomaly_score, summary,
            raw_output, tools_called, duration_ms, telegram_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        """,
        ts,
        finding["cycle_id"],
        finding["agent_name"],
        int(finding.get("anomaly_score") or 0),
        finding.get("summary") or "",
        json.dumps(finding.get("raw_output") or {}),
        finding.get("tools_called") or [],
        finding.get("duration_ms"),
        bool(finding.get("telegram_sent", False)),
    )
    return row["id"]


async def fetch_previous_findings(
    pool: asyncpg.Pool,
    agent_name: str,
    hours: int = 24,
    limit: int = 5,
) -> list[dict]:
    """Return this agent's own recent findings for memory context."""
    rows = await pool.fetch(
        """
        SELECT time, cycle_id, anomaly_score, summary, raw_output
        FROM agent_findings
        WHERE agent_name = $1
          AND time >= NOW() - $2::interval
        ORDER BY time DESC
        LIMIT $3
        """,
        agent_name,
        f"{hours} hours",
        limit,
    )
    return [dict(r) for r in rows]


async def fetch_analyzed_events_window(
    pool: asyncpg.Pool,
    hours: int = 24,
    min_severity: int = 0,
    limit: int = 10,
) -> list[dict]:
    """Master memory: recent analyzed_events across all zones."""
    rows = await pool.fetch(
        """
        SELECT id, time, cycle_id, zone, event_type, severity, confidence,
               headline, summary, signals_used, recommended_action, tags
        FROM analyzed_events
        WHERE time >= NOW() - $1::interval
          AND severity >= $2
        ORDER BY time DESC
        LIMIT $3
        """,
        f"{hours} hours",
        min_severity,
        limit,
    )
    return [dict(r) for r in rows]


async def update_analyzed_event_cycle(pool: asyncpg.Pool, event_id: int, cycle_id: str) -> None:
    await pool.execute(
        "UPDATE analyzed_events SET cycle_id = $1 WHERE id = $2",
        cycle_id, event_id,
    )


async def get_aircraft_history_global(
    pool: asyncpg.Pool,
    hours: int,
    military_only: bool = True,
    limit: int = 2000,
) -> list[dict]:
    """Global (no bbox) aircraft query. Used by scheduled adsb_agent."""
    query = """
        SELECT time, icao24, callsign, lat, lon, altitude, velocity,
               heading, on_ground, category, origin_country, zone
        FROM aircraft_positions
        WHERE time >= NOW() - $1::interval
    """
    params = [f"{hours} hours"]
    if military_only:
        query += " AND category = 'military'"
    query += " ORDER BY time DESC LIMIT $2"
    params.append(limit)
    rows = await pool.fetch(query, *params)
    return [dict(r) for r in rows]


async def get_vessel_history_global(
    pool: asyncpg.Pool,
    hours: int,
    categories: list[str] | None = None,
    limit: int = 2000,
) -> list[dict]:
    query = """
        SELECT time, mmsi, name, lat, lon, speed, course, heading,
               ship_type, category, flag, destination, ais_active, zone
        FROM vessel_positions
        WHERE time >= NOW() - $1::interval
    """
    params = [f"{hours} hours"]
    if categories:
        query += " AND category = ANY($2::text[])"
        params.append(categories)
        query += f" ORDER BY time DESC LIMIT ${len(params) + 1}"
    else:
        query += " ORDER BY time DESC LIMIT $2"
    params.append(limit)
    rows = await pool.fetch(query, *params)
    return [dict(r) for r in rows]


async def get_ais_dark_events_global(
    pool: asyncpg.Pool,
    hours: int,
    limit: int = 500,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT DISTINCT ON (mmsi)
            time, mmsi, name, lat, lon, ship_type, category, flag, zone
        FROM vessel_positions
        WHERE time >= NOW() - $1::interval
          AND ais_active = FALSE
        ORDER BY mmsi, time DESC
        LIMIT $2
        """,
        f"{hours} hours", limit,
    )
    return [dict(r) for r in rows]


async def get_recent_news(
    pool: asyncpg.Pool,
    hours: int,
    min_severity: int = 0,
    limit: int = 120,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT time, source, title, url,
               SUBSTRING(summary, 1, 300) AS summary,
               zones, keywords, severity, relevance, source_type, sectors
        FROM news_events
        WHERE time >= NOW() - $1::interval
          AND severity >= $2
        ORDER BY severity DESC, relevance DESC, time DESC
        LIMIT $3
        """,
        f"{hours} hours", min_severity, limit,
    )
    return [dict(r) for r in rows]


async def get_recent_social(
    pool: asyncpg.Pool,
    hours: int,
    limit: int = 200,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT time, handle, display, category, zone, content, likes, retweets, url
        FROM social_posts
        WHERE time >= NOW() - $1::interval
        ORDER BY likes DESC, time DESC
        LIMIT $2
        """,
        f"{hours} hours", limit,
    )
    return [dict(r) for r in rows]
