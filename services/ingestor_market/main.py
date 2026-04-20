"""
Qilin — Ingestor de Mercados Financieros
Fuente: yfinance (gratis, sin autenticación)

Estrategia:
  1. Carga market_watchlist.yaml al arrancar.
  2. Una vez al día: descarga OHLCV de los últimos 60 días y calcula
     indicadores técnicos (RSI, MACD, BB, SMA, ATR, Volume SMA).
  3. Cada POLL_INTERVAL seg en horario de mercado (09:30-16:00 ET, L-V)
     o cada POLL_INTERVAL_OFFHOURS fuera de horario: actualiza precio actual.
  4. Detecta señales técnicas y calcula technical_score (-10 a +10).
  5. Si abs(technical_score) >= 6: publica en stream:market + TimescaleDB.

NOTA: Las señales de mercado son INFORMATIVAS, no recomendaciones de inversión.
yfinance y pandas-ta son síncronos — se ejecutan en ThreadPoolExecutor.
"""

import asyncio
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time as dtime, timezone, timedelta

import asyncpg
import redis.asyncio as aioredis
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [MARKET] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL          = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL             = os.getenv("DB_URL", "")
POLL_INTERVAL      = int(os.getenv("MARKET_POLL_INTERVAL", "900"))    # 15 min en horario
POLL_INTERVAL_OFF  = int(os.getenv("MARKET_POLL_INTERVAL_OFFHOURS", "3600"))  # 1h fuera
HISTORY_DAYS       = int(os.getenv("MARKET_HISTORY_DAYS", "60"))
SIGNAL_THRESHOLD   = 6  # abs(technical_score) mínimo para publicar

WATCHLIST_PATH     = os.getenv("MARKET_WATCHLIST", "/app/config/market_watchlist.yaml")

_executor = ThreadPoolExecutor(max_workers=4)

# ── Horario de mercado (NYSE/NASDAQ, Eastern Time) ────────────────────────────
# Aproximación UTC: ET = UTC-4 (EDT, verano) / UTC-5 (EST, invierno)
# Se usa UTC-4 como heurística; suficiente para polling de señales.
MARKET_OPEN_UTC  = dtime(13, 30)   # 09:30 ET ≈ 13:30 UTC
MARKET_CLOSE_UTC = dtime(20, 0)    # 16:00 ET ≈ 20:00 UTC


def is_market_hours() -> bool:
    """Devuelve True si estamos en horario de mercado NYSE (aprox. UTC)."""
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:  # sábado=5, domingo=6
        return False
    t = now.time().replace(tzinfo=None)
    return MARKET_OPEN_UTC <= t <= MARKET_CLOSE_UTC


# ── Carga de configuración ────────────────────────────────────────────────────

def load_watchlist() -> list[dict]:
    """Aplana el watchlist YAML en una lista de {ticker, name, sector, geo_relevance}."""
    with open(WATCHLIST_PATH) as f:
        cfg = yaml.safe_load(f)

    items = []
    for sector, tickers in cfg.get("equities", {}).items():
        for t in tickers:
            items.append({**t, "sector": sector, "asset_type": "equity"})
    for t in cfg.get("indices", []):
        items.append({**t, "sector": "index", "asset_type": "index",
                      "geo_relevance": ["global"]})
    return items


# ── Cálculo de indicadores (síncrono, en executor) ───────────────────────────

