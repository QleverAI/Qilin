import logging

import yaml

log = logging.getLogger(__name__)


def load_zones(config_path: str) -> dict:
    """Read config/zones.yaml and return the zones dict."""
    with open(config_path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("zones", {})


def get_zone_bbox(zone_name: str, zones: dict) -> dict:
    """Return {min_lat, max_lat, min_lon, max_lon} for a named zone."""
    zone = zones.get(zone_name, {})
    lats = zone.get("lat", [0, 0])
    lons = zone.get("lon", [0, 0])
    return {
        "min_lat": float(lats[0]),
        "max_lat": float(lats[1]),
        "min_lon": float(lons[0]),
        "max_lon": float(lons[1]),
    }


def point_in_zone(lat: float, lon: float, zone: dict) -> bool:
    """True if (lat, lon) falls within the zone's bounding box."""
    lats = zone.get("lat", [0, 0])
    lons = zone.get("lon", [0, 0])
    return float(lats[0]) <= lat <= float(lats[1]) and float(lons[0]) <= lon <= float(lons[1])


def find_zones_for_point(lat: float, lon: float, zones: dict) -> list[str]:
    """Return list of zone names whose bbox contains (lat, lon)."""
    return [name for name, zone in zones.items() if point_in_zone(lat, lon, zone)]


def get_tickers_for_zone(zone_name: str, watchlist: dict) -> list[str]:
    """
    Return tickers from market_watchlist.yaml whose geo_relevance includes
    the given zone name or 'global'.
    """
    tickers: list[str] = []
    for sector_assets in watchlist.get("equities", {}).values():
        for asset in sector_assets:
            relevance = asset.get("geo_relevance", [])
            if zone_name in relevance or "global" in relevance:
                tickers.append(asset["ticker"])
    return tickers
