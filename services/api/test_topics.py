"""Tests for /topics, /me/topics, /me/telegram endpoints."""
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient


def _make_conn_mock():
    """Return a mock connection that supports transaction() context manager."""
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=None)
    # transaction() must be a sync call returning an async context manager
    tx_cm = AsyncMock()
    tx_cm.__aenter__ = AsyncMock(return_value=None)
    tx_cm.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx_cm)
    return conn


@pytest.fixture
def client():
    from main import app, get_current_user
    mock_db = AsyncMock()
    app.state.db = mock_db
    app.state.redis = AsyncMock()
    app.state.redis.get = AsyncMock(return_value=None)
    app.dependency_overrides[get_current_user] = lambda: "testuser"

    # Wire acquire() as an async context manager that yields conn
    conn = _make_conn_mock()
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=False)
    mock_db.acquire = MagicMock(return_value=acquire_cm)

    return TestClient(app), mock_db


def test_get_topics_catalog(client, monkeypatch):
    tc, _ = client
    import topic_utils
    monkeypatch.setattr(topic_utils, "_CATALOG_CACHE", [
        {"id": "oil", "label_es": "Petróleo", "label_en": "Oil", "type": "commodity", "keywords": ["oil"]}
    ])
    resp = tc.get("/topics")
    assert resp.status_code == 200
    data = resp.json()
    assert "topics" in data
    assert len(data["topics"]) > 0
    assert all("id" in t and "type" in t for t in data["topics"])


def test_get_my_topics_empty(client):
    tc, mock_db = client
    # user row
    mock_db.fetchrow = AsyncMock(return_value={"id": 1, "plan": "free"})
    # topics rows
    mock_db.fetch = AsyncMock(return_value=[])
    resp = tc.get("/me/topics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["topics"] == []
    assert data["limit"] == 2
    assert data["plan"] == "free"


def test_put_my_topics_valid(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1, "plan": "scout"})
    mock_db.execute = AsyncMock(return_value=None)
    resp = tc.put("/me/topics", json={"topics": ["petroleo", "nvidia"]})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_put_my_topics_exceeds_limit(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1, "plan": "free"})
    resp = tc.put("/me/topics", json={"topics": ["petroleo", "nvidia", "oro"]})
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "exceeds_plan_limit"
    assert resp.json()["detail"]["limit"] == 2


def test_put_my_topics_pro_plan_unlimited(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1, "plan": "pro"})
    mock_db.execute = AsyncMock(return_value=None)
    # Pro plan has no limit — 25 topics should succeed
    many_topics = [f"topic_{i}" for i in range(25)]
    resp = tc.put("/me/topics", json={"topics": many_topics})
    assert resp.status_code == 200


def test_get_telegram(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"telegram_chat_id": "123456"})
    resp = tc.get("/me/telegram")
    assert resp.status_code == 200
    data = resp.json()
    assert data["chat_id"] == "123456"
    assert data["configured"] is True


def test_put_telegram(client):
    tc, mock_db = client
    mock_db.execute = AsyncMock(return_value=None)
    resp = tc.put("/me/telegram", json={"chat_id": "987654"})
    assert resp.status_code == 200


def test_telegram_test_no_chat_id(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"telegram_chat_id": None})
    resp = tc.post("/me/telegram/test")
    assert resp.status_code == 400


def test_news_feed_topics_only_returns_filtered(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1})
    mock_db.fetch = AsyncMock(side_effect=[
        [{"topic_id": "petroleo"}],
        [{"id": 1, "title": "WTI falls", "topics": ["petroleo"], "time": "2026-01-01T00:00:00"}],
    ])
    resp = tc.get("/news/feed?topics_only=true")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "WTI falls"


def test_news_feed_topics_only_empty_when_no_topics(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1})
    mock_db.fetch = AsyncMock(return_value=[])
    resp = tc.get("/news/feed?topics_only=true")
    assert resp.status_code == 200
    assert resp.json() == []


def test_intel_timeline_topics_only(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1})
    mock_db.fetch = AsyncMock(side_effect=[
        [{"topic_id": "nvidia"}],
        [],
        [],
    ])
    resp = tc.get("/intel/timeline?topics_only=true")
    assert resp.status_code == 200
    assert "items" in resp.json()