def _compute_indicators(ticker: str) -> dict | None:
    """
    Descarga OHLCV histórico y calcula indicadores técnicos con pandas-ta.
    Se ejecuta en ThreadPoolExecutor para no bloquear el loop asyncio.
    Retorna dict con todos los indicadores o None si falla.
    """
    try:
        import yfinance as yf
        import pandas as pd
        import pandas_ta as ta

        yf_ticker = yf.Ticker(ticker)
        hist = yf_ticker.history(period=f"{HISTORY_DAYS}d", interval="1d")

        if hist.empty or len(hist) < 30:
            return None

        close  = hist["Close"]
        volume = hist["Volume"]

        # RSI
        rsi_series = ta.rsi(close, length=14)
        rsi = float(rsi_series.iloc[-1]) if rsi_series is not None and not rsi_series.empty else None

        # MACD
        macd_df = ta.macd(close, fast=12, slow=26, signal=9)
        if macd_df is not None and not macd_df.empty:
            macd_val  = float(macd_df["MACD_12_26_9"].iloc[-1])
            macd_sig  = float(macd_df["MACDs_12_26_9"].iloc[-1])
            macd_prev = float(macd_df["MACD_12_26_9"].iloc[-2]) if len(macd_df) > 1 else macd_val
            macd_sig_prev = float(macd_df["MACDs_12_26_9"].iloc[-2]) if len(macd_df) > 1 else macd_sig
        else:
            macd_val = macd_sig = macd_prev = macd_sig_prev = None

        # Bollinger Bands
        bb_df = ta.bbands(close, length=20, std=2)
        if bb_df is not None and not bb_df.empty:
            bb_upper = float(bb_df["BBU_20_2.0"].iloc[-1])
            bb_lower = float(bb_df["BBL_20_2.0"].iloc[-1])
            bb_mid   = float(bb_df["BBM_20_2.0"].iloc[-1])
        else:
            bb_upper = bb_lower = bb_mid = None

        # SMAs
        sma20  = float(ta.sma(close, length=20).iloc[-1])  if len(close) >= 20  else None
        sma50  = float(ta.sma(close, length=50).iloc[-1])  if len(close) >= 50  else None
        sma200 = float(ta.sma(close, length=200).iloc[-1]) if len(close) >= 200 else None
        sma20_prev  = float(ta.sma(close, length=20).iloc[-2])  if (sma20  and len(close) > 20)  else None
        sma50_prev  = float(ta.sma(close, length=50).iloc[-2])  if (sma50  and len(close) > 50)  else None
        sma200_prev = float(ta.sma(close, length=200).iloc[-2]) if (sma200 and len(close) > 200) else None

        # ATR
        atr = None
        if "High" in hist and "Low" in hist:
            atr_series = ta.atr(hist["High"], hist["Low"], close, length=14)
            if atr_series is not None and not atr_series.empty:
                atr = float(atr_series.iloc[-1])

        # Volume SMA(20)
        vol_sma20 = float(ta.sma(volume.astype(float), length=20).iloc[-1]) if len(volume) >= 20 else None

        current_price = float(close.iloc[-1])
        current_vol   = float(volume.iloc[-1])
        prev_price    = float(close.iloc[-2]) if len(close) > 1 else current_price

        return {
            "price":        current_price,
            "prev_price":   prev_price,
            "volume":       current_vol,
            "rsi":          rsi,
            "macd":         macd_val,
            "macd_signal":  macd_sig,
            "macd_prev":    macd_prev,
            "macd_sig_prev": macd_sig_prev,
            "bb_upper":     bb_upper,
            "bb_lower":     bb_lower,
            "bb_mid":       bb_mid,
            "sma20":        sma20,
            "sma50":        sma50,
            "sma200":       sma200,
            "sma20_prev":   sma20_prev,
            "sma50_prev":   sma50_prev,
            "sma200_prev":  sma200_prev,
            "atr":          atr,
            "vol_sma20":    vol_sma20,
        }
    except Exception as e:
        log.warning(f"[MARKET] Error calculando indicadores para {ticker}: {e}")
        return None


