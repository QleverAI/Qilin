import logging

import httpx

log = logging.getLogger(__name__)

_TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
_MAX_TEXT = 4096
_TRUNCATION_SUFFIX = "... [truncado]"

# Severity threshold to trigger a full ALERT Telegram message
_ALERT_SEVERITY_THRESHOLD = 7


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

    # ── Public entry point ────────────────────────────────────────────────────

    async def report(self, analysis: dict) -> None:
        """Evaluate all reporting cases independently and dispatch accordingly."""
        try:
            await self._report(analysis)
        except Exception as exc:
            log.error("[REPORTER] Error inesperado: %s", exc)

    async def _report(self, analysis: dict) -> None:
        if not analysis:
            return

        severity = int(analysis.get("severity") or 0)
        action = (analysis.get("recommended_action") or "").upper()
        zone = analysis.get("zone") or "—"
        headline = analysis.get("headline") or ""
        market_impl = analysis.get("market_implications")
        poly_impl = analysis.get("polymarket_implications")

        # CASO 5 — Discard (evaluated first as a short-circuit)
        if severity < 4 or action == "IGNORE":
            log.debug(
                "[REPORTER] IGNORE zone=%s severity=%d", zone, severity
            )
            return

        # ── Independent case evaluation ───────────────────────────────────────
        fired = False  # tracks whether any Telegram message was sent

        # CASO 1 — Full ALERT: recommended_action=="ALERT" or severity >= threshold
        if action == "ALERT" or severity >= _ALERT_SEVERITY_THRESHOLD:
            text = self._fmt_alert(analysis)
            sent = await self._send_telegram(text)
            if sent:
                fired = True
                log.info(
                    "[REPORTER] ALERT enviado zone=%s severity=%d headline=%s",
                    zone, severity, headline,
                )

        # CASO 2 — Market implications: present and has affected tickers
        if (
            market_impl
            and isinstance(market_impl, dict)
            and market_impl.get("affected_tickers")
        ):
            text = self._fmt_market(analysis, market_impl)
            sent = await self._send_telegram(text)
            if sent:
                fired = True
                log.info(
                    "[REPORTER] MARKET enviado zone=%s tickers=%s",
                    zone, market_impl.get("affected_tickers"),
                )

        # CASO 3 — Polymarket implications: present and probability is moving
        if (
            poly_impl
            and isinstance(poly_impl, dict)
            and (poly_impl.get("related_markets") or poly_impl.get("probability_shift") != "STABLE")
        ):
            text = self._fmt_polymarket(analysis, poly_impl)
            sent = await self._send_telegram(text)
            if sent:
                fired = True
                log.info(
                    "[REPORTER] POLYMARKET enviado zone=%s shift=%s",
                    zone, poly_impl.get("probability_shift"),
                )

        # CASO 4 — Monitor only (no Telegram fired, severity in moderate range)
        if not fired and 4 <= severity <= 7:
            log.info(
                "[REPORTER] MONITOR zone=%s severity=%d headline=%s",
                zone, severity, headline,
            )

    # ── Telegram message formatters ───────────────────────────────────────────

    def _fmt_alert(self, analysis: dict) -> str:
        severity = analysis.get("severity", 0)
        confidence = analysis.get("confidence", "—")
        event_type = analysis.get("event_type", "—")
        zone = analysis.get("zone", "—")
        headline = analysis.get("headline", "")
        summary = analysis.get("summary", "")
        signals = ", ".join(analysis.get("signals_used") or [])
        tags = " ".join(f"#{t}" for t in (analysis.get("tags") or []))
        action = analysis.get("recommended_action", "—")

        # Truncate summary to keep message below Telegram limit
        summary_preview = summary[:600] + ("…" if len(summary) > 600 else "")

        lines = [
            f"🚨 <b>ALERTA GEOPOLÍTICA — {zone}</b>",
            "",
            f"<b>Severidad:</b> {severity}/10  |  <b>Confianza:</b> {confidence}",
            f"<b>Tipo:</b> {event_type}  |  <b>Acción:</b> {action}",
            "",
            f"<b>{headline}</b>",
            "",
            summary_preview,
        ]
        if signals:
            lines += ["", f"<b>Fuentes:</b> {signals}"]
        if tags:
            lines += ["", tags]

        return "\n".join(lines)

    def _fmt_market(self, analysis: dict, market: dict) -> str:
        zone = analysis.get("zone", "—")
        severity = analysis.get("severity", 0)
        headline = analysis.get("headline", "")
        tickers = market.get("affected_tickers") or []
        direction = market.get("direction", "NEUTRAL")
        reasoning = (market.get("reasoning") or "")[:400]
        confidence = market.get("confidence", "—")
        disclaimer = market.get("disclaimer", "Señal informativa — no recomendación de inversión")

        direction_icon = {"BULLISH": "📈", "BEARISH": "📉"}.get(direction, "↔️")
        tickers_fmt = " ".join(f"<code>{t}</code>" for t in tickers)

        lines = [
            f"📊 <b>SEÑAL DE MERCADO — {zone}</b>",
            "",
            f"<b>Evento:</b> {headline}  (severity {severity}/10)",
            "",
            f"<b>Tickers afectados:</b> {tickers_fmt}",
            f"<b>Dirección:</b> {direction_icon} {direction}  |  <b>Confianza:</b> {confidence}",
            "",
            reasoning,
            "",
            f"⚠️ {disclaimer}",
        ]
        return "\n".join(lines)

    def _fmt_polymarket(self, analysis: dict, poly: dict) -> str:
        zone = analysis.get("zone", "—")
        severity = analysis.get("severity", 0)
        headline = analysis.get("headline", "")
        markets = poly.get("related_markets") or []
        shift = poly.get("probability_shift", "STABLE")
        reasoning = (poly.get("reasoning") or "")[:400]
        disclaimer = poly.get("disclaimer", "Probabilidad implícita del mercado de predicción")

        shift_icon = {"UP": "⬆️", "DOWN": "⬇️", "STABLE": "➡️"}.get(shift, "")
        markets_fmt = "\n".join(f"  • {m}" for m in markets[:5])

        lines = [
            f"🎯 <b>POLYMARKET — {zone}</b>",
            "",
            f"<b>Evento:</b> {headline}  (severity {severity}/10)",
            "",
            f"<b>Cambio de probabilidad:</b> {shift_icon} {shift}",
            "",
            "<b>Mercados relacionados:</b>",
            markets_fmt,
            "",
            reasoning,
            "",
            f"⚠️ {disclaimer}",
        ]
        return "\n".join(lines)

    # ── Telegram HTTP send ────────────────────────────────────────────────────

    async def _send_telegram(self, text: str) -> bool:
        if not self.token or not self.chat_id:
            log.debug("[REPORTER] Telegram no configurado, omitiendo envío")
            return False

        if len(text) > _MAX_TEXT:
            text = text[: _MAX_TEXT - len(_TRUNCATION_SUFFIX)] + _TRUNCATION_SUFFIX

        url = _TELEGRAM_API.format(token=self.token)
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "HTML",
        }
        try:
            resp = await self._http.post(url, json=payload, timeout=10)
            resp.raise_for_status()
            return True
        except httpx.HTTPStatusError as exc:
            log.warning(
                "[REPORTER] Telegram HTTP %d: %s",
                exc.response.status_code,
                exc.response.text[:200],
            )
        except Exception as exc:
            log.warning("[REPORTER] Telegram error: %s", exc)
        return False
