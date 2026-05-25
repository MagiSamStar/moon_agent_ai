import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import dotenv

from openai_client import create_embedding_model


BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent
dotenv.load_dotenv(REPO_ROOT / ".env")
dotenv.load_dotenv(BASE_DIR / ".env", override=True)

DEFAULT_COLLECTION_NAME = "moon_journal_memory"
DEFAULT_CHROMA_PATH = BASE_DIR / "chroma_db"
RECOVERED_CHROMA_SUFFIX = "_recovered"

_collection = None
_embedding_model = None


def _resolve_chroma_path() -> Path:
    configured_path = os.getenv("CHROMA_DB_PATH")
    if not configured_path:
        return DEFAULT_CHROMA_PATH

    path = Path(configured_path).expanduser()
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def _create_collection(chroma_path: Path):
    import chromadb
    from chromadb.config import Settings

    chroma_path.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=str(chroma_path),
        settings=Settings(anonymized_telemetry=False),
    )
    return client.get_or_create_collection(
        name=os.getenv("JOURNAL_COLLECTION_NAME", DEFAULT_COLLECTION_NAME),
        metadata={"description": "Moon Agent personal journal memories"},
    )


def _recoverable_chroma_error(error: Exception) -> bool:
    message = str(error).lower()
    return "could not connect to tenant" in message or "default_tenant" in message


def _recovered_chroma_path(chroma_path: Path) -> Path:
    return chroma_path.with_name(f"{chroma_path.name}{RECOVERED_CHROMA_SUFFIX}")


def _get_collection():
    global _collection

    if _collection is not None:
        return _collection

    chroma_path = _resolve_chroma_path()
    try:
        _collection = _create_collection(chroma_path)
    except Exception as error:
        if not _recoverable_chroma_error(error):
            raise
        _collection = _create_collection(_recovered_chroma_path(chroma_path))
    return _collection


def _get_embedding_model():
    global _embedding_model

    if _embedding_model is None:
        _embedding_model = create_embedding_model()
    return _embedding_model


def _normalize_tags(tags: list[str] | None) -> list[str]:
    return [tag.strip() for tag in tags or [] if tag.strip()]


def _metadata_for_api(metadata: dict[str, Any] | None) -> dict[str, Any]:
    if not metadata:
        return {}

    normalized = dict(metadata)
    tags = normalized.get("tags")
    if isinstance(tags, str):
        normalized["tags"] = [tag for tag in tags.split(",") if tag]
    return normalized


def _metadata_for_chroma(
    *,
    created_at: str,
    mood: str | None,
    tags: list[str],
    moon_phase: str | None,
) -> dict[str, str]:
    metadata = {
        "created_at": created_at,
        "entry_type": "journal",
        "tags": ",".join(tags),
    }

    if mood:
        metadata["mood"] = mood
    if moon_phase:
        metadata["moon_phase"] = moon_phase

    return metadata


def _build_where(filters: dict[str, Any] | None) -> dict[str, Any] | None:
    if not filters:
        return {"entry_type": "journal"}

    clauses: list[dict[str, Any]] = [{"entry_type": "journal"}]
    for key, value in filters.items():
        if value is None or isinstance(value, (list, dict)):
            continue
        clauses.append({key: value})

    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def save_journal_entry(
    *,
    text: str,
    mood: str | None = None,
    tags: list[str] | None = None,
    moon_phase: str | None = None,
) -> dict[str, Any]:
    entry_text = text.strip()
    if not entry_text:
        raise ValueError("Journal entry text is required.")

    entry_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    normalized_tags = _normalize_tags(tags)
    metadata = _metadata_for_chroma(
        created_at=created_at,
        mood=mood.strip() if mood else None,
        tags=normalized_tags,
        moon_phase=moon_phase,
    )
    embedding = _get_embedding_model().embed_query(entry_text)

    _get_collection().add(
        ids=[entry_id],
        documents=[entry_text],
        metadatas=[metadata],
        embeddings=[embedding],
    )

    return {
        "id": entry_id,
        "text": entry_text,
        "metadata": _metadata_for_api(metadata),
    }


def list_recent_journal_entries(limit: int = 10) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 50)
    results = _get_collection().get(
        where={"entry_type": "journal"},
        include=["documents", "metadatas"],
    )

    entries = []
    for entry_id, document, metadata in zip(
        results.get("ids", []),
        results.get("documents", []),
        results.get("metadatas", []),
    ):
        entries.append(
            {
                "id": entry_id,
                "text": document,
                "metadata": _metadata_for_api(metadata),
            }
        )

    entries.sort(
        key=lambda entry: entry["metadata"].get("created_at", ""),
        reverse=True,
    )
    return entries[:safe_limit]


def search_journal_entries(
    *,
    query: str,
    limit: int = 3,
    filters: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    search_text = query.strip()
    if not search_text:
        raise ValueError("Search query is required.")

    safe_limit = min(max(limit, 1), 5)
    collection = _get_collection()
    if collection.count() == 0:
        return []

    embedding = _get_embedding_model().embed_query(search_text)
    results = collection.query(
        query_embeddings=[embedding],
        n_results=safe_limit,
        where=_build_where(filters),
        include=["documents", "metadatas", "distances"],
    )

    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    entries = []
    for index, entry_id in enumerate(ids):
        entries.append(
            {
                "id": entry_id,
                "text": documents[index],
                "metadata": _metadata_for_api(metadatas[index]),
                "distance": distances[index],
            }
        )

    return entries


def format_journal_memories(entries: list[dict[str, Any]]) -> str:
    if not entries:
        return ""

    lines = ["Relevant journal memories:"]
    for index, entry in enumerate(entries, start=1):
        metadata = entry.get("metadata", {})
        details = []
        if metadata.get("created_at"):
            details.append(f"date: {metadata['created_at']}")
        if metadata.get("mood"):
            details.append(f"mood: {metadata['mood']}")
        if metadata.get("moon_phase"):
            details.append(f"moon phase: {metadata['moon_phase']}")

        detail_text = f" ({'; '.join(details)})" if details else ""
        lines.append(f"{index}. {entry.get('text', '')}{detail_text}")

    lines.append(
        "Use these memories gently and naturally when they are relevant. "
        "Do not mention raw metadata unless it helps the user's request."
    )
    return "\n".join(lines)
