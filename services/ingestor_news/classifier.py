"""
Qilin — Clasificador de noticias por sector y severidad.
Lógica pura sin efectos secundarios — facilita testing.
"""

SECTOR_KEYWORDS: dict[str, list[str]] = {
    "militar": [
        "strike", "airstrike", "missile", "troops", "warship", "drone",
        "offensive", "ceasefire", "shelling", "bombardment", "tank",
        "fighter jet", "naval", "military operation", "armed forces",
        "artillery", "infantry", "battalion", "combat", "casualties",
        "frontline", "ammunition", "weapons", "air defense", "airspace",
        "navy", "army", "air force", "deployment", "siege", "artillery fire",
    ],
    "diplomacia": [
        "sanctions", "treaty", "negotiations", "summit", "ambassador",
        "ultimatum", "veto", "resolution", "un security council",
        "bilateral", "diplomatic", "envoy", "foreign minister",
        "secretary of state", "communique", "nato", "g7", "g20",
        "talks", "agreement", "deal", "accord", "expel", "recall",
        "embassy", "foreign policy", "multilateral", "united nations",
    ],
    "economia": [
        "sanctions", "tariff", "embargo", "export ban", "swift", "imf",
        "default", "currency", "trade war", "gdp", "inflation",
        "recession", "debt", "bond", "reserve", "world bank", "wto",
        "supply chain", "semiconductor", "economic", "financial crisis",
    ],
    "energia": [
        "pipeline", "lng", "oil", "gas", "opec", "nuclear plant",
        "blackout", "energy deal", "power grid", "refinery",
        "nord stream", "electricity", "fuel", "petrol", "barrel",
        "energy supply", "natural gas", "crude", "coal",
    ],
    "ciberseguridad": [
        "cyberattack", "ransomware", "data breach", "hack", "malware",
        "critical infrastructure", "apt", "phishing", "zero-day",
        "cyber espionage", "ddos", "intrusion", "cyber operation",
        "cybersecurity", "vulnerability", "exploit",
    ],
    "crisis_humanitaria": [
        "refugees", "famine", "displacement", "civilian casualties",
        "aid convoy", "hospital", "evacuation", "humanitarian",
        "displaced", "starvation", "siege", "blockade", "war crimes",
        "icc", "genocide", "exodus", "civilian", "children killed",
    ],
    "nuclear": [
        "nuclear", "warhead", "icbm", "uranium", "plutonium", "iaea",
        "enrichment", "ballistic missile", "deterrence", "nonproliferation",
        "dirty bomb", "radiation", "nuclear deal", "npt", "nuclear test",
        "nuclear program",
    ],
}

# Keywords que garantizan severidad HIGH sin importar sectores
CRITICAL_KEYWORDS: set[str] = {
    "nuclear strike", "nuclear attack", "invasion", "war declared",
    "coup", "airstrike kills", "missile strike", "ceasefire broken",
    "martial law", "state of emergency", "genocide", "war crimes",
    "nuclear test", "icbm launched", "aircraft carrier deployed",
    "invaded", "full-scale", "direct confrontation",
}

# Sectores que por sí solos elevan a MEDIUM
ACTIVE_SECTORS: set[str] = {"militar", "nuclear", "ciberseguridad"}


def classify_sectors(title: str, summary: str) -> list[str]:
    """
    Devuelve lista de sectores detectados en title + summary.
    Comparación case-insensitive.
    """
    text = (title + " " + summary).lower()
    return [
        sector
        for sector, keywords in SECTOR_KEYWORDS.items()
        if any(kw in text for kw in keywords)
    ]


def classify_severity(title: str, sectors: list[str]) -> str:
    """
    Calcula severidad (high/medium/low) a partir del título y los sectores.
    El título se usa para keywords críticos; los sectores para lógica de combinación.
    """
    title_lower = title.lower()
    if any(kw in title_lower for kw in CRITICAL_KEYWORDS):
        return "high"
    active_present = set(sectors) & ACTIVE_SECTORS
    if active_present:
        return "medium"
    if len(sectors) >= 2:
        return "medium"
    return "low"


def compute_relevance(source: dict, sectors: list[str], severity: str) -> int:
    """
    Calcula score de relevancia 0-100.
    source debe tener campo 'priority' (high|medium).
    """
    score = 30 if source.get("priority") == "high" else 15
    score += min(len(sectors) * 8, 50)
    score += {"high": 20, "medium": 10, "low": 0}.get(severity, 0)
    return min(score, 100)
