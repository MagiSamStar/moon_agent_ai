# Moon Agent

Moon Agent is a full-stack AI planning assistant that transforms live moon context into grounded daily guidance, practical action plans, and optional saves to Notion or Google Calendar.

The Moon Agent follows a ReAct-style pattern: the model reasons about the request, chooses tools when needed, observes tool outputs, and then produces a grounded response. A final reflection node edits the response for clarity, tone, and readability before it is returned to the
frontend.

This project is built as a local-first agent demo: a React chat UI talks to a FastAPI backend, the backend runs a LangGraph agent, and the agent calls MCP tools for external integrations.
![Moon Agent frontend demo](/docs/moon_agent.png)

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
        +--> Future RAG / memory layer
```

## Features

- Chat-based Moon Agent frontend built with React, Vite, and TypeScript.
- FastAPI backend exposing `/chat` and `/health`.
- LangGraph orchestration for model calls, tool routing, and reflection.
- MCP stdio server for tool isolation.
- Moon phase / planetary context through the Moon API.
- Google Calendar event creation.
- Notion page and database entry creation.
- Markdown chat rendering with clickable links.
- Local `.env` configuration for secrets and integration IDs.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, react-markdown, CSS |
| Backend API | Python 3.12, FastAPI, Uvicorn |
| Agent orchestration | LangChain, LangGraph, OpenAI chat model via `langchain-openai` |
| Tool layer | FastMCP stdio server, MCP tool calls |
| Integrations | Google Calendar API, Notion API, RapidAPI Moon Phase API |

## Project Structure

```text
Moon_Agent/
  app.py                 # FastAPI backend
  moon_agent_core.py     # LangGraph agent and MCP client setup
  stdio_server.py        # FastMCP tool server
  run_cli.py             # CLI runner for local testing
  requirements.txt       # Python dependencies
  .env.example           # Backend environment template
  my-app/
    src/App.tsx          # React chat UI
    src/App.css          # Frontend styling
    .env.example         # Frontend environment template
    package.json         # Frontend dependencies/scripts
```

## Local Setup

### 1. Backend

Create and activate a Python virtual environment, then install dependencies:

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create a backend `.env` from the example:

```powershell
Copy-Item .env.example .env
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
```

For Google Calendar, keep OAuth files local only:

```text
moon_agent.json
token.json
```

Start the backend:

```powershell
venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Check health:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{ "status": "healthy" }
```

### 2. Frontend

Install frontend dependencies:

```powershell
cd my-app
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

## API Endpoints

```http
GET /health
```

Returns backend health.

```http
POST /chat
Content-Type: application/json

{
  "message": "What should I focus on today based on the moon?"
}
```

Returns:

```json
{
  "response": "Moon Agent response..."
}
```

## Environment And Security Notes

Do not commit real secrets or OAuth tokens.

Keep these local:

```text
.env
my-app/.env
moon_agent.json
token.json
venv/
my-app/node_modules/
```

Commit only example files:

```text
.env.example
my-app/.env.example
```

If a key was committed or shared accidentally, rotate it before making the repository public.

## Current Limitations

- The backend currently uses a single in-memory conversation for local demo use.
- Google OAuth is local-file based and not production-ready.
- The MCP stdio server is launched from the local Python environment.
- No persistent user accounts, auth, or database-backed session memory yet.
- RAG/memory is planned but not implemented yet.

## Roadmap

- Add per-session chat state with `session_id`.
- Add persistent memory using SQLite, Postgres, or Redis.
- Add a RAG layer for saved reflections, goals, and previous plans.
- Add production-ready auth and Google OAuth handling.
- Deploy React frontend to Vercel or Netlify.
- Deploy FastAPI backend to Railway, Render, Fly.io, AWS, or a VPS.
- Add tests for API routes, agent graph behavior, and MCP tools.
- Add a richer dashboard for moon phase, tasks, calendar blocks, and Notion saves.

## Interview Demo Flow

1.  Ask Moon Agent for today’s moon guidance.
2.  Ask the Moon Agent when is the next New or Full Moon.
3.  Ask the Moon agent what the current Astrological House and Sign the Moon is in.
4.  Ask it to turn the guidance into a practical plan.
5.  Ask it to save the plan to Notion.
6.  Ask it to schedule a calendar block.

## Status

This is a local-first full-stack agent prototype intended for learning, portfolio demonstration, and interview discussion.
