import calendar
from datetime import datetime, timezone
import os
import re
import time
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from creative_agent import create_affirmation_card
from journal_memory import (
    format_journal_memories,
    list_recent_journal_entries,
    save_journal_entry,
    search_journal_entries,
)
from moon_agent_core import create_moon_graph, process_message

app = FastAPI()

graph = None
client = None
conversation = []
chat_usage: dict[str, list[float]] = {}
moon_calendar_cache: dict[str, dict[str, Any]] = {}

LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]
CHAT_RATE_LIMIT = int(os.getenv("CHAT_RATE_LIMIT", "3"))
CHAT_RATE_LIMIT_WINDOW_SECONDS = int(
    float(os.getenv("CHAT_RATE_LIMIT_WINDOW_HOURS", "24")) * 60 * 60
)
MOON_CALENDAR_CACHE_TTL_SECONDS = int(
    os.getenv("MOON_CALENDAR_CACHE_TTL_SECONDS", "10800")
)
TASK_LINE_PATTERN = re.compile(r"^\s*[-*]\s+\[[ xX]\]\s+(.+?)\s*$")
ZODIAC_SIGNS = (
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
)


def get_allowed_origins() -> list[str]:
    configured_origins = os.getenv("ALLOWED_ORIGINS", "")
    origins = [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]
    return origins or LOCAL_ORIGINS


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_chat_rate_limit(request: Request) -> None:
    client_ip = get_client_ip(request)
    now = time.time()
    window_start = now - CHAT_RATE_LIMIT_WINDOW_SECONDS
    recent_requests = [
        timestamp
        for timestamp in chat_usage.get(client_ip, [])
        if timestamp >= window_start
    ]

    if len(recent_requests) >= CHAT_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Demo chat limit reached. Please try again later.",
        )

    recent_requests.append(now)
    chat_usage[client_ip] = recent_requests


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str


class JournalRequest(BaseModel):
    text: str
    mood: str | None = None
    tags: list[str] | None = None


class JournalSearchRequest(BaseModel):
    query: str
    filters: dict[str, str | int | float | bool] | None = None
    limit: int = 3


def wants_affirmation_card(message: str) -> bool:
    normalized = message.lower()
    return (
        "affirmation card" in normalized
        or "create a card" in normalized
        or "make a card" in normalized
    )


def extract_suggested_tasks(response: str) -> list[str]:
    tasks = []
    for line in response.splitlines():
        match = TASK_LINE_PATTERN.match(line)
        if match:
            task = match.group(1).strip()
            if task:
                tasks.append(task)
    return tasks


def get_current_moon_phase() -> str | None:
    try:
        from stdio_server import get_moon

        moon_data = get_moon()
    except Exception:
        return None

    for key in ("moon_phase", "phase_name", "phase", "moonPhase"):
        value = moon_data.get(key)
        if value:
            return str(value)
    return None


