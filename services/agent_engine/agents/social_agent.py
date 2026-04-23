import json
import logging

import asyncpg

from tools import db_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista de redes sociales (X/Twitter) con foco en cuentas geopolíticas
autoritativas (OSINT, analistas, canales militares, prensa especializada). Lees el
contenido completo de los tweets (≤280 caracteres) de las últimas 8h.

Detectas: anuncios oficiales, filtraciones, contradicciones con narrativa oficial,
OSINT de movimientos militares, ataques reportados, pánico de mercado.

Tienes `previous_findings` de ciclos anteriores para evaluar continuidad.

Usa la herramienta disponible. Responde SOLO con JSON:
{
  "anomaly_score": <0-10>,
  "posts_reviewed": <int>,
  "top_posts": [{"handle": "...", "content": "...", "url": "...", "why_matters": "<1 frase>"}],
  "themes": ["<tema>"],
  "regions_affected": ["<región>"],
  "delta_vs_previous_cycles": "<aumenta|estable|disminuye|n/a>",
  "summary": "<2-3 frases>"
}\
"""

_TOOLS = [
    {
        "name": "get_recent_social_global",
        "description": "Devuelve posts de X/Twitter de las últimas N horas, ordenados por likes+tiempo.",
        "input_schema": {
            "type": "object",
            "properties": {"hours": {"type": "integer"}},
            "required": ["hours"],
        },
    },
]


class SocialAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool) -> None:
        super().__init__(name="social_agent", tools=_TOOLS, system_prompt=_SYSTEM_PROMPT)
        self.pool = pool

    async def _tool_get_recent_social_global(self, tool_input: dict) -> str:
        hours = int(tool_input.get("hours", 8))
        rows = await db_tools.get_recent_social(self.pool, hours)
        log.info("[AGENT:social] global hours=%d → %d posts", hours, len(rows))
        return json.dumps({"count": len(rows), "posts": rows}, default=str)
