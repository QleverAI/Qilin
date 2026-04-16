"""
Qilin — SEC Filing Classifier.
Classifies 8-K severity and computes relevance based on corporate event keywords.
Separate from the geopolitical classifier in ingestor_docs — different domain.
"""

# Keywords that indicate HIGH severity 8-K events
HIGH_KEYWORDS: frozenset[str] = frozenset({
    "merger", "acquisition", "acquired by", "takeover", "buyout",
    "bankruptcy", "chapter 11", "insolvency", "receivership", "going concern",
    "cybersecurity incident", "material cybersecurity",
    "restatement", "non-reliance", "accounting error",
    "sec investigation", "doj investigation", "department of justice",
    "material adverse", "material weakness",
    "export control violation", "export license revocation",
    "sanctions violation",
})

# Keywords that indicate MEDIUM severity 8-K events
MEDIUM_KEYWORDS: frozenset[str] = frozenset({
    "contract award", "government contract", "department of defense",
    "dod contract", "pentagon", "nato contract",
    "export control", "export license", "commerce department",
    "chief executive", "ceo departure", "cfo departure",
    "president appointed", "appointed as",
    "guidance revision", "revenue guidance", "earnings guidance",
    "new facility", "plant expansion",
    "joint venture", "strategic partnership",
    "sanctions", "restricted", "blacklist", "entity list",
})

# Sector-specific relevance bonus
SECTOR_BONUS: dict[str, int] = {
    "defense":        15,
    "semiconductors": 12,
    "cyber_infra":    10,
    "energy":          8,
    "financials":      5,
}


def classify_severity(title: str, sector: str) -> str:
    """
    Returns 'high', 'medium', or 'low' for an 8-K filing.
    Defense sector always gets at least 'medium' (any 8-K from a defense prime is notable).
    """
    title_lower = title.lower()
    if any(kw in title_lower for kw in HIGH_KEYWORDS):
        return "high"
    if any(kw in title_lower for kw in MEDIUM_KEYWORDS):
        return "medium"
    if sector == "defense":
        return "medium"
    return "low"


def compute_relevance(sector: str, priority: str, severity: str) -> int:
    """
    Computes relevance score 0-100.
    priority: 'high' | 'medium' (from sec_sources.yaml)
    severity: 'high' | 'medium' | 'low' (from classify_severity)
    """
    score  = 30 if priority == "high" else 15
    score += SECTOR_BONUS.get(sector, 0)
    score += {"high": 20, "medium": 10, "low": 0}.get(severity, 0)
    return min(score, 100)
