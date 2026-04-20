import json
import logging

import asyncpg

from tools import db_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista OSINT especializado en redes sociales.
Monitorizas Twitter/X para detectar señales tempranas de eventos geopolíticos.
Sabes distinguir entre ruido viral y menciones significativas de actores relevantes:
ministros, militares, periodistas especializados, think tanks.
El volumen importa pero la fuente importa más.

Usa las herramientas disponibles para recopilar datos de la zona indicada.
Cuando hayas completado el análisis, responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "zone": "<nombre de zona>",
  "mention_count": <int total>,
  "sentiment_score": <float -1.0 a 1.0>,
  "notable_accounts": ["<@handle>"],
  "viral_content": ["<extracto de post con más engagement>"],
  "urgency": "<low | medium | high>",
  "summary": "<1-2 frases del hallazgo>"
}\
"""

_NEGATIVE_KW = {
    "attack", "killed", "explosion", "airstrike", "missile", "war", "crisis",
    "conflict", "invasion", "strike", "bomb", "troops", "military", "clash",
    "breaking", "urgent", "alert", "ataque", "muertos", "explosión", "misil",
    "guerra", "crisis", "conflicto", "invasión", "bombardeo", "tropas",
}

_POSITIVE_KW = {
    "ceasefire", "agreement", "deal", "peace", "withdraw", "diplomacy", "talks",
    "alto el fuego", "acuerdo", "paz", "retirada", "diplomacia", "negociación",
}

# Categories considered "notable" sources in the social_posts table
_NOTABLE_CATEGORIES = {"government", "military", "official", "media", "think_tank", "analyst"}

_ZONE_KEYWORDS: dict[str, list[str]] = {
    "ukraine_black_sea": ["ukraine", "russia", "zelenskyy", "putin", "donbas", "crimea", "kyiv"],
    "levante":           ["israel", "gaza", "hamas", "hezbollah", "idf", "palestin"],
    "iran":              ["iran", "irgc", "tehran", "nuclear", "khamenei"],
    "gulf_ormuz":        ["gulf", "hormuz", "saudi", "houthi", "opec"],
    "china":             ["china", "taiwan", "pla", "beijing"],
    "korea":             ["north korea", "kim jong", "pyongyang", "icbm"],
    "europe":            ["nato", "europe", "eu", "france", "germany", "poland"],
    "north_america":     ["usa", "united states", "trump", "pentagon"],
    "iraq_syria":        ["iraq", "syria", "isis", "damascus", "baghdad"],
    "yemen":             ["yemen", "houthi", "red sea"],
    "south_china_sea":   ["south china sea", "philippines", "vietnam", "spratly"],
    "india_pakistan":    ["india", "pakistan", "kashmir"],
    "sahel":             ["mali", "niger", "burkina", "wagner", "sahel"],
    "baltic_sea":        ["baltic", "finland", "sweden", "estonia", "latvia"],
    "south_caucasus":    ["armenia", "azerbaijan", "nagorno", "karabakh"],
    "somalia_horn":      ["somalia", "piracy", "horn of africa"],
    "venezuela":         ["venezuela", "maduro", "guyana"],
    "myanmar":           ["myanmar", "burma", "junta"],
    "libya":             ["libya", "tripoli", "benghazi"],
}

_TOOLS = [
    {
        "name": "search_social",
        "description": "Busca posts en redes sociales relacionados con una zona geopolítica.",
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona (clave de zones.yaml)"},
                "keywords": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Keywords adicionales de búsqueda",
                },
                "hours": {"type": "integer", "description": "Horas de historial"},
            },
            "required": ["zone", "hours"],
        },
    },
    {
        "name": "get_social_sentiment",
        "description": (
            "Obtiene posts de la zona y calcula estadísticas de tono y engagement "
            "para estimar el sentimiento en redes sociales."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona"},
                "hours": {"type": "integer", "description": "Horas de historial"},
            },
            "required": ["zone", "hours"],
        },
    },
    {
        "name": "get_notable_mentions",
        "description": (
            "Obtiene posts de cuentas relevantes (gobierno, militares, medios, think tanks) "
            "y posts de alto engagement en la zona."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona"},
                "hours": {"type": "integer", "description": "Horas de historial"},
                "min_engagement": {
                    "type": "integer",
                    "description": "Suma mínima de likes+retweets para considerar viral (default 100)",
                },
            },
            "required": ["zone", "hours"],
        },
    },
]


class SocialAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool, zones: dict) -> None:
        super().__init__(
            name="social_agent",
            tools=_TOOLS,
            system_prompt=_SYSTEM_PROMPT,
        )
        self.pool = pool
        self.zones = zones

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _zone_keywords(self, zone: str, extra: list[str]) -> list[str]:
        kws = list(_ZONE_KEYWORDS.get(zone, [zone.replace("_", " ")]))
        kws.extend(k for k in extra if k and k not in kws)
        return kws or [zone]

    def _score_post(self, content: str) -> int:
        text = (content or "").lower()
        neg = sum(1 for kw in _NEGATIVE_KW if kw in text)
        pos = sum(1 for kw in _POSITIVE_KW if kw in text)
        if neg > pos:
            return -1
        if pos > neg:
            return 1
        return 0

    def _urgency(self, total: int, neg_ratio: float) -> str:
        if total >= 20 and neg_ratio >= 0.6:
            return "high"
        if total >= 10 or neg_ratio >= 0.4:
            return "medium"
        return "low"

    # ── Tool implementations ──────────────────────────────────────────────────

    async def _tool_search_social(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        extra = tool_input.get("keywords") or []
        hours = int(tool_input.get("hours", 24))
        keywords = self._zone_keywords(zone_name, extra)

        rows = await db_tools.search_social(self.pool, keywords, hours)
        log.info(
            "[AGENT:social] search_social zone=%s hours=%d → %d posts",
            zone_name, hours, len(rows),
        )
        return json.dumps(
            [
                {
                    "handle": r.get("handle"),
                    "display": r.get("display"),
                    "category": r.get("category"),
                    "content": (r.get("content") or "")[:280],
                    "likes": r.get("likes"),
                    "retweets": r.get("retweets"),
                    "time": str(r.get("time")),
                }
                for r in rows
            ]
        )

    async def _tool_get_social_sentiment(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 24))
        keywords = self._zone_keywords(zone_name, [])

        rows = await db_tools.search_social(self.pool, keywords, hours)

        scores = [self._score_post(r.get("content", "")) for r in rows]
        total = len(scores)
        neg_count = scores.count(-1)
        pos_count = scores.count(1)
        avg_score = sum(scores) / total if total else 0.0

        total_likes = sum(r.get("likes") or 0 for r in rows)
        total_retweets = sum(r.get("retweets") or 0 for r in rows)

        log.info(
            "[AGENT:social] get_social_sentiment zone=%s → total=%d neg=%d pos=%d",
            zone_name, total, neg_count, pos_count,
        )
        return json.dumps(
            {
                "total_posts": total,
                "negative_count": neg_count,
                "positive_count": pos_count,
                "neutral_count": total - neg_count - pos_count,
                "raw_sentiment_avg": round(avg_score, 3),
                "total_likes": total_likes,
                "total_retweets": total_retweets,
                "dominant_tone": (
                    "negative" if neg_count > pos_count
                    else "positive" if pos_count > neg_count
                    else "mixed"
                ),
            }
        )

    async def _tool_get_notable_mentions(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 24))
        min_engagement = int(tool_input.get("min_engagement", 100))
        keywords = self._zone_keywords(zone_name, [])

        rows = await db_tools.search_social(self.pool, keywords, hours)

        notable = [
            r for r in rows
            if (r.get("category") or "").lower() in _NOTABLE_CATEGORIES
        ]
        viral = [
            r for r in rows
            if (r.get("likes") or 0) + (r.get("retweets") or 0) >= min_engagement
        ]
        # Deduplicate by tweet_id
        seen: set[str] = set()
        combined: list[dict] = []
        for r in notable + viral:
            tid = r.get("tweet_id", "")
            if tid not in seen:
                seen.add(tid)
                combined.append(r)

        combined.sort(
            key=lambda r: (r.get("likes") or 0) + (r.get("retweets") or 0),
            reverse=True,
        )

        log.info(
            "[AGENT:social] get_notable_mentions zone=%s → %d notable, %d viral",
            zone_name, len(notable), len(viral),
        )
        return json.dumps(
            [
                {
                    "handle": r.get("handle"),
                    "display": r.get("display"),
                    "category": r.get("category"),
                    "content": (r.get("content") or "")[:280],
                    "likes": r.get("likes"),
                    "retweets": r.get("retweets"),
                    "time": str(r.get("time")),
                    "url": r.get("url"),
                }
                for r in combined[:20]
            ]
        )
