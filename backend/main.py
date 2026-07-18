import os
import json
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Decision Log Extractor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for a real product, restrict this to your actual frontend domain
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

groq_client = Groq(api_key=GROQ_API_KEY)

MAX_TRANSCRIPT_CHARS = 20000  # safety cap so one request can't drain your Groq quota


def get_user_client(access_token: str) -> Client:
    """Creates a Supabase client authenticated AS the calling user.
    Every query made with this client is automatically filtered by
    Row Level Security policies to that user's own rows — the backend
    doesn't need to manually filter by user_id, Postgres does it."""
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(access_token)
    return client


def get_current_user(authorization: Optional[str] = Header(None)):
    """FastAPI dependency: verifies the Authorization header against
    Supabase and returns the authenticated user's id, email, and token.
    Raises 401 if the header is missing or the session is invalid/expired."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    token = authorization.split(" ", 1)[1]
    auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    try:
        user_response = auth_client.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    return {"id": user.id, "email": user.email, "token": token}


SYSTEM_PROMPT = """You are a meeting-notes analyst. You will be given a raw meeting
transcript. Extract every DECISION that was made during the meeting.

A "decision" is something the team explicitly agreed to do, choose, or stop doing.
Do NOT include open questions, undecided debates, or general discussion.

For every decision, capture:
- "decision": a short, clear statement of what was decided
- "owner": the person responsible (if mentioned, else "unknown")
- "rationale": why this decision was made, briefly (if mentioned, else "not stated")
- "source_quote": the exact sentence(s) from the transcript that support this decision

Respond with ONLY a JSON array. No markdown, no explanation, no code fences.
If there are no clear decisions, respond with an empty array: []
"""


class ExtractRequest(BaseModel):
    transcript: str
    meeting_title: Optional[str] = "Untitled meeting"


class Decision(BaseModel):
    id: str
    decision: str
    owner: Optional[str] = None
    rationale: Optional[str] = None
    source_quote: Optional[str] = None
    meeting_title: Optional[str] = None
    created_at: str


def extract_decisions(transcript: str) -> list:
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
        ],
        temperature=0.1,
    )

    raw_text = response.choices[0].message.content.strip()

    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        raw_text = raw_text.replace("json", "", 1).strip()

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        return []


@app.post("/extract")
def extract(req: ExtractRequest, user=Depends(get_current_user)):
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty.")

    if len(req.transcript) > MAX_TRANSCRIPT_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Transcript too long (max {MAX_TRANSCRIPT_CHARS} characters).",
        )

    decisions = extract_decisions(req.transcript)

    if decisions:
        supabase = get_user_client(user["token"])
        rows_to_insert = [
            {
                "user_id": user["id"],
                "decision": d.get("decision", ""),
                "owner": d.get("owner", "unknown"),
                "rationale": d.get("rationale", "not stated"),
                "source_quote": d.get("source_quote", ""),
                "meeting_title": req.meeting_title,
            }
            for d in decisions
        ]
        supabase.table("decisions").insert(rows_to_insert).execute()

    return {"count": len(decisions), "decisions": decisions}


@app.get("/decisions", response_model=List[Decision])
def get_decisions(search: Optional[str] = None, user=Depends(get_current_user)):
    supabase = get_user_client(user["token"])

    query = supabase.table("decisions").select("*").order("created_at", desc=True)

    if search:
        # Row Level Security still applies here — this only ever searches
        # within rows owned by the authenticated user.
        safe_search = search.replace(",", " ").replace("%", " ")
        query = query.or_(
            f"decision.ilike.%{safe_search}%,owner.ilike.%{safe_search}%,rationale.ilike.%{safe_search}%"
        )

    result = query.execute()
    return result.data


@app.delete("/decisions/{decision_id}")
def delete_decision(decision_id: str, user=Depends(get_current_user)):
    supabase = get_user_client(user["token"])
    supabase.table("decisions").delete().eq("id", decision_id).execute()
    return {"status": "deleted"}


@app.get("/")
def root():
    return {"status": "Decision Log Extractor API is running (Supabase-backed)"}