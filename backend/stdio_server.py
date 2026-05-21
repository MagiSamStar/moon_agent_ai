from datetime import datetime, timedelta
import os
from pathlib import Path
import re
import time
from typing import Any
import certifi
import dotenv
import google_auth_httplib2
import httplib2
import requests
from fastmcp import FastMCP
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
dotenv.load_dotenv(REPO_ROOT / ".env")
dotenv.load_dotenv(BACKEND_DIR / ".env", override=True)
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
DEFAULT_TIMEZONE = os.getenv("CALENDAR_TIMEZONE", "America/New_York")
NOTION_API_VERSION = os.getenv("NOTION_API_VERSION", "2022-06-28")

mcp = FastMCP(
    name="MoonAgentServer",
    instructions=(
        "Moon Agent tools for moon data, planetary data, Google Calendar "
        "events, and Notion page creation."
    ),
)


def _required_env(name: str, fallback_name: str | None = None) -> str:
    value = os.getenv(name)
    if not value and fallback_name:
        value = os.getenv(fallback_name)
    if not value:
        names = f"{name} or {fallback_name}" if fallback_name else name
        raise RuntimeError(f"Missing required environment variable: {names}")
    return value


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _ssl_verify() -> bool | str:
    value = os.getenv("MOON_AGENT_SSL_VERIFY", "true").strip().lower()
    if value in {"0", "false", "no", "off"}:
        return False
    return certifi.where()


def _cache_key(name: str, lat: str, lon: str) -> str:
    return f"{name}:{lat}:{lon}"


def _get_cached_moon_data(key: str) -> dict[str, Any] | None:
    cached = moon_data_cache.get(key)
    if not cached:
        return None
    if cached["expires_at"] < time.time():
        moon_data_cache.pop(key, None)
        return None
    return cached["value"]


def _set_cached_moon_data(key: str, value: dict[str, Any]) -> None:
    moon_data_cache[key] = {
        "expires_at": time.time() + MOON_DATA_CACHE_TTL_SECONDS,
        "value": value,
    }


CALENDAR_AUTH_TIMEOUT_SECONDS = _env_int("CALENDAR_AUTH_TIMEOUT_SECONDS", 120)
CALENDAR_API_TIMEOUT_SECONDS = _env_int("CALENDAR_API_TIMEOUT_SECONDS", 30)
MOON_DATA_CACHE_TTL_SECONDS = _env_int("MOON_DATA_CACHE_TTL_SECONDS", 10800)
PRODUCTION_DEMO_MODE = _env_bool("PRODUCTION_DEMO_MODE", False)
CALENDAR_ENABLED = _env_bool("CALENDAR_ENABLED", not PRODUCTION_DEMO_MODE)
NOTION_ENABLED = _env_bool("NOTION_ENABLED", not PRODUCTION_DEMO_MODE)
moon_data_cache: dict[str, dict[str, Any]] = {}


def _path_from_env(name: str) -> Path | None:
    value = os.getenv(name)
    if not value:
        return None

    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def _oauth_file_path(env_name: str, filename: str, *, writable: bool = False) -> Path:
    env_path = _path_from_env(env_name)
    if env_path:
        return env_path

    backend_path = BACKEND_DIR / filename
    repo_path = REPO_ROOT / filename
    if backend_path.exists():
        return backend_path
    if repo_path.exists():
        return repo_path
    return backend_path if writable else repo_path


class _TimeoutSession(requests.Session):
    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        kwargs.setdefault("timeout", CALENDAR_API_TIMEOUT_SECONDS)
        return super().request(method, url, **kwargs)


def _rapidapi_headers() -> dict[str, str]:
    return {
        "x-rapidapi-key": _required_env("RAPIDAPI_KEY"),
        "x-rapidapi-host": "moon-phase.p.rapidapi.com",
        "Content-Type": "application/json",
    }


