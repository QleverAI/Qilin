"""Unit tests for tag_topics() and load_catalog()."""
import pytest
from topic_utils import tag_topics, load_catalog


CATALOG = [
    {"id": "petroleo", "keywords": ["crude oil", "WTI", "petróleo"]},
    {"id": "nvidia",   "keywords": ["Nvidia", "NVDA", "H100"]},
    {"id": "ucrania",  "keywords": ["Ukraine", "Ucrania", "Putin"]},
]


def test_tag_topics_single_match():
    tags = tag_topics("WTI prices fall as OPEC meets", CATALOG)
    assert tags == ["petroleo"]


def test_tag_topics_multiple_matches():
    tags = tag_topics("Nvidia H100 chips banned from Ukraine export", CATALOG)
    assert set(tags) == {"nvidia", "ucrania"}


def test_tag_topics_case_insensitive():
    tags = tag_topics("nvidia nvda reports earnings", CATALOG)
    assert "nvidia" in tags


def test_tag_topics_no_match():
    tags = tag_topics("The weather in Paris is sunny", CATALOG)
    assert tags == []


def test_tag_topics_empty_text():
    tags = tag_topics("", CATALOG)
    assert tags == []


def test_load_catalog_returns_list():
    catalog = load_catalog("/app/config/topics.yaml")
    # When file doesn't exist, returns []
    assert isinstance(catalog, list)


def test_tag_topics_partial_keyword_match():
    # "petróleo" keyword appears as substring → should match
    tags = tag_topics("El precio del petróleo baja hoy", CATALOG)
    assert "petroleo" in tags
