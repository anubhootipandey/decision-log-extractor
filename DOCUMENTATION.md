# Project Documentation — Ledger (Decision Log Extractor)

This document covers the technical decisions, architecture, and challenges behind this project in more depth than the README. Useful for interview prep and as a record of the actual build process.

---

## 1. Problem Definition

**Who has this problem:** Startup teams, product teams, and eng teams who run frequent meetings (standups, planning, syncs) where decisions are made verbally and never formally recorded anywhere queryable.

**Why existing tools don't solve it:** Transcription tools (Otter, Fireflies) produce a full text dump of the meeting. That solves "what was said" but not "what was decided" — nobody rereads a 40-minute transcript to find the 2-3 decisions buried inside it. There's a gap between raw transcription and structured, private institutional knowledge.

**The specific gap this project targets:** Automatically converting unstructured conversation into structured, attributable, searchable decision records — private per user, with the source text preserved for verification.

---

## 2. Architecture Overview

```
User (browser)
    │
    │  sign up / log in (Supabase Auth)
    ▼
frontend  ──POST /extract, Bearer <JWT>──▶  FastAPI backend (main.py)
                                                  │
                                                  │  verify JWT against Supabase
                                                  │  system prompt + transcript
                                                  ▼
                                              Groq API (Llama 3.3 70B)
                                                  │
                                                  │  JSON array of decisions
                                                  ▼
                                              Parse + validate
                                                  │
                                                  ▼
                                    Supabase Postgres — insert as user
                                    (Row Level Security enforces user_id match)
                                                  │
                                                  ▼
frontend  ◀──GET /decisions?search=, Bearer <JWT>──── FastAPI backend
```

Three layers, developed and validated in stages:
1. **Extraction logic** (`step1_extract.py`) — tested in isolation before any web layer existed
2. **API + auth layer** (`main.py`) — wraps extraction in HTTP endpoints, verifies identity, enforces per-user data access
3. **Presentation layer** (`index.html` / `style.css` / `script.js`) — no framework, direct Supabase JS + fetch calls

---

## 3. Key Design Decisions

### 3.1 Why a mandatory `source_quote` field
The single biggest risk with LLM extraction tasks is hallucination — the model inventing a plausible-sounding decision that was never actually made. Requiring the model to output the exact source sentence(s) alongside every decision does two things: makes hallucination visible (if the quote doesn't exist in the original transcript, the extraction is untrustworthy), and gives the end user a way to verify any decision without rereading the whole transcript.

### 3.2 Why Supabase for auth + database (not a custom auth system)
Building password hashing, session/JWT issuance, and token refresh logic by hand is a well-known source of security bugs for a solo project. Supabase provides production-grade auth (JWT sessions, secure password storage) and a real Postgres database in one free-tier service, letting the project's own code focus on the actual product logic — extraction and data modeling — rather than reimplementing authentication primitives.

### 3.3 Why Row Level Security instead of filtering in application code
The backend *could* filter `WHERE user_id = current_user` in every query manually. Instead, RLS policies enforce that constraint inside Postgres itself, at the database layer. This means a bug in the FastAPI code (a forgotten filter, a copy-paste error) cannot leak another user's data — the database refuses the query regardless of what the application asks for. This is a defense-in-depth pattern: the access rule exists in exactly one place, and it's the hardest layer to accidentally bypass.

### 3.4 Why the Supabase `anon` key is safe to commit to the frontend
The `anon` key is a public identifier, not a secret — it grants no access by itself. Every request made with it is still subject to RLS policies. This is Supabase's intended usage pattern for client-side apps. The `service_role` key (which bypasses RLS) and the Groq API key are the two values that must never reach the frontend, and both are kept exclusively in backend environment variables.

### 3.5 Why low temperature (0.1) for extraction
Structured extraction tasks benefit from low creativity — the goal is consistent, literal extraction, not creative rephrasing. A high temperature increased variance in JSON formatting and occasionally caused malformed output during testing.

### 3.6 Defensive JSON parsing
LLMs occasionally wrap JSON output in markdown code fences (```json ... ```) even when explicitly told not to. The extraction function strips these defensively before parsing, and falls back to an empty list (rather than crashing) if the output still isn't valid JSON.

---

## 4. Challenges Encountered During Build

### 4.1 `groq` / `httpx` version conflict (local and again on Render)
**Symptom:** `TypeError: Client.__init__() got an unexpected keyword argument 'proxies'`
**Cause:** A newer `httpx` version (installed as a transitive dependency) removed a parameter the pinned `groq` SDK version still relied on internally.
**Fix:** Pinned `httpx==0.27.2` explicitly in `requirements.txt`, both locally and in the deployed environment.
**Lesson:** Pinning direct dependencies isn't enough — transitive dependency versions can silently break compatibility, and the same conflict can resurface on a different platform with a different default resolution order.

### 4.2 Render deployment — Python version mismatch
**Symptom:** Build failed compiling `pydantic-core` from source, due to a read-only filesystem blocking the Rust toolchain it needed.
**Cause:** Render defaulted to a newer Python version (3.14) than what the pinned dependency versions had pre-built wheels for.
**Fix:** Pinned the Python version explicitly via the `PYTHON_VERSION` environment variable in Render's dashboard.
**Lesson:** Free-tier PaaS platforms change default runtime versions over time; pinning language/runtime versions explicitly is necessary for reproducible deploys, not just pinning package versions.

### 4.3 Migrating from SQLite to a multi-user, access-controlled database
**Challenge:** The original MVP used a single shared SQLite file with no concept of ownership — every visitor saw the same data. Adding real users meant redesigning the data model (adding `user_id` to every row) and the access pattern (every query now needs to run in the context of an authenticated identity).
**Approach:** Rather than manually checking `user_id` in every backend function, moved that responsibility into Postgres via Row Level Security policies, and had the backend authenticate as the calling user for each request (using their JWT) rather than as a privileged service account.
**Verification:** Manually tested with two separate accounts to confirm cross-account data isolation, rather than assuming the policy SQL was correct.

### 4.4 Secrets management across two categories
**Approach:** Distinguished between values safe to expose client-side (Supabase URL, anon key — protected by RLS) and values that must stay server-only (Groq API key, Supabase service role key — never used in this project, but deliberately avoided). `.env` for real secrets (gitignored), `.env.example` committed as a template.

---

## 5. What I'd Do Differently With More Time

- Add automated tests for JSON parsing/validation and for RLS policy behavior (currently manually verified)
- Add a confidence score per extracted decision, using a second LLM pass to self-critique extractions
- Add password reset and email verification flows to the UI
- Add retry logic with exponential backoff for transient Groq API failures
- Restrict CORS to the actual frontend domain instead of `*`, now that there's a real deployed frontend

---

## 6. Skills Demonstrated

- Prompt engineering for structured, grounded output (not just "chat with an LLM")
- REST API design with authentication (FastAPI, JWT verification, Pydantic models)
- Database design with enforced multi-tenant access control (Postgres Row Level Security)
- Distinguishing public-safe vs. secret credentials in a real auth architecture
- Dependency management and debugging real-world version conflicts across environments
- Full deployment pipeline (GitHub → Render → Vercel) on entirely free infrastructure, migrated mid-project from a single-file database to a managed, access-controlled one
- Debugging platform-specific deployment failures (Python runtime pinning)