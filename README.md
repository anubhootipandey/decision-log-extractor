# 🧾 Ledger — Decision Log Extractor

Turn messy meeting transcripts into a private, structured, searchable log of what was actually decided — automatically, using AI.

## The Problem

Teams make dozens of decisions in meetings every week, but those decisions live only in people's memory or buried inside a wall of transcript text nobody rereads. A few weeks later, the same debate gets re-litigated, or a new hire has no record of *why* a choice was made. Existing meeting-notes tools (Otter, Fireflies, etc.) transcribe everything but don't extract what actually matters — the decisions themselves.

## What This Does

Paste in a raw meeting transcript, and the app:
- Extracts every concrete decision made (not general discussion, not open questions)
- Identifies the owner responsible for each decision
- Captures the rationale behind it, if stated
- Grounds every extraction in an exact quote from the source transcript, so nothing is invented
- Stores it in a private, searchable decision log — scoped to your account, enforced at the database level

## Live Demo

- **App:** [https://decision-log-extractor.vercel.app/]
- **API docs:** [https://decision-log-extractor.onrender.com/docs]

## Tech Stack

| Layer | Tech |
|---|---|
| AI extraction | Groq API (Llama 3.3 70B) |
| Backend | FastAPI (Python) |
| Auth | Supabase Auth (email/password, JWT sessions) |
| Database | Supabase Postgres, with Row Level Security |
| Frontend | Vanilla HTML/CSS/JS, Supabase JS client |
| Backend hosting | Render |
| Frontend hosting | Vercel |

## How It Works

1. User signs up / logs in via Supabase Auth; the frontend holds a short-lived JWT session
2. User pastes a transcript into the app
3. Frontend sends the transcript and the user's access token to a FastAPI `/extract` endpoint
4. Backend verifies the token against Supabase, then calls Groq's LLM with a structured prompt requiring a JSON response, including a mandatory `source_quote` field per decision — this forces the model to ground each extraction in real text rather than inventing plausible-sounding decisions
5. Extracted decisions are inserted into Postgres, tagged with the user's id
6. Row Level Security policies in Postgres ensure a user can only ever read or modify their own rows — enforced by the database itself, not just application code
7. Past decisions are searchable per-user via a `/decisions?search=` endpoint

## Project Structure

```
decision-log-extractor/
  backend/
    step1_extract.py     # standalone script to test extraction logic in isolation
    main.py               # FastAPI app: auth-protected /extract and /decisions endpoints
    schema.sql             # Postgres schema + Row Level Security policies
    requirements.txt
    runtime.txt
    sample_transcript.txt
    .env.example
  frontend/
    index.html            # structure + auth gate
    style.css
    script.js              # Supabase auth + API calls
  README.md
  DOCUMENTATION.md
```

## Running Locally

**1. Set up Supabase** (free tier): create a project at supabase.com, run `backend/schema.sql` in the SQL Editor, and grab your Project URL + anon key from Project Settings → API.

**2. Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```
Create `.env` in `backend/` (see `.env.example`):
```
GROQ_API_KEY=your-groq-api-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-public-key
```
```bash
uvicorn main:app --reload
```

**3. Frontend**
In `frontend/script.js`, set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `API_URL`. Then open `frontend/index.html` (or serve it: `python -m http.server 5500`).

## Security Notes

- The Supabase `anon` key and project URL are safe to expose client-side by design — they grant no access on their own. Every request is filtered by Row Level Security policies enforced inside Postgres (`auth.uid() = user_id`), not by application-level checks.
- The `service_role` key (which bypasses RLS) and the Groq API key are never exposed to the frontend — both live only in the backend's environment variables.
- Verified data isolation manually by creating two test accounts and confirming neither could see the other's decisions.

## Known Limitations

- No password reset flow yet (Supabase supports it; not wired into the UI)
- Single free-tier Groq model; no fallback if the API is rate-limited or down
- No automated test suite yet — verification has been manual (see Documentation)

## Roadmap

- Edit/delete a decision after extraction
- Export to CSV/Markdown
- Semantic search over past decisions using embeddings
- Auto-flag when a new decision contradicts a past one
- Slack digest of decisions made each week

## Why I Built This

I wanted a project that reflected a real, recurring workflow problem rather than another to-do list or CRM clone, and one that went past "AI wrapper" territory into an actual product: authenticated users, a real database with enforced access control, and a deployed, working full stack — end to end, for free.
