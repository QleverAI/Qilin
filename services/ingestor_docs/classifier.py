"""
Qilin — Clasificador de noticias por sector y severidad.
Lógica pura sin efectos secundarios — facilita testing.
"""

SECTOR_KEYWORDS: dict[str, list[str]] = {
    "militar": [
        "airstrike", "missile strike", "military strike", "troops deployed",
        "warship", "drone attack", "military offensive", "ceasefire",
        "shelling", "bombardment", "tank column", "fighter jet",
        "naval operation", "military operation", "armed forces",
        "artillery fire", "infantry advance", "combat operations",
        "frontline", "ammunition depot", "weapons cache", "air defense system",
        "navy ships", "military deployment", "military siege", "air force",
        "troops", "missiles", "naval", "strike",
    ],
    "diplomacia": [
        "sanctions imposed", "peace treaty", "diplomatic negotiations", "bilateral summit",
        "ambassador expelled", "ultimatum", "security council veto",
        "un security council", "diplomatic relations", "foreign minister",
        "secretary of state", "communique", "nato summit", "g7 summit", "g20 summit",
        "diplomatic talks", "peace agreement", "accord signed", "recalled ambassador",
        "embassy closed", "foreign policy", "multilateral", "united nations resolution",
        "sanctions", "treaty", "negotiations", "summit", "diplomatic",
    ],
    "economia": [
        "sanctions regime", "trade tariff", "trade embargo", "export ban",
        "swift exclusion", "imf bailout", "sovereign default", "currency collapse",
        "trade war", "gdp contraction", "hyperinflation", "debt crisis",
        "government bond yield", "central bank reserve", "world bank", "wto dispute",
        "supply chain disruption", "semiconductor ban", "economic sanctions",
        "financial crisis", "sanctions", "tariff", "embargo",
    ],
    "energia": [
        "gas pipeline", "natural gas", "lng shipment", "oil embargo",
        "crude oil", "opec", "nuclear power plant", "power grid attack",
        "energy blackout", "refinery", "nord stream", "electricity supply",
        "fuel shortage", "petrol price", "oil barrel", "energy supply",
        "energy deal", "gas supply", "oil production",
    ],
    "ciberseguridad": [
        "cyberattack", "ransomware", "data breach", "hack", "malware",
        "critical infrastructure", "apt", "phishing", "zero-day",
        "cyber espionage", "ddos", "intrusion", "cyber operation",
        "cybersecurity", "vulnerability", "exploit",
    ],
    "crisis_humanitaria": [
        "refugees", "famine", "mass displacement", "civilian casualties",
        "aid convoy", "humanitarian crisis", "humanitarian corridor",
        "evacuated", "displaced persons", "starvation", "under siege",
        "naval blockade", "war crimes", "icc investigation",
        "genocide", "mass exodus", "children killed", "civilian deaths",
    ],
    "nuclear": [
        "nuclear weapon", "nuclear warhead", "nuclear strike", "nuclear attack",
        "nuclear test", "nuclear program", "nuclear deal", "nuclear reactor meltdown",
        "warhead", "icbm", "uranium enrichment", "plutonium", "iaea inspection",
        "ballistic missile", "deterrence", "nonproliferation",
        "dirty bomb", "npt violation",
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
    score += min(len(sectors) * 8, 50)  # cap at 50 to allow max score of 100
    score += {"high": 20, "medium": 10, "low": 0}.get(severity, 0)
    return min(score, 100)
