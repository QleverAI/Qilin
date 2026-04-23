"""Shared helpers for parsing LLM JSON output that may be wrapped in markdown
fences or surrounded by commentary."""
import json
import re

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def clean_json(text: str) -> str:
    """Strip markdown fences and isolate the first balanced top-level JSON object."""
    cleaned = _CODE_FENCE_RE.sub("", text).strip()
    start = cleaned.find("{")
    if start < 0:
        return cleaned
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(cleaned)):
        ch = cleaned[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return cleaned[start : i + 1]
    return cleaned[start:]


def parse_llm_json(text: str) -> dict | None:
    """Parse a JSON object from LLM text. Returns None if no valid object found."""
    try:
        return json.loads(clean_json(text))
    except (json.JSONDecodeError, ValueError):
        return None
