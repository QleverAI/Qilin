# Qilin

Plataforma de inteligencia geopolítica en tiempo real. Agrega y correlaciona datos de fuentes públicas — aeronaves (ADS-B), embarcaciones (AIS) y noticias — para generar alertas de eventos geopolíticos.

## Arquitectura

```
ingestor-adsb     ──┐
ingestor-ais      ──┤
ingestor-news     ──┤                      LLM enrichment
ingestor-sentinel ──┼──► Redis Streams ──► alert-engine ──► Telegram / DB
                     │                    (Claude Haiku)
                     └──────────────────────────┘
                                                │
                                                ▼
                                         FastAPI + WS
                                                │
                                                ▼
                                    React + MapLibre GL (:3000)
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
| `ingestor-adsb` | Polling Airplanes.live `/mil` — todos los militares globales, sin filtro de zona |
| `ingestor-ais` | WebSocket aisstream.io; filtra tankers/military/unknown; detecta AIS dark |
| `ingestor-news` | RSS de 104 medios geopolíticos; clasifica por sector/severidad; extrae og:image |
| `ingestor-social` | RSS vía RSSHub de ~40 cuentas X/Twitter geopolíticas |
| `ingestor-bases` | Detecta aterrizajes y aprende bases/rutas habituales de cada aeronave |
| `ingestor-sentinel` | Copernicus CDSE OAuth2; monitoriza NO₂/SO₂ por zona; detecta anomalías ≥1.5x baseline |
| `alert-engine` | Motor de reglas + enriquecimiento LLM (claude-haiku-4-5); triage automático; notifica Telegram |
| `api` | FastAPI REST + WebSocket para el dashboard |
| `rsshub` | RSSHub self-hosted para fuentes sin RSS directo |
| `timescaledb` | Almacenamiento de alertas, posiciones e historial |
| `redis` | Cache de posiciones actuales + message bus |

## Configuración de zonas

Edita `config/zones.yaml` para añadir, quitar o modificar zonas geográficas monitorizadas.

## Variables de entorno

Ver `.env.example`.

**Nuevas credenciales para ingestores:**
- `AISSTREAM_API_KEY` — API key aisstream.io (gratuito)
- `CDSE_USER` / `CDSE_PASSWORD` — credenciales Copernicus Data Space (registro gratuito)
- `ANTHROPIC_API_KEY` — clave Anthropic para enriquecimiento LLM de alertas

(Nota: `AISHUB_USER` ya no se utiliza — se ha reemplazado por aisstream.io)
