"""
CDSE HTTP client con token manager OAuth2.
El token de CDSE expira cada ~10 minutos; lo renovamos automáticamente
60 segundos antes de que caduque para que nunca hagamos requests sin token.
"""

import logging
import time
from datetime import datetime, timezone, timedelta

import httpx

log = logging.getLogger(__name__)

CDSE_TOKEN_URL    = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CDSE_CATALOGUE_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1"

_RENEW_MARGIN = 60  # renovar cuando queden menos de 60s de validez


class CdseClient:
    """Cliente CDSE con token manager integrado.

    Uso:
        client = CdseClient(user, password)
        granule = await client.find_latest_granule(zone_cfg, "L2__NO2___")
        await client.close()
    """

    def __init__(self, user: str, password: str) -> None:
        self._user     = user
        self._password = password
        self._http     = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=5),
        )
        self._token:      str | None = None
        self._expires_at: float      = 0.0  # time.monotonic()

    async def close(self) -> None:
        await self._http.aclose()

    # ── Token manager ─────────────────────────────────────────────────────────

    async def get_token(self) -> str | None:
        """Devuelve el token vigente, renovándolo si está próximo a expirar."""
        if not self._user or not self._password:
            return None
        if self._token and time.monotonic() < self._expires_at - _RENEW_MARGIN:
            return self._token
        return await self._renew_token()

    async def _renew_token(self) -> str | None:
        try:
            r = await self._http.post(
                CDSE_TOKEN_URL,
                data={
                    "grant_type": "password",
                    "username":   self._user,
                    "password":   self._password,
                    "client_id":  "cdse-public",
                },
            )
            r.raise_for_status()
            data        = r.json()
            self._token = data["access_token"]
            expires_in  = int(data.get("expires_in", 600))
            self._expires_at = time.monotonic() + expires_in
            log.info("[SENTINEL] Token CDSE renovado, válido %ds", expires_in)
            return self._token
        except Exception as exc:
            log.error("[SENTINEL] Error renovando token CDSE: %s", exc)
            self._token      = None
            self._expires_at = 0.0
            return None

    # ── Búsqueda de granules ──────────────────────────────────────────────────

    async def find_latest_granule(self, zone_cfg: dict, product: str) -> dict | None:
        """
        Busca el granule más reciente (<24h) para el producto dado que
        intersecta la bounding box de la zona.

        zone_cfg: {"lat": [lat_min, lat_max], "lon": [lon_min, lon_max], ...}
        product:  "L2__NO2___" o "L2__SO2___"
        """
        token = await self.get_token()
        if not token:
            return None

        lat_min, lat_max = zone_cfg["lat"]
        lon_min, lon_max = zone_cfg["lon"]
        since = (
            datetime.now(timezone.utc) - timedelta(hours=24)
        ).strftime("%Y-%m-%dT%H:%M:%SZ")

        # WKT: POLYGON((min_lon min_lat, max_lon min_lat, max_lon max_lat, min_lon max_lat, min_lon min_lat))
        bbox_wkt = (
            f"POLYGON(({lon_min} {lat_min},{lon_max} {lat_min},"
            f"{lon_max} {lat_max},{lon_min} {lat_max},{lon_min} {lat_min}))"
        )

        odata_filter = (
            f"Collection/Name eq 'SENTINEL-5P' and "
            f"Attributes/OData.CSC.StringAttribute/any("
            f"att:att/Name eq 'productType' and "
            f"att/OData.CSC.StringAttribute/Value eq '{product}') and "
            f"OData.CSC.Intersects(area=geography'SRID=4326;{bbox_wkt}') and "
            f"ContentDate/Start gt {since}"
        )

        try:
            r = await self._http.get(
                f"{CDSE_CATALOGUE_URL}/Products",
                params={
                    "$filter":  odata_filter,
                    "$orderby": "ContentDate/Start desc",
                    "$top":     "1",
                    "$expand":  "Attributes",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            items = r.json().get("value", [])
            return items[0] if items else None
        except Exception as exc:
            log.warning("[SENTINEL] Error buscando granule %s: %s", product, exc)
            return None
