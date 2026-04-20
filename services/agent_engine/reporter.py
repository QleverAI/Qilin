import logging

log = logging.getLogger(__name__)


class Reporter:
    def __init__(
        self,
        pool,
        redis_client,
        telegram_token: str,
        telegram_chat_id: str,
    ) -> None:
        self.pool = pool
        self.redis_client = redis_client
        self.telegram_token = telegram_token
        self.telegram_chat_id = telegram_chat_id

    async def run(self, analysis: dict) -> dict:
        return {}
