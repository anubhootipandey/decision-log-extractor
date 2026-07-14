# Decision Log Extractor

Turn messy meeting transcripts into a structured, searchable log of what was actually decided — automatically, using AI.

## The Problem

Teams make dozens of decisions in meetings every week, but those decisions live only in people's memory or buried inside a wall of transcript text nobody rereads. A few weeks later, the same debate gets re-litigated, or a new hire has no record of *why* a choice was made. Existing meeting-notes tools (Otter, Fireflies, etc.) transcribe everything but don't extract what actually matters — the decisions themselves.

## What This Does

Paste in a raw meeting transcript, and the app:
- Extracts every concrete decision made (not general discussion, not open questions)
- Identifies the owner responsible for each decision
- Captures the rationale behind it, if stated
- Grounds every extraction in an exact quote from the source transcript, so nothing is invented
- Stores it in a searchable decision log you can query later

## Live Demo

- **Frontend:** [add your Vercel link here]
- **API docs:** [add your Render `/docs` link here]

## Tech Stack

| Layer | Tech |
|---|---|
| AI extraction | Groq API (Llama 3.3 70B) |
| Backend | FastAPI (Python) |
| Database | SQLite |
| Frontend | Vanilla HTML/CSS/JS |
| Backend hosting | Render |
| Frontend hosting | Vercel |

## How It Works

1. User pastes a transcript into the frontend
2. Frontend sends it to a FastAPI `/extract` endpoint
3. Backend calls Groq's LLM with a structured prompt requiring a JSON response, including a mandatory `source_quote` field per decision — this forces the model to ground each extraction in real text rather than inventing plausible-sounding decisions
4. Extracted decisions are validated, stored in SQLite, and returned to the frontend
5. Past decisions are searchable via a `/decisions?search=` endpoint

## Project Structure

```
decision-log-extractor/
  backend/
    step1_extract.py     # standalone script to test extraction logic in isolation
    main.py               # FastAPI app: /extract and /decisions endpoints
    requirements.txt
    runtime.txt
    sample_transcript.txt
    .env.example
  frontend/
    index.html            # single-file UI, no build step
  README.md
  DOCUMENTATION.md
```

## Running Locally

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/` (see `.env.example`):
```
GROQ_API_KEY=your-groq-api-key
```

Start the backend:
```bash
uvicorn main:app --reload
```

Open `frontend/index.html` in a browser. Make sure `API_URL` inside it points to `http://127.0.0.1:8000` for local use.

## Known Limitations

- SQLite storage resets on Render's free tier when the service restarts — fine for a demo, not for production use
- Extraction quality depends on transcript clarity; very informal or overlapping speech reduces accuracy
- Single-user, no authentication — this is an MVP, not a multi-tenant product

## Roadmap

- Persistent database (Supabase/Postgres)
- Semantic search over past decisions using embeddings
- Auto-flag when a new decision contradicts a past one
- Direct integration with meeting platforms (Zoom/Google Meet transcripts)
- Slack digest of decisions made each week

## Why I Built This

I wanted a project that reflected a real, recurring workflow problem rather than another to-do list or CRM clone. This one specifically demonstrates structured LLM output extraction, prompt design for factual grounding (not hallucination), and a full deployable stack — end to end, for free.
