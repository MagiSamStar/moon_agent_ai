import os
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from creative_agent import create_affirmation_card
from moon_agent_core import create_moon_graph, process_message

app = FastAPI()

graph = None
client = None
conversation = []
chat_usage: dict[str, list[float]] = {}

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


def wants_affirmation_card(message: str) -> bool:
    normalized = message.lower()
    return (
        "affirmation card" in normalized
        or "create a card" in normalized
        or "make a card" in normalized
    )


@app.post("/affirmation-card")
async def affirmation_card(request: ChatRequest):
    card = await create_affirmation_card(request.message)
    return card.model_dump()


@app.get("/")
async def root():
    return {"message": "Moon Agent API running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

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

    response, conversation = await process_message(
        graph,
        conversation,
        request.message
    )

    card = None
    if wants_affirmation_card(request.message):
        card = await create_affirmation_card(response)

    return {
        "response": response,
        "affirmation_card": card.model_dump() if card else None,
    }