def _get_calendar_service() -> Any:
    creds = None
    token_path = _oauth_file_path("GOOGLE_TOKEN_FILE", "token.json", writable=True)
    client_secret_path = _oauth_file_path(
        "GOOGLE_CLIENT_SECRET_FILE",
        "moon_agent.json",
    )

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), CALENDAR_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request(session=_TimeoutSession()))
        else:
            if not client_secret_path.exists():
                raise FileNotFoundError(
                    "Missing Google OAuth client file. Set GOOGLE_CLIENT_SECRET_FILE "
                    f"or place moon_agent.json at {BACKEND_DIR} or {REPO_ROOT}."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(client_secret_path), CALENDAR_SCOPES
            )
            creds = flow.run_local_server(
                port=0,
                timeout_seconds=CALENDAR_AUTH_TIMEOUT_SECONDS,
            )

        token_path.parent.mkdir(parents=True, exist_ok=True)
        with token_path.open("w", encoding="utf-8") as token:
            token.write(creds.to_json())

    http = google_auth_httplib2.AuthorizedHttp(
        creds,
        http=httplib2.Http(timeout=CALENDAR_API_TIMEOUT_SECONDS),
    )
    return build("calendar", "v3", http=http, cache_discovery=False)


def _notion_headers() -> dict[str, str]:
    notion_token = (
        os.getenv("NOTION_TOKEN")
        or os.getenv("NOTION_KEY")
        or os.getenv("Notion_key")
    )
    if not notion_token:
        raise RuntimeError(
            "Missing required environment variable: NOTION_TOKEN or NOTION_KEY"
        )

    return {
        "Authorization": f"Bearer {notion_token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_API_VERSION,
    }


def _normalize_notion_id(value: str) -> str | None:
    compact = value.strip().replace("-", "")
    if re.fullmatch(r"[0-9a-fA-F]{32}", compact):
        return compact

    # Handles copied Notion URLs/slugs like "Page-title-32hexchars".
    matches = re.findall(r"[0-9a-fA-F]{32}", compact)
    if matches:
        return matches[-1]

    return None


@mcp.tool
def get_moon() -> dict[str, Any]:
    """Get the current moon phase and illumination data."""
    lat = os.getenv("MOON_LAT", "51.4768")
    lon = os.getenv("MOON_LON", "-0.0004")
    cache_key = _cache_key("get_moon", lat, lon)
    cached = _get_cached_moon_data(cache_key)
    if cached is not None:
        return cached

    response = requests.get(
        "https://moon-phase.p.rapidapi.com/basic",
        headers=_rapidapi_headers(),
        params={
            "lat": lat,
            "lon": lon,
            "timestamp": str(int(time.time())),
        },
        timeout=20,
        verify=_ssl_verify(),
    )
    response.raise_for_status()
    data = response.json()
    _set_cached_moon_data(cache_key, data)
    return data


@mcp.tool
def get_planet() -> dict[str, Any]:
    """Get the current planetary moon data, including sign and house details."""
    lat = os.getenv("MOON_LAT", "40.73468964462097")
    lon = os.getenv("MOON_LON", "-74.25255582575559")
    cache_key = _cache_key("get_planet", lat, lon)
    cached = _get_cached_moon_data(cache_key)
    if cached is not None:
        return cached

    response = requests.get(
        "https://moon-phase.p.rapidapi.com/astrology",
        headers=_rapidapi_headers(),
        params={
            "lat": lat,
            "lon": lon,
            "timestamp": str(int(time.time())),
        },
        timeout=20,
        verify=_ssl_verify(),
    )
    response.raise_for_status()
    data = response.json()
    moon_data = data.get("points", {}).get("moon", data)
    _set_cached_moon_data(cache_key, moon_data)
    return moon_data


@mcp.tool
def create_calendar_event(title: str, description: str, hours_from_now: int = 2) -> str:
    """Create a 30-minute Google Calendar event and return its link."""
    if not CALENDAR_ENABLED:
        return (
            "Google Calendar is disabled in this production demo. "
            "I can still suggest a schedule you can add manually."
        )

    start_time = datetime.now() + timedelta(hours=hours_from_now)
    end_time = start_time + timedelta(minutes=30)

    event = {
        "summary": title,
        "description": description,
        "start": {
            "dateTime": start_time.isoformat(),
            "timeZone": DEFAULT_TIMEZONE,
        },
        "end": {
            "dateTime": end_time.isoformat(),
            "timeZone": DEFAULT_TIMEZONE,
        },
    }

    try:
        service = _get_calendar_service()
    except TimeoutError:
        return (
            "Calendar auth timed out. Re-run the agent, approve the browser "
            f"OAuth prompt within {CALENDAR_AUTH_TIMEOUT_SECONDS} seconds, "
            "or delete token.json and authenticate again."
        )
    except RefreshError as error:
        return f"Calendar auth failed. Delete token.json and re-authenticate: {error}"
    except Exception as error:
        return f"Calendar auth failed: {error}"

    try:
        created_event = service.events().insert(calendarId="primary", body=event).execute()
        calendar_link = created_event.get("htmlLink")
        if calendar_link:
            return f"[Open in Calendar]({calendar_link})"
        return "Calendar event created."
    except HttpError as error:
        return f"Calendar API error: {error}"
    except TimeoutError:
        return (
            "Calendar API timed out while creating the event. "
            f"Timeout is {CALENDAR_API_TIMEOUT_SECONDS} seconds."
        )
    except Exception as error:
        return f"Calendar event failed: {error}"


