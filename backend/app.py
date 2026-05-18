from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from creative_agent import create_affirmation_card
from moon_agent_core import create_moon_graph, process_message

app = FastAPI()

graph = None
client = None
conversation = []

# Allow your Vite frontend
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
    await client.__aexit__(None, None, None)


@app.post("/chat")
async def chat(request: ChatRequest):
    global conversation

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