def _get_current_price(ticker: str) -> dict | None:
    """Obtiene precio actual rápido (sin recalcular todos los indicadores)."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        hist = t.history(period="2d", interval="1d")
        if hist.empty:
            return None
        price = float(hist["Close"].iloc[-1])
        volume = float(hist["Volume"].iloc[-1])
        prev   = float(hist["Close"].iloc[-2]) if len(hist) > 1 else price
        return {"price": price, "prev_price": prev, "volume": volume}
    except Exception as e:
        log.warning(f"[MARKET] Error obteniendo precio de {ticker}: {e}")
        return None


# ── Detección de señales ──────────────────────────────────────────────────────

def detect_signals(ticker_info: dict, indicators: dict) -> tuple[list[str], int]:
    """
    Detecta señales técnicas y calcula technical_score (-10 a +10).
    Retorna (lista de señales detectadas, score).
    """
    signals = []
    score   = 0

    price    = indicators.get("price")
    rsi      = indicators.get("rsi")
    macd     = indicators.get("macd")
    macd_sig = indicators.get("macd_signal")
    macd_prev = indicators.get("macd_prev")
    macd_sig_prev = indicators.get("macd_sig_prev")
    bb_upper = indicators.get("bb_upper")
    bb_lower = indicators.get("bb_lower")
    sma20    = indicators.get("sma20")
    sma50    = indicators.get("sma50")
    sma200   = indicators.get("sma200")
    sma20_prev  = indicators.get("sma20_prev")
    sma50_prev  = indicators.get("sma50_prev")
    sma200_prev = indicators.get("sma200_prev")
    volume   = indicators.get("volume")
    vol_sma20 = indicators.get("vol_sma20")

    # RSI
    if rsi is not None:
        if rsi < 30:
            signals.append("RSI_OVERSOLD")
            score += 2
        elif rsi > 70:
            signals.append("RSI_OVERBOUGHT")
            score -= 2

    # MACD crossover
    if all(x is not None for x in [macd, macd_sig, macd_prev, macd_sig_prev]):
        if macd_prev < macd_sig_prev and macd > macd_sig:
            signals.append("MACD_BULLISH_CROSS")
            score += 3
        elif macd_prev > macd_sig_prev and macd < macd_sig:
            signals.append("MACD_BEARISH_CROSS")
            score -= 3

    # Precio vs SMA200
    if price is not None and sma200 is not None and sma200_prev is not None:
        prev_price = indicators.get("prev_price", price)
        if prev_price < sma200_prev and price > sma200:
            signals.append("CROSS_ABOVE_SMA200")
            score += 3
        elif prev_price > sma200_prev and price < sma200:
            signals.append("CROSS_BELOW_SMA200")
            score -= 3

    # Golden cross / Death cross (SMA50 cruza SMA200)
    if all(x is not None for x in [sma50, sma200, sma50_prev, sma200_prev]):
        if sma50_prev < sma200_prev and sma50 > sma200:
            signals.append("GOLDEN_CROSS")
            score += 4
        elif sma50_prev > sma200_prev and sma50 < sma200:
            signals.append("DEATH_CROSS")
            score -= 4

    # Volumen anómalo
    if volume is not None and vol_sma20 is not None and vol_sma20 > 0:
        if volume > 2 * vol_sma20:
            signals.append("HIGH_VOLUME")
            score += 1  # neutro, señal de interés

    # Bollinger Bands
    if price is not None:
        if bb_upper is not None and price >= bb_upper:
            signals.append("BB_UPPER_TOUCH")
            score -= 1
        elif bb_lower is not None and price <= bb_lower:
            signals.append("BB_LOWER_TOUCH")
            score += 1

    # Clamp score a [-10, +10]
    score = max(-10, min(10, score))
    return signals, score


# ── Publicación ───────────────────────────────────────────────────────────────

async def publish_signal(redis, db, item: dict, indicators: dict,
                          signals: list[str], score: int) -> None:
    """Publica señal en stream:market y persiste en TimescaleDB."""
    now = datetime.now(timezone.utc)

    payload = {
        "time":            now.isoformat(),
        "ticker":          item["ticker"],
        "name":            item["name"],
        "sector":          item["sector"],
        "asset_type":      item["asset_type"],
        "geo_relevance":   json.dumps(item.get("geo_relevance", [])),
        "price":           indicators.get("price"),
        "volume":          indicators.get("volume"),
        "rsi":             indicators.get("rsi"),
        "macd":            indicators.get("macd"),
        "bb_upper":        indicators.get("bb_upper"),
        "bb_lower":        indicators.get("bb_lower"),
        "sma20":           indicators.get("sma20"),
        "sma50":           indicators.get("sma50"),
        "sma200":          indicators.get("sma200"),
        "atr":             indicators.get("atr"),
        "technical_score": score,
        "signals":         json.dumps(signals),
    }

    await redis.xadd(
        "stream:market",
        {"data": json.dumps(payload, default=str)},
        maxlen=1000,
    )
    log.info(
        f"[MARKET] SEÑAL {item['ticker']} score={score:+d} signals={signals}"
    )

    if db:
        try:
            await db.execute(
                """
                INSERT INTO market_signals
                    (time, ticker, name, sector, asset_type, geo_relevance,
                     price, volume, rsi, macd, bb_upper, bb_lower,
                     sma20, sma50, sma200, atr, technical_score, signals)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
                """,
                now,
                item["ticker"], item["name"], item["sector"], item["asset_type"],
                item.get("geo_relevance", []),
                indicators.get("price"), indicators.get("volume"),
                indicators.get("rsi"), indicators.get("macd"),
                indicators.get("bb_upper"), indicators.get("bb_lower"),
                indicators.get("sma20"), indicators.get("sma50"), indicators.get("sma200"),
                indicators.get("atr"), score, signals,
            )
        except Exception as e:
            log.error(f"[MARKET] Error guardando señal en DB: {e}")


async def persist_price(db, item: dict, indicators: dict) -> None:
    """Persiste precio y todos los indicadores en market_prices."""
    if not db:
        return
    now = datetime.now(timezone.utc)
    price = indicators.get("price")
    try:
        await db.execute(
            """
            INSERT INTO market_prices
                (time, ticker, name, sector, asset_type,
                 open, high, low, close, volume,
                 rsi, macd, macd_signal, bb_upper, bb_lower, bb_mid,
                 sma20, sma50, sma200, atr, vol_sma20, technical_score)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
            """,
            now,
            item["ticker"], item["name"], item["sector"], item["asset_type"],
            price, price, price, price,   # open=high=low=close (precio de cierre diario)
            indicators.get("volume"),
            indicators.get("rsi"), indicators.get("macd"), indicators.get("macd_signal"),
            indicators.get("bb_upper"), indicators.get("bb_lower"), indicators.get("bb_mid"),
            indicators.get("sma20"), indicators.get("sma50"), indicators.get("sma200"),
            indicators.get("atr"), indicators.get("vol_sma20"), 0,
        )
    except Exception as e:
        log.error(f"[MARKET] Error persistiendo precio de {item['ticker']}: {e}")


# ── Ciclo de indicadores diarios ──────────────────────────────────────────────

async def daily_indicators_cycle(redis, db, watchlist: list[dict]) -> None:
    """Descarga OHLCV histórico y recalcula indicadores para todos los tickers."""
    log.info(f"[MARKET] Iniciando ciclo de indicadores diarios ({len(watchlist)} tickers)")
    loop = asyncio.get_running_loop()

    for item in watchlist:
        try:
            indicators = await loop.run_in_executor(
                _executor, _compute_indicators, item["ticker"]
            )
            if indicators is None:
                log.warning(f"[MARKET] Sin datos para {item['ticker']}")
                continue

            await persist_price(db, item, indicators)

            signals, score = detect_signals(item, indicators)
            log.info(
                f"[MARKET] {item['ticker']:8s} precio={indicators['price']:.2f} "
                f"RSI={indicators.get('rsi', 0):.1f} score={score:+d} signals={signals}"
            )

            if abs(score) >= SIGNAL_THRESHOLD:
                await publish_signal(redis, db, item, indicators, signals, score)

        except Exception as e:
            log.error(f"[MARKET] Error procesando {item['ticker']}: {e}")

        await asyncio.sleep(1)  # cortesía entre descargas


# ── Loop principal ────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin Market ingestor arrancando...")

    watchlist = load_watchlist()
    log.info(f"Watchlist cargado: {len(watchlist)} tickers")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Señales no se persistirán.")

    last_daily = None  # timestamp del último ciclo diario completo

    while True:
        try:
            now = datetime.now(timezone.utc)
            in_market = is_market_hours()

            # Ciclo diario: una vez al día (o si nunca se ha ejecutado)
            today = now.date()
            if last_daily != today:
                await daily_indicators_cycle(redis, db, watchlist)
                last_daily = today

            interval = POLL_INTERVAL if in_market else POLL_INTERVAL_OFF
            log.info(
                f"[MARKET] {'En horario' if in_market else 'Fuera de horario'} — "
                f"próximo ciclo en {interval}s"
            )
            await asyncio.sleep(interval)

        except Exception as e:
            log.error(f"[MARKET] Error en loop principal: {e}")
            await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
