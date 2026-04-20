import asyncio
import logging
import time
from collections import deque

log = logging.getLogger(__name__)


class RateLimiter:
    def __init__(
        self,
        max_per_hour: int = 10,
        max_parallel: int = 3,
        queue_maxsize: int = 50,
    ) -> None:
        self._max_per_hour = max_per_hour
        self._max_parallel = max_parallel
        self._timestamps: deque[float] = deque()
        self._parallel_active = 0
        self._lock = asyncio.Lock()
        # Public queue — caller pushes events here when acquire() returns False
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=queue_maxsize)

    def _prune_window(self) -> None:
        """Remove timestamps older than 1 hour. Must be called under self._lock."""
        cutoff = time.monotonic() - 3600.0
        while self._timestamps and self._timestamps[0] < cutoff:
            self._timestamps.popleft()

    @property
    def analyses_last_hour(self) -> int:
        cutoff = time.monotonic() - 3600.0
        return sum(1 for ts in self._timestamps if ts >= cutoff)

    @property
    def queue_size(self) -> int:
        return self.queue.qsize()

    @property
    def parallel_active(self) -> int:
        return self._parallel_active

    async def acquire(self, severity: int = 5) -> bool:
        """
        Try to acquire a processing slot using a sliding-window rate limit.

        Returns True if the caller may proceed immediately (slot acquired).
        Returns False if rate-limited; caller is responsible for enqueueing
        or discarding the event via self.queue.
        """
        async with self._lock:
            self._prune_window()
            count = len(self._timestamps)

            if count >= int(self._max_per_hour * 0.8):
                log.warning(
                    "[RATELIMIT] Uso al %.0f%%: %d/%d análisis en la última hora",
                    count / self._max_per_hour * 100,
                    count,
                    self._max_per_hour,
                )

            if count >= self._max_per_hour or self._parallel_active >= self._max_parallel:
                return False

            self._timestamps.append(time.monotonic())
            self._parallel_active += 1
            return True

    async def release(self) -> None:
        async with self._lock:
            self._parallel_active = max(0, self._parallel_active - 1)

    def get_metrics(self) -> dict:
        return {
            "analyses_last_hour": self.analyses_last_hour,
            "queue_size": self.queue_size,
            "parallel_active": self._parallel_active,
        }
