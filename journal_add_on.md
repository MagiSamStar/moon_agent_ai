You are helping me add a Journal RAG feature to my Moon Agent app.

Current stack:

- React/Vite frontend
- FastAPI backend
- ChromaDB
- OpenAI embeddings
- Existing Moon Agent chat endpoint
- Existing lunar/moon context logic

Goal:
Create a simple V1 journal memory system where users can write journal entries, save them to ChromaDB with embeddings, and retrieve relevant past entries during chat.

Requirements:

1. Backend: Journal Entry API
   Create FastAPI routes:

- POST /journal
  - accepts: text, mood optional, tags optional
  - adds metadata: created_at, moon_phase if available, mood, tags, entry_type="journal"
  - creates embedding
  - stores entry in ChromaDB
  - returns saved entry id and metadata

- GET /journal
  - returns recent journal entries, newest first
  - optional limit parameter

- POST /journal/search
  - accepts query and optional filters
  - embeds query
  - searches ChromaDB
  - returns top 3–5 relevant journal entries with metadata

2. ChromaDB Setup
   Create or reuse a Chroma collection named:
   moon_journal_memory

Store:

- document text
- metadata
- unique id

Use OpenAI embeddings if the project already has OpenAI configured.

3. Chat Integration
   Update the existing chat flow so that before generating a Moon Agent response:

- take the user message
- search journal memory with vector similarity
- retrieve top 3 relevant journal entries
- inject them into the prompt as “Relevant journal memories”
- do not dump all memories
- if no relevant memories are found, continue normally

The assistant should use journal memories gently and naturally, not expose raw metadata unless useful.

4. Frontend
   Add a simple Journal page or component:

- textarea for journal entry
- optional mood input
- optional tags input
- save button
- success/error state
- recent entries list
- optional “search memories” input for testing retrieval

Keep the UI consistent with the existing Moon Agent aesthetic.

5. Code Quality

- Keep the implementation simple and V1-friendly
- Add clear comments
- Avoid over-engineering
- Do not add authentication yet unless the project already has it
- Use environment variables already present for OpenAI keys
- Make sure errors are handled gracefully
- Do not break the existing chat endpoint

6. Deliverables
   Please modify the necessary backend and frontend files.
   Also add a short README section explaining:

- how journal memory works
- how ChromaDB stores entries
- how chat uses retrieved journal memories
- what environment variables are required

Important:
This is personal memory RAG, not document Q&A. Prioritize semantic similarity, mood/context metadata, and simple retrieval.
