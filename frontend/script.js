const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://your-app-name.onrender.com"; 
    
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  status.className = "";
  status.textContent = "Extracting... (this calls the AI model, takes a few seconds)";
  results.innerHTML = "";
  setLoading(true);

  try {
    const res = await fetch(`${API_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, meeting_title: meetingTitle })
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
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

    loadDecisions(); // refresh the past-decisions list too
  } catch (err) {
    status.className = "err";
    status.textContent = "❌ Could not reach the backend. Is it running / deployed?";
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

// Debounce so search doesn't fire an API call on every single keystroke
let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadDecisions, 300);
}

async function loadDecisions() {
  const search = document.getElementById("searchBox").value;
  const container = document.getElementById("pastDecisions");

  try {
    const res = await fetch(`${API_URL}/decisions${search ? "?search=" + encodeURIComponent(search) : ""}`);
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

// Keyboard shortcut: Ctrl/Cmd + Enter inside the textarea submits the form
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

  // Load past decisions when the page first opens
  loadDecisions();
});