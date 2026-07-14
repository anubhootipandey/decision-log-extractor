# Decision Log Extractor — Beginner Build Guide

This is a full step-by-step guide. Follow it in order — don't skip steps.
Total cost: $0.

---

## PART 0: What you're building (read this first)

Three pieces:
1. **`step1_extract.py`** — a tiny script that proves "transcript in → decisions out" works. You run this in your terminal, nothing fancy.
2. **`main.py`** — wraps that same logic in a web API (FastAPI) with a database, so a website can talk to it.
3. **`index.html`** — a simple webpage where you paste a transcript and see results.

You build and test them in that exact order. Do not jump to the frontend first.

---

## PART 1: Install the tools you need (one-time setup)

### 1. Install Python
- Go to https://www.python.org/downloads/ and install Python 3.11 or newer.
- On Windows: during install, **check the box "Add Python to PATH"**.
- Verify it worked: open a terminal (Command Prompt / Terminal app) and type:
  ```
  python --version
  ```
  You should see something like `Python 3.11.x`. If you get an error, restart your terminal.

### 2. Install a code editor
- Download **VS Code**: https://code.visualstudio.com/ (free)

### 3. Create a free Groq account (this gives you the free AI API)
- Go to https://console.groq.com
- Sign up (free, no credit card required)
- Go to **API Keys** in the left sidebar → **Create API Key**
- Copy the key somewhere safe — you'll need it in Part 3. You won't be able to see it again after closing the popup.

> Why Groq and not OpenAI? Groq's free tier is generous and doesn't require a credit card. If you'd rather use Google Gemini instead, the free tier works too — just say so and I'll adjust the code.

---

## PART 2: Get the project files onto your computer

1. Create a folder on your computer called `decision-log-extractor`
2. Inside it, create two subfolders: `backend` and `frontend`
3. Copy the files I generated into the matching folders:
   - `backend/step1_extract.py`
   - `backend/sample_transcript.txt`
   - `backend/main.py`
   - `backend/requirements.txt`
   - `frontend/index.html`

(I've already created these for you in this conversation — download them from the file links, and place each one in the matching folder shown above.)

Your folder should look like:
```
decision-log-extractor/
  backend/
    step1_extract.py
    sample_transcript.txt
    main.py
    requirements.txt
  frontend/
    index.html
```

---

## PART 3: Run Step 1 — test the extraction logic alone

This step proves the "brain" of your app works, with zero web/backend complexity.

1. Open a terminal, navigate into the backend folder:
   ```
   cd path/to/decision-log-extractor/backend
   ```

2. Create a virtual environment (keeps this project's packages separate from everything else on your computer):
   ```
   python -m venv venv
   ```

3. Activate it:
   - Mac/Linux: `source venv/bin/activate`
   - Windows: `venv\Scripts\activate`

   You'll know it worked because your terminal prompt now shows `(venv)` at the start.

4. Install the required packages:
   ```
   pip install -r requirements.txt
   ```

5. Set your Groq API key as an environment variable:
   - Mac/Linux:
     ```
     export GROQ_API_KEY="paste-your-key-here"
     ```
   - Windows (Command Prompt):
     ```
     set GROQ_API_KEY=paste-your-key-here
     ```
   (You'll need to do this every time you open a new terminal — or look up how to set it permanently later.)

6. Run the script:
   ```
   python step1_extract.py
   ```

7. **Expected result:** You should see a JSON list of 2 decisions printed (Postgres decision, and pricing-page-before-referral decision) from the sample transcript.

If this works, the hardest part — getting the AI to reliably extract structured data — is done. Everything after this is just wiring it up to a website.

**If it doesn't work:** copy the exact error message and I'll help you debug it.

---

## PART 4: Run Step 2 — start the backend API

1. Still inside `backend/` with your `venv` activated and `GROQ_API_KEY` set, run:
   ```
   uvicorn main:app --reload
   ```

2. You should see something like:
   ```
   Uvicorn running on http://127.0.0.1:8000
   ```

3. Open your browser and go to: **http://127.0.0.1:8000/docs**
   This is an automatic testing page FastAPI generates for you. Try the `/extract` endpoint directly from this page — click it, click "Try it out", paste in some transcript text, click "Execute".

4. A file called `decisions.db` will appear in your backend folder automatically — that's your database, created automatically, no setup needed.

Leave this terminal window running — don't close it. Your backend needs to stay running while you use the frontend.

---

## PART 5: Run Step 3 — open the frontend

1. Just double-click `frontend/index.html` — it'll open in your browser directly. No server needed for this simple version.

2. Paste a transcript (or use the sample_transcript.txt content), click **Extract Decisions**.

3. You should see decision cards appear, and they'll also show up in "Past Decisions" below, with search working.

**If you see a CORS or connection error:** make sure your backend terminal from Part 4 is still running.

---

## PART 6: Deploy it for free (so you have a live link for your resume/portfolio)

### Deploy the backend (Render.com — free tier)
1. Push your `backend/` code to a GitHub repo (create a free GitHub account if you don't have one: https://github.com)
2. Go to https://render.com, sign up free, click **New → Web Service**
3. Connect your GitHub repo
4. Set:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port 10000`
5. Add an environment variable: `GROQ_API_KEY` = your key (in Render's dashboard, under "Environment")
6. Deploy. You'll get a live URL like `https://your-app.onrender.com`

> Note: SQLite (the file-based database) works fine for a portfolio demo, but Render's free tier wipes the disk on restart. For a portfolio project this is fine — mention it as a known limitation, or upgrade to Supabase's free Postgres later if you want persistence (I can help with that when you're ready).

### Deploy the frontend (Vercel — free tier)
1. In `frontend/index.html`, change this line near the top of the `<script>`:
   ```js
   const API_URL = "http://127.0.0.1:8000";
   ```
   to your live Render URL:
   ```js
   const API_URL = "https://your-app.onrender.com";
   ```
2. Push the `frontend/` folder to GitHub (same repo or a new one)
3. Go to https://vercel.com, sign up free, **Import Project**, point it at your `frontend` folder
4. Deploy. You'll get a live link like `https://your-project.vercel.app`

Now you have a live, working, free project you can put in your resume and portfolio.

---

## PART 7: What to do if something breaks

Common beginner issues:
- **`ModuleNotFoundError`** → you forgot to activate `venv` or run `pip install -r requirements.txt`
- **`GROQ_API_KEY` errors** → the environment variable wasn't set in that terminal session; re-run the `export`/`set` command
- **Frontend says "could not connect to backend"** → your `uvicorn` terminal isn't running, or `API_URL` in `index.html` doesn't match where your backend actually is
- **Model returns weird/broken JSON occasionally** → this is expected sometimes with LLMs; the code already handles it by returning an empty list instead of crashing. If you want, we can add a retry step later.

---

## PART 8: Suggested next steps (once the MVP works)

Once you're comfortable with the basics above, come back and we can add, one at a time:
1. Tagging decisions by topic
2. "Similar past decision" detection
3. Swapping SQLite for a persistent free Postgres database (Supabase)
4. A simple auth layer so multiple people can use it
5. Slack integration to pull transcripts automatically

Don't try to do all of these at once — get the MVP fully working and deployed first, that's the version you show in interviews.
