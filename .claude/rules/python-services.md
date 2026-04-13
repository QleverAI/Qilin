---
description: Reglas para los servicios Python de Qilin (ingestores, alert-engine, api)
globs: services/**/*.py
---

# Reglas Python — Servicios Qilin

## Asyncio
- Todo el código es async — nunca usar `time.sleep()`, solo `await asyncio.sleep()`
- No usar `requests`, solo `httpx.AsyncClient` con contexto `async with`
- Conexiones a Redis y DB se abren una sola vez al arrancar, no en cada request

## Logging
- Usar `log = logging.getLogger(__name__)` después del `basicConfig`
- Prefijos de módulo en el formato: `%(asctime)s [ADSB] %(message)s`
- Nunca usar `print()` en servicios

## Variables de entorno
- Siempre `os.getenv("KEY", "default_value")` — nunca hardcodear
- Variables sensibles (tokens, passwords) sin valor por defecto o con string vacío `""`

## Redis Streams
- `last_id = "$"` para leer solo mensajes nuevos desde que arranca el servicio
- `maxlen=500` en `xadd` para streams de alertas (evitar crecimiento ilimitado)
- Usar `decode_responses=True` en `aioredis.from_url`

## Manejo de errores
- Los bucles principales deben capturar excepciones y continuar (no crashear el servicio)
- Loguear errores con `log.error(f"...")` o `log.warning(f"...")` según severidad
- Las conexiones a DB son opcionales — si fallan, el servicio sigue funcionando sin persistencia

## FastAPI
- Usar `Depends(get_current_user)` en todos los endpoints que requieran auth
- Los eventos `startup`/`shutdown` manejan el ciclo de vida de conexiones
- El WebSocket en `/ws` acepta token como query param para evitar problemas con headers
