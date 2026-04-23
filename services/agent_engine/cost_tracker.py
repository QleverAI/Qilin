"""Pricing table + budget helpers for agent_engine LLM usage."""
from __future__ import annotations

import logging
import os
from datetime import date, timezone, datetime

log = logging.getLogger(__name__)

# USD per million tokens. Update if Anthropic changes pricing.
PRICING: dict[str, dict[str, float]] = {
    "claude-haiku-4-5-20251001": {"input": 1.00, "output": 5.00},
    "claude-sonnet-4-6":          {"input": 3.00, "output": 15.00},
}

DAILY_SPEND_CAP = float(os.getenv("DAILY_SPEND_CAP", "5.00"))
SPEND_WARN_THRESHOLD = float(os.getenv("SPEND_WARN_THRESHOLD", "0.80"))


def calc_cost_usd(model: str, usage) -> float:
    """Return USD cost for a single Anthropic response.

    `usage` must expose `input_tokens` and `output_tokens` attributes.
    Unknown models return 0.0 (logged as warning).
    """
    pricing = PRICING.get(model)
    if not pricing:
        log.warning("[COST] Modelo sin precio configurado: %s", model)
        return 0.0
    return (
        (usage.input_tokens / 1_000_000.0) * pricing["input"]
        + (usage.output_tokens / 1_000_000.0) * pricing["output"]
    )


def today_key() -> str:
    return f"daily_spend:{datetime.now(timezone.utc).date().isoformat()}"


def warn_key() -> str:
    return f"daily_spend_warned:{datetime.now(timezone.utc).date().isoformat()}"


async def track_spend(redis, model: str, usage) -> float:
    """Add this response's cost to today's running total. Returns new total USD."""
    cost = calc_cost_usd(model, usage)
    if cost <= 0:
        return await get_today_spend(redis)
    key = today_key()
    new_total = float(await redis.incrbyfloat(key, cost))
    await redis.expire(key, 36 * 3600)
    return new_total


async def get_today_spend(redis) -> float:
    raw = await redis.get(today_key())
    return float(raw) if raw else 0.0


async def is_over_cap(redis) -> bool:
    return (await get_today_spend(redis)) >= DAILY_SPEND_CAP


async def mark_warned(redis) -> bool:
    """Set the warned flag with 36h TTL. Returns True if first warning today."""
    key = warn_key()
    was_set = await redis.set(key, "1", nx=True, ex=36 * 3600)
    return bool(was_set)