@mcp.tool
def create_notion_page(
    title: str,
    content: str,
    parent_page_id: str | None = None,
) -> str:
    """Create a Notion page under a shared parent page and return its URL."""
    if not NOTION_ENABLED:
        return (
            "Notion saving is disabled in this production demo. "
            "I can still format this as a reflection you can copy into Notion."
        )

    parent_id = parent_page_id or os.getenv("NOTION_PARENT_PAGE_ID")
    if not parent_id:
        return (
            "Missing Notion parent page. Add NOTION_PARENT_PAGE_ID to .env, "
            "or pass parent_page_id directly."
        )

    normalized_parent_id = _normalize_notion_id(parent_id)
    if not normalized_parent_id:
        return (
            "Invalid Notion parent page ID. Use the 32-character page ID from "
            "a Notion page link, or paste the full Notion page URL into "
            "NOTION_PARENT_PAGE_ID."
        )

    payload = {
        "parent": {"page_id": normalized_parent_id},
        "properties": {
            "title": {
                "title": [
                    {
                        "type": "text",
                        "text": {"content": title},
                    }
                ]
            }
        },
        "children": [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": content[:2000]},
                        }
                    ]
                },
            }
        ],
    }

    response = requests.post(
        "https://api.notion.com/v1/pages",
        headers=_notion_headers(),
        json=payload,
        timeout=20,
        verify=_ssl_verify(),
    )
    if response.status_code >= 400:
        return (
            f"Notion API error {response.status_code}: {response.text}. "
            "Confirm the parent page is shared with your Notion integration."
        )

    data = response.json()
    notion_link = data.get("url")
    if notion_link:
        return f"[Open in Notion]({notion_link})"
    return "Notion page created."


@mcp.tool
def create_notion_database_entry(
    title: str,
    content: str,
    database_id: str | None = None,
    title_property: str | None = None,
) -> str:
    """Create a Notion database row/page and return its URL."""
    if not NOTION_ENABLED:
        return (
            "Notion database saving is disabled in this production demo. "
            "I can still format this as an entry you can copy into Notion."
        )

    raw_database_id = database_id or os.getenv("NOTION_DATABASE_ID")
    if not raw_database_id:
        return (
            "Missing Notion database ID. Add NOTION_DATABASE_ID to .env, "
            "or pass database_id directly."
        )

    normalized_database_id = _normalize_notion_id(raw_database_id)
    if not normalized_database_id:
        return (
            "Invalid Notion database ID. Use the 32-character database ID from "
            "a Notion database link, or paste the full database URL into "
            "NOTION_DATABASE_ID."
        )

    title_property_name = title_property or os.getenv(
        "NOTION_DATABASE_TITLE_PROPERTY",
        "Name",
    )

    payload = {
        "parent": {"database_id": normalized_database_id},
        "properties": {
            title_property_name: {
                "title": [
                    {
                        "type": "text",
                        "text": {"content": title},
                    }
                ]
            }
        },
        "children": [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": content[:2000]},
                        }
                    ]
                },
            }
        ],
    }

    response = requests.post(
        "https://api.notion.com/v1/pages",
        headers=_notion_headers(),
        json=payload,
        timeout=20,
        verify=_ssl_verify(),
    )
    if response.status_code >= 400:
        return (
            f"Notion database API error {response.status_code}: {response.text}. "
            "Confirm the database is shared with your Notion integration, "
            "and that NOTION_DATABASE_TITLE_PROPERTY matches the database title column."
        )

    data = response.json()
    notion_link = data.get("url")
    if notion_link:
        return f"[Open in Notion]({notion_link})"
    return "Notion database entry created."


if __name__ == "__main__":
    mcp.run(show_banner=False)
