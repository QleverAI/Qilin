import logging
import yaml

log = logging.getLogger(__name__)

_CATALOG_CACHE: list[dict] | None = None


def load_catalog(path: str = "/app/config/topics.yaml") -> list[dict]:
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE
    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        _CATALOG_CACHE = data.get("topics", [])
        log.info("[topic_utils] Loaded %d topics from %s", len(_CATALOG_CACHE), path)
    except FileNotFoundError:
        log.warning("[topic_utils] %s not found, topic tagging disabled", path)
        _CATALOG_CACHE = []
    except Exception as exc:
        log.warning("[topic_utils] Error loading catalog: %s", exc)
        _CATALOG_CACHE = []
    return _CATALOG_CACHE


def tag_topics(text: str, catalog: list[dict]) -> list[str]:
    """Return list of topic IDs whose keywords appear in text (case-insensitive)."""
    if not text or not catalog:
        return []
    text_lower = text.lower()
    return [
        t["id"] for t in catalog
        if any(kw.lower() in text_lower for kw in t.get("keywords", []))
    ]
