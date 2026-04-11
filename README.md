# Qilin

Plataforma de inteligencia geopolítica en tiempo real. Agrega y correlaciona datos de fuentes públicas — aeronaves (ADS-B), embarcaciones (AIS) y noticias — para generar alertas de eventos geopolíticos.

## Arquitectura

```
ingestor-adsb  ──┐
ingestor-ais   ──┼──► Redis Streams ──► alert-engine ──► Telegram / DB
ingestor-news  ──┘                              │
                                                ▼
                                         FastAPI + WS
                                                │
                                                ▼
                                       React + Deck.gl
```

## Arrancar en local

```bash
cp .env.example .env
# Edita .env con tus credenciales

docker compose up --build
```

- API:       http://localhost:8000
- API docs:  http://localhost:8000/docs

## Servicios

| Servicio | Descripción |
|---|---|
| `ingestor-adsb` | Polling OpenSky Network cada 15s, filtra por zonas |
| `ingestor-ais` | Polling AISHub cada 60s, filtra por zonas |
| `alert-engine` | Motor de reglas, detecta patrones y notifica |
| `api` | FastAPI REST + WebSocket para el dashboard |
| `timescaledb` | Almacenamiento de alertas e historial |
| `redis` | Cache de posiciones actuales + message bus |

## Configuración de zonas

Edita `config/zones.yaml` para añadir, quitar o modificar zonas geográficas monitorizadas.

## Variables de entorno

Ver `.env.example`.
