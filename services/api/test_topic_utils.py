"""Unit tests for tag_topics() and load_catalog()."""
import pytest
import topic_utils
from topic_utils import tag_topics, load_catalog


@pytest.fixture(autouse=True)
def reset_catalog_cache():
    topic_utils._reset_cache()
    yield
    topic_utils._reset_cache()


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


def test_load_catalog_reads_yaml(tmp_path):
    catalog_file = tmp_path / "topics.yaml"
    catalog_file.write_text(
        "topics:\n  - id: test\n    keywords: [foo]\n", encoding="utf-8"
    )
    result = load_catalog(str(catalog_file))
    assert result == [{"id": "test", "keywords": ["foo"]}]


def test_tag_topics_empty_catalog():
    assert tag_topics("Nvidia GPU shortage", []) == []


def test_tag_topics_missing_keywords_key():
    bad_catalog = [{"id": "broken"}, {"id": "nvidia", "keywords": ["Nvidia"]}]
    tags = tag_topics("Nvidia release", bad_catalog)
    assert tags == ["nvidia"]
