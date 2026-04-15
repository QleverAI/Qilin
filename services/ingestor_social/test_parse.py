"""Tests unitarios para parse_tweet — sin dependencias externas."""


def parse_tweet(raw: dict, account: dict, media_map: dict) -> dict:
    """Copia local de la funcion para test aislado — debe coincidir con main.py."""
    media_url = None
    media_type = None
    keys = raw.get("attachments", {}).get("media_keys", [])
    if keys and keys[0] in media_map:
        m = media_map[keys[0]]
        media_type = m.get("type")
        media_url = m.get("url") or m.get("preview_image_url")

    metrics = raw.get("public_metrics", {})
    tweet_id = raw["id"]

    return {
        "tweet_id":   tweet_id,
        "handle":     account["handle"],
        "display":    account["display"],
        "category":   account["category"],
        "zone":       account["zone"],
        "content":    raw["text"],
        "lang":       raw.get("lang"),
        "likes":      metrics.get("like_count", 0),
        "retweets":   metrics.get("retweet_count", 0),
        "url":        f"https://x.com/{account['handle']}/status/{tweet_id}",
        "media_url":  media_url,
        "media_type": media_type,
        "time":       raw.get("created_at", ""),
    }


ACCOUNT = {
    "handle": "IDF",
    "display": "Israel Defense Forces",
    "category": "middle_east_mil",
    "zone": "levante",
}


def test_parse_basic_fields():
    raw = {
        "id": "1234567890",
        "text": "IDF forces operating in northern Gaza.",
        "created_at": "2026-04-16T08:32:00.000Z",
        "public_metrics": {"like_count": 1420, "retweet_count": 380},
        "lang": "en",
    }
    result = parse_tweet(raw, ACCOUNT, {})
    assert result["tweet_id"] == "1234567890"
    assert result["handle"] == "IDF"
    assert result["category"] == "middle_east_mil"
    assert result["zone"] == "levante"
    assert result["likes"] == 1420
    assert result["retweets"] == 380
    assert result["url"] == "https://x.com/IDF/status/1234567890"
    assert result["media_url"] is None
    assert result["media_type"] is None
    assert result["content"] == "IDF forces operating in northern Gaza."


def test_parse_photo_media():
    raw = {
        "id": "9999",
        "text": "Photo tweet.",
        "created_at": "2026-04-16T10:00:00.000Z",
        "public_metrics": {"like_count": 100, "retweet_count": 20},
        "lang": "en",
        "attachments": {"media_keys": ["3_abc123"]},
    }
    media_map = {"3_abc123": {"type": "photo", "url": "https://pbs.twimg.com/photo.jpg"}}
    result = parse_tweet(raw, ACCOUNT, media_map)
    assert result["media_type"] == "photo"
    assert result["media_url"] == "https://pbs.twimg.com/photo.jpg"


def test_parse_video_uses_preview_image():
    raw = {
        "id": "8888",
        "text": "Video tweet.",
        "created_at": "2026-04-16T11:00:00.000Z",
        "public_metrics": {"like_count": 50, "retweet_count": 5},
        "lang": "en",
        "attachments": {"media_keys": ["13_vid"]},
    }
    media_map = {
        "13_vid": {"type": "video", "preview_image_url": "https://pbs.twimg.com/preview.jpg"}
    }
    result = parse_tweet(raw, ACCOUNT, media_map)
    assert result["media_type"] == "video"
    assert result["media_url"] == "https://pbs.twimg.com/preview.jpg"


def test_parse_missing_metrics_defaults_to_zero():
    raw = {"id": "7777", "text": "No metrics.", "created_at": "2026-04-16T12:00:00.000Z"}
    result = parse_tweet(raw, ACCOUNT, {})
    assert result["likes"] == 0
    assert result["retweets"] == 0


def test_parse_unknown_media_key_ignored():
    raw = {
        "id": "6666",
        "text": "Mystery media.",
        "created_at": "2026-04-16T13:00:00.000Z",
        "attachments": {"media_keys": ["unknown_key"]},
    }
    result = parse_tweet(raw, ACCOUNT, {})
    assert result["media_url"] is None
    assert result["media_type"] is None
