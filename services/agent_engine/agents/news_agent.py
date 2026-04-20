import json
import logging

import asyncpg

from tools import db_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista de inteligencia de fuentes abiertas especializado en medios de comunicación.
Evalúas la relevancia y el tono de las noticias relacionadas con eventos geopolíticos.
Distingues entre ruido mediático y señales reales. Identificas escalada o desescalada.

Usa las herramientas disponibles para recopilar noticias de la zona indicada.
Cuando hayas completado el análisis, responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "zone": "<nombre de zona>",
  "news_count": <int total>,
  "sentiment_score": <float -1.0 a 1.0, negativo=tensión>,
  "top_headlines": ["<titular 1>", "<titular 2>", "<titular 3>"],
  "trend": "<escalating | stable | deescalating>",
  "summary": "<1-2 frases del hallazgo>"
}\
"""

# Keywords geopolíticos negativos (tensión/conflicto) para scoring heurístico
_NEGATIVE_KW = {
    "attack", "killed", "explosion", "airstrike", "missile", "war", "crisis",
    "conflict", "invasion", "strike", "bomb", "troops", "military", "clash",
    "ataque", "muertos", "explosión", "misil", "guerra", "crisis", "conflicto",
    "invasión", "bombardeo", "tropas", "militares",
}

# Keywords positivos (desescalada/acuerdo)
_POSITIVE_KW = {
    "ceasefire", "agreement", "deal", "peace", "withdraw", "diplomacy", "talks",
    "alto el fuego", "acuerdo", "paz", "retirada", "diplomacia", "negociación",
}

# Keywords por zona para enriquecer búsquedas
_ZONE_KEYWORDS: dict[str, list[str]] = {
    "ukraine_black_sea": ["ukraine", "russia", "zelenskyy", "putin", "donbas", "crimea"],
    "levante":           ["israel", "gaza", "hamas", "hezbollah", "idf", "palestin"],
    "iran":              ["iran", "irgc", "tehran", "nuclear", "sanctions"],
    "gulf_ormuz":        ["gulf", "hormuz", "saudi", "houthi", "opec"],
    "china":             ["china", "taiwan", "pla", "beijing", "south china sea"],
    "korea":             ["north korea", "kim jong", "pyongyang", "icbm"],
    "europe":            ["nato", "europe", "eu", "france", "germany", "poland"],
    "north_america":     ["usa", "united states", "trump", "pentagon"],
    "iraq_syria":        ["iraq", "syria", "isis", "damascus", "baghdad"],
    "yemen":             ["yemen", "houthi", "red sea", "bab el mandeb"],
    "south_china_sea":   ["south china sea", "philippines", "vietnam", "spratly"],
    "india_pakistan":    ["india", "pakistan", "kashmir", "line of control"],
    "sahel":             ["mali", "niger", "burkina", "wagner", "sahel"],
    "baltic_sea":        ["baltic", "finland", "sweden", "estonia", "latvia"],
    "south_caucasus":    ["armenia", "azerbaijan", "nagorno", "karabakh"],
    "somalia_horn":      ["somalia", "piracy", "horn of africa", "aden"],
    "venezuela":         ["venezuela", "maduro", "guyana", "essequibo"],
    "myanmar":           ["myanmar", "burma", "junta"],
    "libya":             ["libya", "tripoli", "benghazi"],
    "sentinel":          ["emissions", "no2", "so2", "atmospheric"],
}

_TOOLS = [
    {
        "name": "search_news",
        "description": (
            "Busca noticias relacionadas con una zona geopolítica. "
            "Combina los keywords proporcionados con los keywords típicos de la zona."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona (clave de zones.yaml)"},
                "keywords": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Keywords adicionales de búsqueda (pueden ser vacíos)",
                },
                "hours": {"type": "integer", "description": "Horas de historial"},
                "limit": {"type": "integer", "description": "Máximo de resultados (default 20)"},
            },
            "required": ["zone", "hours"],
        },
    },
    {
        "name": "get_news_sentiment",
        "description": (
            "Obtiene noticias de la zona y devuelve estadísticas de tono: "
            "conteo de artículos con términos de tensión vs desescalada."
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
        "name": "get_top_news",
        "description": "Obtiene las noticias más relevantes de la zona ordenadas por relevancia.",
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona"},
                "hours": {"type": "integer", "description": "Horas de historial"},
                "limit": {"type": "integer", "description": "Número de noticias (default 10)"},
            },
            "required": ["zone", "hours"],
        },
    },
]


class NewsAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool, zones: dict) -> None:
        super().__init__(
            name="news_agent",
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

    def _score_article(self, title: str, summary: str) -> int:
        """Returns -1 (negative), 0 (neutral), +1 (positive) based on keyword heuristic."""
        text = (title + " " + (summary or "")).lower()
        neg = sum(1 for kw in _NEGATIVE_KW if kw in text)
        pos = sum(1 for kw in _POSITIVE_KW if kw in text)
        if neg > pos:
            return -1
        if pos > neg:
            return 1
        return 0

    # ── Tool implementations ──────────────────────────────────────────────────

    async def _tool_search_news(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        extra = tool_input.get("keywords") or []
        hours = int(tool_input.get("hours", 24))
        limit = int(tool_input.get("limit", 20))
        keywords = self._zone_keywords(zone_name, extra)

        rows = await db_tools.search_news(self.pool, keywords, hours, limit)
        log.info(
            "[AGENT:news] search_news zone=%s hours=%d keywords=%s → %d noticias",
            zone_name, hours, keywords[:3], len(rows),
        )
        # Return lightweight subset to keep token count manageable
        return json.dumps(
            [
                {
                    "title": r.get("title"),
                    "source": r.get("source"),
                    "source_country": r.get("source_country"),
                    "severity": r.get("severity"),
                    "relevance": r.get("relevance"),
                    "time": str(r.get("time")),
                    "summary": (r.get("summary") or "")[:300],
                }
                for r in rows
            ]
        )

    async def _tool_get_news_sentiment(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 24))
        keywords = self._zone_keywords(zone_name, [])

        rows = await db_tools.search_news(self.pool, keywords, hours, limit=50)

        scores = [self._score_article(r.get("title", ""), r.get("summary", "")) for r in rows]
        neg_count = scores.count(-1)
        pos_count = scores.count(1)
        neu_count = scores.count(0)
        total = len(scores)
        avg_score = sum(scores) / total if total else 0.0

        log.info(
            "[AGENT:news] get_news_sentiment zone=%s → total=%d neg=%d pos=%d neu=%d",
            zone_name, total, neg_count, pos_count, neu_count,
        )
        return json.dumps(
            {
                "total_articles": total,
                "negative_count": neg_count,
                "positive_count": pos_count,
                "neutral_count": neu_count,
                "raw_sentiment_avg": round(avg_score, 3),
                "dominant_tone": (
                    "negative" if neg_count > pos_count + neu_count * 0.5
                    else "positive" if pos_count > neg_count + neu_count * 0.5
                    else "mixed"
                ),
            }
        )

    async def _tool_get_top_news(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 24))
        limit = int(tool_input.get("limit", 10))
        keywords = self._zone_keywords(zone_name, [])

        rows = await db_tools.search_news(self.pool, keywords, hours, limit)
        log.info(
            "[AGENT:news] get_top_news zone=%s hours=%d → %d noticias",
            zone_name, hours, len(rows),
        )
        return json.dumps(
            [
                {
                    "title": r.get("title"),
                    "source": r.get("source"),
                    "relevance": r.get("relevance"),
                    "severity": r.get("severity"),
                    "time": str(r.get("time")),
                }
                for r in rows[:limit]
            ]
        )