def _first_present(data: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = data.get(key)
        if value is not None and value != "":
            return value
    return None


def _as_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if isinstance(value, str):
            return float(value.strip().rstrip("%"))
        return float(value)
    except (TypeError, ValueError):
        return None


def _zodiac_sign_from_longitude(longitude: Any) -> str | None:
    longitude_number = _as_number(longitude)
    if longitude_number is None:
        return None

    normalized_longitude = longitude_number % 360
    sign_index = int(normalized_longitude // 30)
    return ZODIAC_SIGNS[sign_index]


def _normalize_moon_context(
    moon_data: dict[str, Any] | None,
    planet_data: dict[str, Any] | None,
) -> dict[str, Any]:
    moon_data = moon_data or {}
    planet_data = planet_data or {}
    phase = _first_present(
        moon_data,
        ("phase_name", "moon_phase", "phase", "moonPhase", "phaseName"),
    )
    illumination = _as_number(
        _first_present(
            moon_data,
            ("illumination", "illumination_percentage", "illuminationPercent"),
        )
    )
    next_full_moon = _first_present(
        moon_data,
        ("next_full_moon", "nextFullMoon", "next_full_moon_date"),
    )
    next_new_moon = _first_present(
        moon_data,
        ("next_new_moon", "nextNewMoon", "next_new_moon_date"),
    )
    sign = _first_present(planet_data, ("sign", "zodiac_sign", "zodiacSign"))
    if not sign:
        sign = _zodiac_sign_from_longitude(
            _first_present(planet_data, ("lon", "longitude", "ecliptic_longitude"))
        )
    house = _first_present(planet_data, ("house", "house_number", "houseNumber"))

    return {
        "phase": str(phase or "Moon phase unavailable"),
        "illumination": illumination,
        "sign": str(sign) if sign else None,
        "house": str(house) if house else None,
        "next_full_moon": str(next_full_moon) if next_full_moon else None,
        "next_new_moon": str(next_new_moon) if next_new_moon else None,
        "energy_theme": _energy_theme(str(phase or "")),
        "raw": {
            "moon": moon_data,
            "planet": planet_data,
        },
    }


def _energy_theme(phase: str) -> str:
    normalized = phase.lower()
    if "new" in normalized:
        return "Set intentions and choose a clean starting point."
    if "waxing" in normalized:
        return "Build momentum through focused, practical action."
    if "full" in normalized:
        return "Clarify what is complete and celebrate visible progress."
    if "waning" in normalized:
        return "Release what is heavy and simplify your next step."
    return "Move gently and let the current moon context guide the plan."


def _moon_icon_state(phase: str) -> str:
    normalized = phase.lower()
    if "new" in normalized:
        return "new"
    if "first" in normalized or "waxing" in normalized:
        return "waxing"
    if "full" in normalized:
        return "full"
    if "last" in normalized or "waning" in normalized:
        return "waning"
    return "unknown"


def _timestamp_for_day(year: int, month: int, day: int) -> int:
    return int(datetime(year, month, day, 12, 0, tzinfo=timezone.utc).timestamp())


def _fetch_moon_for_timestamp(timestamp: int) -> dict[str, Any]:
    import requests
    from stdio_server import _rapidapi_headers, _ssl_verify

    lat = os.getenv("MOON_LAT", "40.73468964462097")
    lon = os.getenv("MOON_LON", "-74.25255582575559")
    response = requests.get(
        "https://moon-phase.p.rapidapi.com/basic",
        headers=_rapidapi_headers(),
        params={"lat": lat, "lon": lon, "timestamp": str(timestamp)},
        timeout=20,
        verify=_ssl_verify(),
    )
    response.raise_for_status()
    return response.json()


def _cached_month(year: int, month: int) -> dict[str, Any] | None:
    cache_key = f"{year:04d}-{month:02d}"
    cached = moon_calendar_cache.get(cache_key)
    if not cached or cached["expires_at"] < time.time():
        moon_calendar_cache.pop(cache_key, None)
        return None
    return cached["value"]


def _set_cached_month(year: int, month: int, value: dict[str, Any]) -> None:
    moon_calendar_cache[f"{year:04d}-{month:02d}"] = {
        "expires_at": time.time() + MOON_CALENDAR_CACHE_TTL_SECONDS,
        "value": value,
    }


@app.post("/affirmation-card")
async def affirmation_card(request: ChatRequest):
    card = await create_affirmation_card(request.message)
    return card.model_dump()


@app.post("/journal")
async def create_journal_entry(request: JournalRequest):
    try:
        return save_journal_entry(
            text=request.text,
            mood=request.mood,
            tags=request.tags,
            moon_phase=get_current_moon_phase(),
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to save journal entry: {error}",
        ) from error


@app.get("/journal")
async def get_journal_entries(limit: int = 10):
    try:
        return {"entries": list_recent_journal_entries(limit=limit)}
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to load journal entries: {error}",
        ) from error


@app.post("/journal/search")
async def search_journal(request: JournalSearchRequest):
    try:
        return {
            "entries": search_journal_entries(
                query=request.query,
                limit=request.limit,
                filters=request.filters,
            )
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to search journal entries: {error}",
        ) from error


@app.get("/")
async def root():
    return {"message": "Moon Agent API running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/moon-context")
async def moon_context():
    try:
        from stdio_server import get_moon, get_planet

        moon_data = get_moon()
        planet_data = get_planet()
        return _normalize_moon_context(moon_data, planet_data)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to load moon context: {error}",
        ) from error


@app.get("/moon-calendar")
async def moon_calendar(year: int, month: int):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12.")

    cached = _cached_month(year, month)
    if cached:
        return cached

    try:
        _, days_in_month = calendar.monthrange(year, month)
        days = []
        for day in range(1, days_in_month + 1):
            moon_data = _fetch_moon_for_timestamp(
                _timestamp_for_day(year, month, day)
            )
            phase = str(
                _first_present(
                    moon_data,
                    ("phase_name", "moon_phase", "phase", "moonPhase", "phaseName"),
                )
                or "Moon phase unavailable"
            )
            illumination = _as_number(
                _first_present(
                    moon_data,
                    (
                        "illumination",
                        "illumination_percentage",
                        "illuminationPercent",
                    ),
                )
            )
            days.append(
                {
                    "date": f"{year:04d}-{month:02d}-{day:02d}",
                    "day": day,
                    "phase": phase,
                    "illumination": illumination,
                    "phase_state": _moon_icon_state(phase),
                }
            )

        payload = {"year": year, "month": month, "days": days}
        _set_cached_month(year, month, payload)
        return payload
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to load lunar calendar: {error}",
        ) from error

@app.on_event("startup")
async def startup():
    global graph, client
    graph, client = await create_moon_graph()


@app.on_event("shutdown")
async def shutdown():
    if client:
        await client.__aexit__(None, None, None)


@app.post("/chat")
async def chat(http_request: Request, request: ChatRequest):
    global conversation

    enforce_chat_rate_limit(http_request)

    journal_context = ""
    try:
        memories = search_journal_entries(query=request.message, limit=3)
        journal_context = format_journal_memories(memories)
    except Exception:
        journal_context = ""

    response, conversation = await process_message(
        graph,
        conversation,
        request.message,
        journal_context=journal_context,
    )

    card = None
    if wants_affirmation_card(request.message):
        card = await create_affirmation_card(response)

    return {
        "response": response,
        "affirmation_card": card.model_dump() if card else None,
        "suggested_tasks": extract_suggested_tasks(response),
    }
