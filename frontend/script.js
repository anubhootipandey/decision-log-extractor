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
 
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  btn.classList.toggle("active", isHidden);
}
 
function validateSignupEmail() {
  const email = document.getElementById("signupEmail").value.trim();
  const hint = document.getElementById("signupEmailHint");
  if (!email) {
    hint.className = "field-hint";
    hint.textContent = "";
    return;
  }
  const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  hint.className = looksValid ? "field-hint ok" : "field-hint err";
  hint.textContent = looksValid ? "Looks good." : "Enter a valid email address.";
}
 
function validateSignupPassword() {
  const pw = document.getElementById("signupPassword").value;
  const reqs = {
    reqLength: pw.length >= 8,
    reqNumber: /\d/.test(pw),
    reqLetter: /[a-zA-Z]/.test(pw)
  };
  Object.entries(reqs).forEach(([id, met]) => {
    document.getElementById(id).classList.toggle("met", met);
  });
  return Object.values(reqs).every(Boolean);
}
 
function setAuthLoading(formPrefix, isLoading, loadingText) {
  const btn = document.getElementById(`${formPrefix}Btn`);
  const label = document.getElementById(`${formPrefix}BtnLabel`);
  const defaultText = formPrefix === "login" ? "Log in" : "Create account";
  btn.disabled = isLoading;
  label.innerHTML = isLoading ? `<span class="spinner"></span> ${loadingText}` : defaultText;
}
 
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const status = document.getElementById("loginStatus");
 
  status.className = "auth-status";
  status.textContent = "";
  setAuthLoading("login", true, "Logging in...");
 
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
 
  setAuthLoading("login", false);
 
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
  status.textContent = "";
  setAuthLoading("signup", true, "Creating account...");
 
  const { error } = await supabaseClient.auth.signUp({ email, password });
 
  setAuthLoading("signup", false);
 
  if (error) {
    status.className = "auth-status err";
    status.textContent = error.message;
  } else {
    status.className = "auth-status ok";
    status.textContent = "Account created. If email confirmation is on, check your inbox — otherwise you're logged in.";
  }
}
 
async function handleForgotPassword(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const status = document.getElementById("loginStatus");
 
  if (!email) {
    status.className = "auth-status err";
    status.textContent = "Enter your email above first, then click \"Forgot password?\"";
    document.getElementById("loginEmail").focus();
    return;
  }
 
  status.className = "auth-status";
  status.textContent = "Sending reset link...";
 
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
 
  if (error) {
    status.className = "auth-status err";
    status.textContent = error.message;
  } else {
    status.className = "auth-status ok";
    status.textContent = "If an account exists for that email, a reset link is on its way.";
  }
}
 
async function handleLogout() {
  closeUserMenu();
  await supabaseClient.auth.signOut();
}
 
async function getAccessToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.access_token : null;
}
 
function toggleUserMenu() {
  document.getElementById("userDropdown").classList.toggle("hidden");
}
 
function closeUserMenu() {
  document.getElementById("userDropdown").classList.add("hidden");
}
 
// Close the user dropdown when clicking anywhere outside it
document.addEventListener("click", (e) => {
  const menu = document.getElementById("navUserBar");
  if (menu && !menu.contains(e.target)) closeUserMenu();
});
 
function showApp(user) {
  document.getElementById("mainNav").classList.remove("hidden");
  document.getElementById("authGate").classList.add("hidden");
  document.getElementById("appContent").classList.remove("hidden");
  document.getElementById("navUserBar").style.display = "flex";
  document.getElementById("navUserEmail").textContent = user.email;
  document.getElementById("navAvatar").textContent = (user.email || "?").charAt(0);
  loadDecisions();
}
 
function showAuthGate() {
  document.getElementById("mainNav").classList.add("hidden");
  document.getElementById("authGate").classList.remove("hidden");
  document.getElementById("appContent").classList.add("hidden");
  document.getElementById("navUserBar").style.display = "none";
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