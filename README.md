# Moon Agent

Moon Agent is a full-stack AI planning assistant that transforms live moon context into grounded daily guidance, practical action plans, and optional saves to Notion or Google Calendar.

The Moon Agent follows a ReAct-style pattern: the model reasons about the request, chooses tools when needed, observes tool outputs, and then produces a grounded response. A final reflection node edits the response for clarity, tone, and readability before it is returned to the
frontend.

This project is built as a local-first agent demo: a React chat UI talks to a FastAPI backend, the backend runs a LangGraph agent, and the agent calls MCP tools for external integrations.
![Moon Agent frontend demo](/docs/moon_agent.png)

## Live Demo

[Try Moon Agent](https://moon-agent-frontend.vercel.app/)

## Why I Built This

I built the Moon Agent to explore how agentic AI systems can combine reflection, planning, external tools, and personalized workflows into a calm, practical daily assistant.

I also implemented a Custom MCP (Model Context Protocol) Server to decouple the tool logic from the agent's reasoning engine. By moving the Notion and Calendar integrations into a standalone FastMCP server, I created a reusable tool layer. This allows the agent to remain 'thin' and modular, while the tool server can be updated or shared across multiple agentic workflows without code duplication.

The project helped me deepen my understanding of:

- LangGraph orchestration
- MCP tool architecture
- AI workflow design
- React + FastAPI full-stack AI integration
- LLM reflection and tool routing patterns
- Fast MCP Stdio Server
- Optimizing the chat flow with a lightweight direct-response layer for simple intents, reducing unnecessary LLM calls for greetings.

## Architecture

```text
React + Vite frontend
        |
        | POST /chat
        v
FastAPI backend
        |
        v
LangGraph orchestration
        |
        | tool calls
        v
FastMCP stdio tool server
        |
        +--> Moon API / moon data layer
        +--> Google Calendar integration
        +--> Notion page + database integration
        +--> Creative affirmation card agent
        +--> Future RAG / memory layer
```

## Features

- Chat-based Moon Agent frontend built with React, Vite, and TypeScript.
- Browser voice input for dictating prompts, with optional read-aloud responses.
- FastAPI backend exposing `/chat`, `/affirmation-card`, and `/health`.
- LangGraph orchestration for model calls, tool routing, and reflection.
- MCP stdio server for tool isolation.
- Creative agent for structured affirmation card generation.
- Moon phase / planetary context through the Moon API.
- Google Calendar event creation.
- Notion page and database entry creation.
- Markdown chat rendering with clickable links.
- Dockerfiles for both backend and frontend containers.
- Local `.env` configuration for secrets and integration IDs.

## Tech Stack

| Layer               | Technologies                                                   |
| ------------------- | -------------------------------------------------------------- |
| Frontend            | React 19, Vite, TypeScript, react-markdown, CSS                |
| Backend API         | Python 3.12, FastAPI, Uvicorn                                  |
| Agent orchestration | LangChain, LangGraph, OpenAI chat model via `langchain-openai` |
| Tool layer          | FastMCP stdio server, MCP tool calls                           |
| Creative layer      | Structured-output creative agent for affirmation cards         |
| Integrations        | Google Calendar API, Notion API, RapidAPI Moon Phase API       |
| Containers          | Backend Dockerfile, frontend Dockerfile, Nginx static serving  |

## Project Structure

```text
Moon_Agent/
  backend/
    app.py               # FastAPI backend
    creative_agent.py    # Structured affirmation card agent
    moon_agent_core.py   # LangGraph agent and MCP client setup
    stdio_server.py      # FastMCP tool server
    run_cli.py           # CLI runner for local testing
    requirements.txt     # Python dependencies
    .env.example         # Backend environment template
    Dockerfile           # Backend container image
    .dockerignore        # Backend Docker build exclusions
  frontend/
    src/App.tsx          # React chat UI
    src/App.css          # Frontend styling
    .env.example         # Frontend environment template
    package.json         # Frontend dependencies/scripts
  docs/
    moon_agent.png       # Demo screenshot
```

## Local Setup

### 1. Backend

Create and activate a Python virtual environment, then install dependencies:

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r backend\requirements.txt
```

Create a backend `.env` from the example:

```powershell
Copy-Item backend\.env.example backend\.env
```

Fill in the required values:

```env
RAPIDAPI_KEY=your_rapidapi_key
NOTION_TOKEN=your_notion_internal_integration_secret
NOTION_PARENT_PAGE_ID=your_shared_notion_parent_page_id
NOTION_DATABASE_ID=your_shared_notion_database_id
NOTION_DATABASE_TITLE_PROPERTY=Name
CALENDAR_TIMEZONE=America/New_York
MOON_LAT=40.73468964462097
MOON_LON=-74.25255582575559
OPENAI_API_KEY=your_openai_api_key
```

For Google Calendar, keep OAuth files local only. By default, the backend looks for these files in `backend/` first and then in the repository root:

```text
moon_agent.json
token.json
```

You can also set explicit paths in `backend\.env`. Relative paths are resolved from the repository root:

```env
GOOGLE_CLIENT_SECRET_FILE=backend/moon_agent.json
GOOGLE_TOKEN_FILE=backend/token.json
```

Start the backend:

```powershell
cd backend
..\venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Check health:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{ "status": "healthy" }
```

Build the backend Docker image from the backend directory:

```powershell
cd backend
docker build -t moon-agent-backend .
```

Run it with the backend environment file:

```powershell
docker run --env-file .env -p 8000:8000 moon-agent-backend
```

OAuth files are excluded from the Docker build context. For Calendar tools in Docker, mount `moon_agent.json` and `token.json` or point `GOOGLE_CLIENT_SECRET_FILE` and `GOOGLE_TOKEN_FILE` at mounted paths.

### 2. Frontend

In a new terminal from the repository root, install frontend dependencies:

```powershell
cd frontend
npm install
```

Create a frontend `.env` from the example:

```powershell
Copy-Item .env.example .env
```

Use this local API URL:

```env
VITE_API_URL=http://localhost:8000
```

Start the frontend:

```powershell
npm.cmd run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

or:

```text
http://localhost:5174
```

Browser voice controls are available in the chat UI:

- Click `Mic` to dictate a prompt into the chat input.
- Review or edit the transcript before sending.
- Click `Audio` to toggle read-aloud responses.

Voice input works best in Chrome or Edge because browser speech-recognition support varies by browser.

Build the frontend Docker image from the frontend directory:

```powershell
cd frontend
docker build -t moon-agent-frontend .
```

If your backend is not available at `http://localhost:8000` from the browser, pass the API URL at build time:

```powershell
docker build --build-arg VITE_API_URL=http://localhost:8000 -t moon-agent-frontend .
```

Run the frontend container:

```powershell
docker run -p 5173:80 moon-agent-frontend
```

## Production Deployment

This repo is prepared for a first portfolio-demo deployment with the backend on Render and the frontend on Vercel.

### Backend on Render

Deploy the backend as a Render Web Service from `backend/`. You can use the included `render.yaml` blueprint or configure the service manually:

- Environment: Docker
- Root directory: `backend`
- Health check path: `/health`
- Docker start command: handled by `backend/Dockerfile`

Set these Render environment variables:

```env
OPENAI_API_KEY=your_openai_api_key
RAPIDAPI_KEY=your_rapidapi_key
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
PRODUCTION_DEMO_MODE=true
CALENDAR_ENABLED=false
NOTION_ENABLED=false
CALENDAR_TIMEZONE=America/New_York
MOON_LAT=40.73468964462097
MOON_LON=-74.25255582575559
CHAT_RATE_LIMIT=5
CHAT_RATE_LIMIT_WINDOW_HOURS=24
MOON_DATA_CACHE_TTL_SECONDS=10800
ENABLE_REFLECTION=false
```

Google Calendar and Notion saves are intentionally disabled for the first production demo. If a user asks to schedule or save something while `PRODUCTION_DEMO_MODE=true`, the backend returns a clear disabled message and still offers copyable guidance. Do not add Google OAuth files or Notion secrets to Render for this demo mode.

### Frontend on Vercel

Deploy the frontend as a Vercel project with:

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

Set this Vercel environment variable after the Render backend URL is live:

```env
VITE_API_URL=https://your-render-service.onrender.com
```

After Vercel deploys, copy the Vercel URL into Render's `ALLOWED_ORIGINS` value and redeploy the backend. Confirm production by opening `https://your-render-service.onrender.com/health` and sending a chat message from the Vercel app without a CORS error.

The public demo limits each visitor IP to `CHAT_RATE_LIMIT` `/chat` requests per `CHAT_RATE_LIMIT_WINDOW_HOURS`. The default is 5 chat requests per 24 hours. The limit is in memory, so it resets when the backend restarts.

Moon API responses are cached in memory for `MOON_DATA_CACHE_TTL_SECONDS` to reduce repeated RapidAPI calls. `ENABLE_REFLECTION=false` skips the extra editor model call in production for faster chat responses.

## API Endpoints

```http
GET /health
```

Returns backend health.

## Current Limitations

- The backend currently uses a single in-memory conversation for local demo use.
- Google OAuth is local-file based and not production-ready.
- The MCP stdio server is launched from the local Python environment.
- No persistent user accounts, auth, or database-backed session memory yet.
- RAG/memory is planned but not implemented yet.

## Roadmap

- Add a RAG layer for saved reflections, goals, and previous plans.
- Add production-ready auth and Google OAuth handling.
- Deploy React frontend to Vercel or Netlify.
- Deploy FastAPI backend to Railway, Render, Fly.io, AWS, or a VPS.
- Add a richer dashboard for moon phase, tasks, calendar blocks, and Notion saves.

## Interview Demo Flow

1.  Ask Moon Agent for today's moon guidance.
2.  Ask the Moon Agent when is the next New or Full Moon.
3.  Ask the Moon Agent what the current astrological house and sign the Moon is in.
4.  Ask it to turn the guidance into a practical plan.

## Status

This is a local-first full-stack agent prototype intended for learning, portfolio demonstration, and interview discussion.
