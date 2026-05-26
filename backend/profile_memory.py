import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
MEMORY_DIR = BASE_DIR / "memory"
PROFILE_MEMORY_PATH = MEMORY_DIR / "user_profile.json"

DEFAULT_USER_PROFILE = {
    "name": "Demo User",
    "goals": ["plan the day", "build focus", "reflect intentionally"],
    "preferred_planning_style": "spiritual but practical",
    "default_calendar_delay_hours": 2,
}

NAME_PATTERNS = (
    re.compile(r"\bmy name is\s+([A-Za-z][A-Za-z\s'-]{0,48})", re.IGNORECASE),
    re.compile(r"\bcall me\s+([A-Za-z][A-Za-z\s'-]{0,48})", re.IGNORECASE),
)
GOALS_PATTERN = re.compile(r"\bmy goals? (?:are|is)\s+([^.!?\n]+)", re.IGNORECASE)
FOCUS_PATTERN = re.compile(r"\bi want to focus on\s+([^.!?\n]+)", re.IGNORECASE)
STYLE_PATTERN = re.compile(
    r"\bi (?:like|prefer|want)\s+(.{3,80}?\bguidance)\b",
    re.IGNORECASE,
)


def _clean_text(value: str) -> str:
    return value.strip().strip(".!?,;:")


def _dedupe(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        normalized = value.strip().casefold()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(value.strip())
    return result


def _split_goals(value: str) -> list[str]:
    cleaned = _clean_text(value)
    parts = re.split(r",|\band\b", cleaned)
    return [_clean_text(part) for part in parts if _clean_text(part)]


def load_profile_memory() -> dict[str, Any]:
    if not PROFILE_MEMORY_PATH.exists():
        return {}

    try:
        data = json.loads(PROFILE_MEMORY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    return data if isinstance(data, dict) else {}


def save_profile_memory(profile: dict[str, Any]) -> None:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    PROFILE_MEMORY_PATH.write_text(
        json.dumps(profile, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def merged_user_profile() -> dict[str, Any]:
    saved_profile = load_profile_memory()
    merged = dict(DEFAULT_USER_PROFILE)
    merged.update(saved_profile)

    goals = merged.get("goals")
    if isinstance(goals, list):
        merged["goals"] = _dedupe([str(goal) for goal in goals])
    else:
        merged["goals"] = list(DEFAULT_USER_PROFILE["goals"])

    return merged


def extract_profile_updates(message: str) -> dict[str, Any]:
    updates: dict[str, Any] = {}

    for pattern in NAME_PATTERNS:
        match = pattern.search(message)
        if match:
            name = _clean_text(match.group(1))
            updates["name"] = name
            updates["preferred_name"] = name
            break

    goals: list[str] = []
    goals_match = GOALS_PATTERN.search(message)
    if goals_match:
        goals.extend(_split_goals(goals_match.group(1)))

    focus_match = FOCUS_PATTERN.search(message)
    if focus_match:
        goals.extend(_split_goals(focus_match.group(1)))

    if goals:
        updates["goals"] = goals

    style_match = STYLE_PATTERN.search(message)
    if style_match:
        updates["preferred_planning_style"] = _clean_text(style_match.group(1))

    return updates


def remember_profile_from_message(message: str) -> dict[str, Any]:
    updates = extract_profile_updates(message)
    if not updates:
        return merged_user_profile()

    current = merged_user_profile()
    if "goals" in updates:
        current["goals"] = _dedupe(
            [*current.get("goals", []), *updates.pop("goals")]
        )

    current.update(updates)
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        save_profile_memory(current)
    except OSError:
        return current
    return current
