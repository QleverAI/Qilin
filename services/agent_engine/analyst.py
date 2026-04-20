import logging

log = logging.getLogger(__name__)


class Analyst:
    def __init__(self, pool, zones: dict) -> None:
        self.pool = pool
        self.zones = zones

    async def run(self, context: dict) -> dict:
        return {}
