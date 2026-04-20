import logging

from .base_agent import BaseAgent

log = logging.getLogger(__name__)


class SentinelAgent(BaseAgent):
    def __init__(self, pool, zones: dict) -> None:
        super().__init__(name="sentinel_agent", tools=[], system_prompt="")
        self.pool = pool
        self.zones = zones

    async def run(self, context: dict) -> dict:
        return {}
