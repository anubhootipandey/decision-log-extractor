"""
STEP 1: Standalone extraction script.
Goal: prove that "transcript text -> structured decisions JSON" works,
before we touch any backend or frontend code.

Run this file directly:  python step1_extract.py
"""

import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------
# 1. Set your API key as an environment variable (never hardcode it).
#    In your terminal, before running this script:
#      export GROQ_API_KEY="your-key-here"      (Mac/Linux)
#      setx GROQ_API_KEY "your-key-here"         (Windows, then reopen terminal)
# ---------------------------------------------------------

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are a meeting-notes analyst. You will be given a raw meeting
transcript. Extract every DECISION that was made during the meeting.

A "decision" is something the team explicitly agreed to do, choose, or stop doing.
Do NOT include open questions, undecided debates, or general discussion.

For every decision, capture:
- "decision": a short, clear statement of what was decided
- "owner": the person who made or is responsible for the decision (if mentioned, else "unknown")
- "rationale": why this decision was made, in a few words (if mentioned, else "not stated")
- "source_quote": the exact sentence(s) from the transcript that this decision is based on
  (this is critical — it lets us verify the extraction wasn't invented)

Respond with ONLY a JSON array. No markdown, no explanation, no code fences.
Example format:
[
  {
    "decision": "Use PostgreSQL instead of MongoDB for the main database",
    "owner": "Priya",
    "rationale": "team already has Postgres experience, need relational data",
    "source_quote": "Priya: Let's just go with Postgres, we all know it and the data is relational anyway."
  }
]

If there are no clear decisions in the transcript, respond with an empty array: []
"""


def extract_decisions(transcript: str) -> list:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",  # free tier model on Groq
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
        ],
        temperature=0.1,  # low temperature = more consistent, less "creative" JSON
    )

    raw_text = response.choices[0].message.content.strip()

    # Defensive parsing: sometimes models wrap JSON in ```json fences anyway
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        raw_text = raw_text.replace("json", "", 1).strip()

    try:
        decisions = json.loads(raw_text)
    except json.JSONDecodeError:
        print("⚠️  Model did not return valid JSON. Raw output was:")
        print(raw_text)
        return []

    return decisions


if __name__ == "__main__":
    # Read the sample transcript from a text file sitting next to this script
    sample_path = os.path.join(os.path.dirname(__file__), "sample_transcript.txt")
    with open(sample_path, "r") as f:
        transcript_text = f.read()

    print("Extracting decisions from sample transcript...\n")
    results = extract_decisions(transcript_text)

    print(json.dumps(results, indent=2))
    print(f"\n✅ Found {len(results)} decision(s).")
