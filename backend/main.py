"""
STEP 2: FastAPI backend.
Wraps the extraction logic in an API, and stores results in a local SQLite
database (no external database needed to get started — free and zero setup).

Run with:  uvicorn main:app --reload
Then open: http://127.0.0.1:8000/docs   <- auto-generated API testing page
"""

import os
import json
import sqlite3
from dotenv import load_dotenv
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

load_dotenv()

# ---------------------------------------------------------
# Setup
# ---------------------------------------------------------

app = FastAPI(title="Decision Log Extractor")

# Allow the frontend (running on a different port) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for local dev only; restrict this in real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

DB_PATH = os.path.join(os.path.dirname(__file__), "decisions.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            decision TEXT NOT NULL,
            owner TEXT,
            rationale TEXT,
            source_quote TEXT,
            meeting_title TEXT,
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()


init_db()

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


# ---------------------------------------------------------
# Request / response models
# ---------------------------------------------------------

class ExtractRequest(BaseModel):
    transcript: str
    meeting_title: Optional[str] = "Untitled meeting"


class Decision(BaseModel):
    id: int
    decision: str
    owner: Optional[str]
    rationale: Optional[str]
    source_quote: Optional[str]
    meeting_title: Optional[str]
    created_at: str


# ---------------------------------------------------------
# Core extraction function (same logic as step1_extract.py)
# ---------------------------------------------------------

def extract_decisions(transcript: str) -> list:
    response = client.chat.completions.create(
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


# ---------------------------------------------------------
# Endpoints
# ---------------------------------------------------------

@app.post("/extract")
def extract(req: ExtractRequest):
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty.")

    decisions = extract_decisions(req.transcript)

    conn = sqlite3.connect(DB_PATH)
    now = datetime.utcnow().isoformat()

    for d in decisions:
        conn.execute(
            """INSERT INTO decisions (decision, owner, rationale, source_quote, meeting_title, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                d.get("decision", ""),
                d.get("owner", "unknown"),
                d.get("rationale", "not stated"),
                d.get("source_quote", ""),
                req.meeting_title,
                now,
            ),
        )
    conn.commit()
    conn.close()

    return {"count": len(decisions), "decisions": decisions}


@app.get("/decisions", response_model=List[Decision])
def get_decisions(search: Optional[str] = None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    if search:
        rows = conn.execute(
            """SELECT * FROM decisions
               WHERE decision LIKE ? OR owner LIKE ? OR rationale LIKE ?
               ORDER BY id DESC""",
            (f"%{search}%", f"%{search}%", f"%{search}%"),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM decisions ORDER BY id DESC").fetchall()

    conn.close()
    return [dict(row) for row in rows]


@app.get("/")
def root():
    return {"status": "Decision Log Extractor API is running"}
