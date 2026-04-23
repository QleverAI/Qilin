import json
import logging

import asyncpg

from tools import db_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista de noticias geopolíticas GLOBALES. Lees TITULARES y los primeros 300
caracteres del summary de cada noticia para detectar:
- Escalada diplomática o militar
- Ataques, ofensivas, movilizaciones
- Negociaciones, treguas, acuerdos
- Eventos en chokepoints y zonas sensibles

No tienes acceso al cuerpo completo del artículo; decide en base a títulos y
primeros 300 caracteres. Tienes `previous_findings` para detectar continuidad.

Usa la herramienta para pedir noticias de últimas 8h con severity mínima.
Responde SOLO con JSON:
{
  "anomaly_score": <0-10>,
  "news_count_reviewed": <int>,
  "top_stories": [{"title": "...", "source": "...", "url": "...", "severity": <int>, "why_matters": "<1 frase>"}],
  "themes": ["<tema>"],
  "regions_affected": ["<región>"],
  "delta_vs_previous_cycles": "<aumenta|estable|disminuye|n/a>",
  "summary": "<2-3 frases del panorama global>"
}\
"""

_TOOLS = [
    {
        "name": "get_recent_news_global",
        "description": "Devuelve las noticias de las últimas N horas con severity ≥ min_severity, ordenadas por severity+relevancia.",
        "input_schema": {
            "type": "object",
            "properties": {
                "hours": {"type": "integer"},
                "min_severity": {"type": "integer", "description": "0-10. Default 3 para filtrar ruido."},
            },
            "required": ["hours"],
        },
    },
]


class NewsAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool) -> None:
        super().__init__(name="news_agent", tools=_TOOLS, system_prompt=_SYSTEM_PROMPT)
        self.pool = pool

    async def _tool_get_recent_news_global(self, tool_input: dict) -> str:
        hours = int(tool_input.get("hours", 8))
        min_sev = int(tool_input.get("min_severity", 3))
        rows = await db_tools.get_recent_news(self.pool, hours, min_sev)
        log.info("[AGENT:news] global hours=%d min_sev=%d → %d", hours, min_sev, len(rows))
        return json.dumps({"count": len(rows), "news": rows}, default=str)
