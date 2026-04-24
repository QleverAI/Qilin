import logging

import httpx

log = logging.getLogger(__name__)

_TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
_MAX_TEXT = 4096
_TRUNCATION_SUFFIX = "... [truncado]"

_DOMAIN_ICON = {
    "adsb_agent":     "🛩️",
    "maritime_agent": "🚢",
    "news_agent":     "📰",
    "social_agent":   "𝕏",
}


class Reporter:
    def __init__(
        self,
        telegram_token: str,
        telegram_chat_id: str,
        http_client: httpx.AsyncClient,
    ) -> None:
        self.token = telegram_token
        self.chat_id = telegram_chat_id
        self._http = http_client

    # ── Scheduled mode APIs ───────────────────────────────────────────────────

    async def send_finding_telegram(
        self, cycle_id: str, agent_name: str, payload: dict,
    ) -> bool:
        icon = _DOMAIN_ICON.get(agent_name, "🔵")
        score = int(payload.get("anomaly_score") or 0)
        summary = (payload.get("summary") or "")[:800]
        short_cycle = cycle_id[:8]
        text = (
            f"{icon} <b>[{agent_name}] anomaly_score={score}</b>\n"
            f"cycle <code>{short_cycle}</code>\n\n"
            f"{summary}"
        )
        return await self._send_telegram(text, disable_notification=False)

    async def send_master_telegram(self, analysis: dict) -> bool:
        severity = int(analysis.get("severity") or 0)
        confidence = analysis.get("confidence") or "—"
        headline = analysis.get("headline") or ""
        summary = (analysis.get("summary") or "")[:700]
        signals = ", ".join(analysis.get("signals_used") or [])
        action = analysis.get("recommended_action") or "—"
        zone = analysis.get("zone") or "GLOBAL"

        text = (
            f"⭐ <b>Qilin Intel — {zone}</b>\n"
            f"Severity: <b>{severity}/10</b>  ·  Confidence: <b>{confidence}</b>\n\n"
            f"<b>{headline}</b>\n\n"
            f"{summary}\n\n"
            f"<b>Signals:</b> {signals}\n"
            f"<b>Action:</b> {action}"
        )
        silent = severity < 6
        return await self._send_telegram(text, disable_notification=silent)

    async def send_finding_telegram_personal(
        self,
        cycle_id: str,
        agent_name: str,
        payload: dict,
        chat_id: str,
        matched_topics: list[str],
    ) -> bool:
        if not self.token:
            log.debug("[REPORTER] Telegram not configured, personal send skipped")
            return False
        icon = _DOMAIN_ICON.get(agent_name, "🔵")
        score = int(payload.get("anomaly_score") or 0)
        summary = (payload.get("summary") or "")[:600]
        short_cycle = cycle_id[:8]
        topics_str = ", ".join(matched_topics[:5])
        text = (
            f"{icon} <b>[{agent_name}] score={score}</b>\n"
            f"cycle <code>{short_cycle}</code>\n\n"
            f"{summary}\n\n"
            f"🎯 <i>Topics: {topics_str}</i>"
        )
        body = {
            "chat_id": chat_id,
            "text": text if len(text) <= _MAX_TEXT else text[: _MAX_TEXT - len(_TRUNCATION_SUFFIX)] + _TRUNCATION_SUFFIX,
            "parse_mode": "HTML",
            "disable_notification": False,
        }
        try:
            resp = await self._http.post(
                _TELEGRAM_API.format(token=self.token), json=body, timeout=10,
            )
            resp.raise_for_status()
            return True
        except Exception as exc:
            log.warning("[REPORTER] personal Telegram error chat_id=%s: %s", chat_id, exc)
            return False

    # ── Telegram HTTP send ────────────────────────────────────────────────────

    async def _send_telegram(self, text: str, disable_notification: bool = False) -> bool:
        if not self.token or not self.chat_id:
            log.debug("[REPORTER] Telegram no configurado")
            return False
        if len(text) > _MAX_TEXT:
            text = text[: _MAX_TEXT - len(_TRUNCATION_SUFFIX)] + _TRUNCATION_SUFFIX
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_notification": disable_notification,
        }
        try:
            resp = await self._http.post(
                _TELEGRAM_API.format(token=self.token), json=payload, timeout=10,
            )
            resp.raise_for_status()
            return True
        except httpx.HTTPStatusError as exc:
            log.warning("[REPORTER] Telegram HTTP %d: %s",
                        exc.response.status_code, exc.response.text[:200])
        except Exception as exc:
            log.warning("[REPORTER] Telegram error: %s", exc)
        return False
