import logging

from .base_agent import BaseAgent

log = logging.getLogger(__name__)


class MarketAgent(BaseAgent):
    def __init__(self, pool, zones: dict, watchlist: dict) -> None:
        super().__init__(name="market_agent", tools=[], system_prompt="")
        self.pool = pool
        self.zones = zones
        self.watchlist = watchlist

    async def run(self, context: dict) -> dict:
        return {}
