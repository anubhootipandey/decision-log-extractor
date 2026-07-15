const SUPABASE_URL = "https://znoqwwhvkqcnlseapiyd.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpub3F3d2h2a3FjbmxzZWFwaXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwOTc2MjcsImV4cCI6MjA5OTY3MzYyN30.ETCkkS7aFIx-wMPWK334r5b5_HKAeYXlUXfttuk6ifk"; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://decision-log-extractor.onrender.com"; 

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------- Auth ----------------

function switchAuthTab(tab) {
  document.getElementById("tabLogin").classList.toggle("active", tab === "login");
  document.getElementById("tabSignup").classList.toggle("active", tab === "signup");
  document.getElementById("loginForm").classList.toggle("hidden", tab !== "login");
  document.getElementById("signupForm").classList.toggle("hidden", tab !== "signup");
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const status = document.getElementById("loginStatus");

  status.className = "auth-status";
  status.textContent = "Logging in...";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    status.className = "auth-status err";
    status.textContent = error.message;
  } else {
    status.className = "auth-status ok";
    status.textContent = "Logged in.";
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const status = document.getElementById("signupStatus");

  status.className = "auth-status";
  status.textContent = "Creating your account...";

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    status.className = "auth-status err";
    status.textContent = error.message;
  } else {
    status.className = "auth-status ok";
    status.textContent = "Account created. If email confirmation is on, check your inbox — otherwise you're logged in.";
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
}

async function getAccessToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.access_token : null;
}

function showApp(user) {
  document.getElementById("authGate").classList.add("hidden");
  document.getElementById("appContent").classList.remove("hidden");
  document.getElementById("navUserBar").style.display = "flex";
  document.getElementById("navCtaLoggedOut").style.display = "none";
  document.getElementById("navUserEmail").textContent = user.email;
  loadDecisions();
}

function showAuthGate() {
  document.getElementById("authGate").classList.remove("hidden");
  document.getElementById("appContent").classList.add("hidden");
  document.getElementById("navUserBar").style.display = "none";
  document.getElementById("navCtaLoggedOut").style.display = "inline-block";
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session && session.user) {
    showApp(session.user);
  } else {
    showAuthGate();
  }
});

// ---------------- App logic ----------------

function setLoading(isLoading) {
  const btn = document.getElementById("extractBtn");
  const label = document.getElementById("extractBtnLabel");
  btn.disabled = isLoading;
  label.innerHTML = isLoading
    ? `<span class="spinner"></span> Extracting...`
    : "Extract decisions";
}

async function extractDecisions() {
  const transcriptEl = document.getElementById("transcript");
  const transcript = transcriptEl.value;
  const meetingTitle = document.getElementById("meetingTitle").value || "Untitled meeting";
  const status = document.getElementById("status");
  const results = document.getElementById("results");

  if (!transcript.trim()) {
    status.className = "err";
    status.textContent = "Please paste a transcript first.";
    transcriptEl.focus();
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    status.className = "err";
    status.textContent = "Your session expired — please log in again.";
    return;
  }

  status.className = "";
  status.textContent = "Extracting... (this calls the AI model, takes a few seconds)";
  results.innerHTML = "";
  setLoading(true);

  try {
    const res = await fetch(`${API_URL}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ transcript, meeting_title: meetingTitle })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `Server responded with ${res.status}`);
    }

    const data = await res.json();

    if (data.count === 0) {
      status.className = "";
      status.textContent = "No clear decisions were found in this transcript.";
      results.innerHTML = `<div class="card"><p class="empty-msg">Nothing to file — try a transcript with a clearer outcome or agreement.</p></div>`;
    } else {
      status.className = "ok";
      status.textContent = `✅ Found ${data.count} decision${data.count > 1 ? "s" : ""}.`;

      results.innerHTML = data.decisions.map(d => `
        <div class="card">
          <h3>${escapeHtml(d.decision)}</h3>
          <div class="meta">Owner: ${escapeHtml(d.owner || "unknown")} · Rationale: ${escapeHtml(d.rationale || "not stated")}</div>
          <div class="quote">"${escapeHtml(d.source_quote || "")}"</div>
        </div>`
      ).join("");
    }

    loadDecisions();
  } catch (err) {
    status.className = "err";
    status.textContent = `❌ ${err.message || "Could not reach the backend."}`;
    console.error(err);
  } finally {
    setLoading(false);
  }
}

function clearForm() {
  document.getElementById("meetingTitle").value = "";
  document.getElementById("transcript").value = "";
  document.getElementById("results").innerHTML = "";
  document.getElementById("status").textContent = "";
  document.getElementById("status").className = "";
  updateCharCount();
  document.getElementById("transcript").focus();
}

function updateCharCount() {
  const count = document.getElementById("transcript").value.length;
  const el = document.getElementById("charCount");
  if (el) el.textContent = `${count.toLocaleString()} characters`;
}

let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadDecisions, 300);
}

async function loadDecisions() {
  const search = document.getElementById("searchBox").value;
  const container = document.getElementById("pastDecisions");

  const token = await getAccessToken();
  if (!token) return; // not logged in yet — auth gate is showing instead

  try {
    const res = await fetch(`${API_URL}/decisions${search ? "?search=" + encodeURIComponent(search) : ""}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const data = await res.json();

    if (data.length === 0) {
      container.innerHTML = `<div class="card"><p class="empty-msg">${search ? "No matching decisions." : "No decisions logged yet — extract your first transcript above."}</p></div>`;
      return;
    }

    container.innerHTML = data.map(d => `
      <div class="card">
        <h3>${escapeHtml(d.decision)}</h3>
        <div class="meta">
          ${escapeHtml(d.meeting_title || "")} · Owner: ${escapeHtml(d.owner || "unknown")} · ${new Date(d.created_at).toLocaleDateString()}
        </div>
        <div class="quote">"${escapeHtml(d.source_quote || "")}"</div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="empty-msg">Could not load past decisions. Is the backend running?</p></div>`;
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const transcriptEl = document.getElementById("transcript");
  transcriptEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      extractDecisions();
    }
  });
  transcriptEl.addEventListener("input", updateCharCount);
  updateCharCount();
});