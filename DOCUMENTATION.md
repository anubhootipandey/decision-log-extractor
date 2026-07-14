# Project Documentation — Decision Log Extractor

This document covers the technical decisions, architecture, and challenges behind this project in more depth than the README. Useful for interview prep and as a record of the actual build process.

---

## 1. Problem Definition

**Who has this problem:** Startup teams, product teams, and eng teams who run frequent meetings (standups, planning, syncs) where decisions are made verbally and never formally recorded anywhere queryable.

**Why existing tools don't solve it:** Transcription tools (Otter, Fireflies) produce a full text dump of the meeting. That solves "what was said" but not "what was decided" — nobody rereads a 40-minute transcript to find the 2-3 decisions buried inside it. There's a gap between raw transcription and structured institutional knowledge.

**The specific gap this project targets:** Automatically converting unstructured conversation into structured, attributable, searchable decision records — with the source text preserved for verification.

---

## 2. Architecture Overview

```
User (browser)
    │
    │  paste transcript
    ▼
frontend/index.html  ──POST /extract──▶  FastAPI backend (main.py)
                                              │
                                              │  system prompt + transcript
                                              ▼
                                          Groq API (Llama 3.3 70B)
                                              │
                                              │  JSON array of decisions
                                              ▼
                                          Parse + validate
                                              │
                                              ▼
                                          SQLite (decisions.db)
                                              │
                                              ▼
frontend  ◀──GET /decisions?search=──── FastAPI backend
```

Three layers, deliberately kept separate during development:
1. **Extraction logic** (`step1_extract.py`) — tested in isolation before any web layer existed
2. **API layer** (`main.py`) — wraps extraction in HTTP endpoints + persistence
3. **Presentation layer** (`index.html`) — no framework, direct fetch calls, kept dependency-free

---

## 3. Key Design Decisions

### 3.1 Why a mandatory `source_quote` field
The single biggest risk with LLM extraction tasks is hallucination — the model inventing a plausible-sounding decision that was never actually made. Requiring the model to output the exact source sentence(s) alongside every decision does two things:
- Makes hallucination visible (if the quote doesn't exist in the original transcript, the extraction is untrustworthy)
- Gives the end user a way to verify any decision without rereading the whole transcript

### 3.2 Why low temperature (0.1)
Structured extraction tasks benefit from low creativity — the goal is consistent, literal extraction, not creative rephrasing. A high temperature increased variance in JSON formatting and occasionally caused malformed output during testing.

### 3.3 Why SQLite instead of a hosted database for the MVP
The goal of the MVP was to validate the extraction pipeline and UX with zero infrastructure cost or setup friction. SQLite requires no server, no account, and no config — it ships as a single file. This was a deliberate scope decision: prove the core value first, add production-grade persistence (Postgres/Supabase) once the extraction quality was validated.

### 3.4 Why no frontend framework
The frontend's only job is: submit text, display structured results, run a search query. This doesn't need React's state management overhead. Keeping it as a single HTML file with vanilla JS removed build tooling entirely, which mattered for shipping speed on a solo, free-tier project.

### 3.5 Defensive JSON parsing
LLMs occasionally wrap JSON output in markdown code fences (```json ... ```) even when explicitly told not to. The extraction function strips these defensively before parsing, and falls back to an empty list (rather than crashing) if the output still isn't valid JSON. This was discovered during manual testing, not anticipated upfront — an example of designing for real model behavior rather than assumed behavior.

---

## 4. Challenges Encountered During Build

### 4.1 `groq` / `httpx` version conflict
**Symptom:** `TypeError: Client.__init__() got an unexpected keyword argument 'proxies'`
**Cause:** A newer `httpx` version (installed as a transitive dependency) removed a parameter the pinned `groq` SDK version still relied on internally.
**Fix:** Pinned `httpx==0.27.2` explicitly alongside the `groq` package.
**Lesson:** Pinning your direct dependencies isn't enough — transitive dependency versions can silently break compatibility. Worth checking `pip show <package>` when errors reference internals you didn't write.

### 4.2 Secrets management
**Approach:** `.env` file for real secrets (gitignored), `.env.example` committed as a template, `python-dotenv` to load values at runtime via `load_dotenv()`.
**Verification step added:** Always run `git status` before `git commit` when secrets are involved, to catch accidental staging before it becomes a push.

### 4.3 Render deployment — Python version mismatch
**Symptom:** Build failed on `pydantic-core` with a Rust/maturin compilation error on a read-only filesystem.
**Cause:** Render defaulted to a newer Python version (3.14) than what the pinned dependency versions had pre-built wheels for, forcing pip to attempt a from-source build, which requires a Rust toolchain unavailable in Render's build sandbox.
**Fix:** Pinned the Python version explicitly via the `PYTHON_VERSION` environment variable in Render's dashboard (more reliable than `runtime.txt`, which wasn't being consistently picked up).
**Lesson:** Free-tier PaaS platforms change default runtime versions over time; pinning language/runtime versions explicitly is necessary for reproducible deploys, not just pinning package versions.

---

## 5. What I'd Do Differently With More Time

- Add automated tests around the JSON parsing/validation logic (currently manually verified)
- Add a confidence score per extracted decision, using a second LLM pass to self-critique extractions
- Move from SQLite to Postgres to survive Render's free-tier disk resets
- Add retry logic with exponential backoff for transient Groq API failures
- Add basic auth so the tool isn't fully public once deployed

---

## 6. Skills Demonstrated

- Prompt engineering for structured, grounded output (not just "chat with an LLM")
- REST API design (FastAPI, request/response models via Pydantic)
- Dependency management and debugging real-world version conflicts
- Secrets management and git hygiene
- Full deployment pipeline (GitHub → Render → Vercel) on entirely free infrastructure
- Debugging platform-specific deployment failures (Python runtime pinning)
