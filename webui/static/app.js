/* k9x_Repository — Phase 1 */

const API = "";
let allSBBs = [];
let allABBs = [];
let activeABB = null;
let activeKind = "";
let activeStatus = "";
let searchTerm = "";

// ── Theme ──────────────────────────────────────────────────────────────────
const DARK_KEY = "k9repo_dark";
function initTheme() {
  if (localStorage.getItem(DARK_KEY) === "1") document.body.classList.add("dark");
  updateThemeIcon();
}
function toggleTheme() {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem(DARK_KEY, dark ? "1" : "0");
  updateThemeIcon();
}
function updateThemeIcon() {
  const btn = document.getElementById("theme-btn");
  if (btn) btn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

// ── Fetch helpers ──────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || r.statusText);
  }
  return r.json();
}
async function patchJSON(url) {
  const r = await fetch(url, { method: "PATCH" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function del(url) {
  const r = await fetch(url, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove("show"), 3000);
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats() {
  const total     = allSBBs.length;
  const published = allSBBs.filter(s => s.status === "published").length;
  const promoted  = allSBBs.filter(s => s.status === "promoted").length;
  const passed    = allSBBs.filter(s => s.inspect_passed).length;
  document.getElementById("stat-total").textContent    = total;
  document.getElementById("stat-published").textContent = published;
  document.getElementById("stat-promoted").textContent  = promoted;
  document.getElementById("stat-inspect").textContent   = passed;
}

// ── ABB sidebar ────────────────────────────────────────────────────────────
function renderABBList() {
  const ul = document.getElementById("abb-list");
  ul.innerHTML = "";

  const all = document.createElement("div");
  all.className = "abb-item" + (activeABB === null ? " active" : "");
  all.innerHTML = `<span class="abb-dot"></span> All SBBs`;
  all.onclick = () => { activeABB = null; renderABBList(); renderSBBGrid(); };
  ul.appendChild(all);

  const foundation = allABBs.filter(a => a.level === "Foundation");
  const common     = allABBs.filter(a => a.level === "CommonSystems");

  if (foundation.length) {
    const lbl = document.createElement("div");
    lbl.className = "abb-section-label"; lbl.style.marginTop = "12px";
    lbl.textContent = "Foundation";
    ul.appendChild(lbl);
    foundation.forEach(a => ul.appendChild(abbItem(a)));
  }
  if (common.length) {
    const lbl = document.createElement("div");
    lbl.className = "abb-section-label"; lbl.style.marginTop = "12px";
    lbl.textContent = "Common Systems";
    ul.appendChild(lbl);
    common.forEach(a => ul.appendChild(abbItem(a, true)));
  }
}

function abbItem(abb, isCS = false) {
  const el = document.createElement("div");
  el.className = "abb-item" + (activeABB === abb.name ? " active" : "");
  el.innerHTML = `<span class="abb-dot${isCS ? " cs" : ""}"></span>${abb.name}`;
  el.onclick = () => { activeABB = abb.name; renderABBList(); renderSBBGrid(); };
  return el;
}

// ── SBB grid ───────────────────────────────────────────────────────────────
function filteredSBBs() {
  return allSBBs.filter(s => {
    if (activeABB && s.abb_name !== activeABB) return false;
    if (activeKind && s.kind !== activeKind) return false;
    if (activeStatus && s.status !== activeStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return s.name.toLowerCase().includes(q) ||
             (s.description || "").toLowerCase().includes(q) ||
             (s.domain || "").toLowerCase().includes(q);
    }
    return true;
  });
}

function renderSBBGrid() {
  const grid  = document.getElementById("sbb-grid");
  const items = filteredSBBs();
  grid.innerHTML = "";

  if (!items.length) {
    grid.innerHTML = `<div class="empty">
      <div class="empty-icon">📦</div>
      <p>No SBBs found. Publish one to get started.</p>
    </div>`;
    return;
  }

  items.forEach(s => {
    const card = document.createElement("div");
    card.className = "sbb-card";
    card.onclick = () => openDetail(s);

    const inspBadge = s.inspect_passed
      ? `<span class="badge badge-inspect">✓ inspect</span>`
      : `<span class="badge badge-noinspect">✗ inspect</span>`;

    card.innerHTML = `
      <div class="status-dot status-${s.status}"></div>
      <div class="sbb-card-header">
        <div class="sbb-name">${s.name}</div>
        <div class="sbb-version">v${s.version}</div>
      </div>
      <div class="sbb-desc">${s.description || "No description."}</div>
      <div class="sbb-meta">
        ${s.kind   ? `<span class="badge badge-kind">${s.kind}</span>` : ""}
        ${s.domain ? `<span class="badge badge-domain">${s.domain}</span>` : ""}
        ${s.abb_name ? `<span class="badge badge-abb">${s.abb_name}</span>` : ""}
        ${inspBadge}
      </div>`;
    grid.appendChild(card);
  });
}

// ── Detail modal ───────────────────────────────────────────────────────────
function openDetail(s) {
  document.getElementById("detail-title").textContent = s.name;
  document.getElementById("detail-body").innerHTML = `
    <div class="detail-desc">${s.description || "No description."}</div>
    <div class="detail-section">
      <h3>Metadata</h3>
      ${row("Kind",          s.kind)}
      ${row("Domain",        s.domain)}
      ${row("ABB Contract",  s.abb_name)}
      ${row("Version",       s.version)}
      ${row("Status",        s.status)}
      ${row("Inspect",       s.inspect_passed ? "✓ Passed" : "✗ Not passed")}
      ${row("Published by",  s.published_by)}
      ${row("Project",       s.project)}
      ${row("Tags",          (s.tags || []).join(", "))}
      ${row("Published at",  s.published_at ? new Date(s.published_at).toLocaleString() : "—")}
    </div>
    <div class="detail-actions">
      ${s.status === "published"
        ? `<button class="btn btn-primary btn-sm" onclick="promoteSBB(${s.id})">Promote</button>`
        : ""}
      <button class="btn btn-danger btn-sm" onclick="deleteSBB(${s.id})">Delete</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal('detail-modal')">Close</button>
    </div>`;
  openModal("detail-modal");
}

function row(key, val) {
  if (!val) return "";
  return `<div class="detail-row">
    <span class="detail-key">${key}</span>
    <span class="detail-value">${val}</span>
  </div>`;
}

async function promoteSBB(id) {
  try {
    await patchJSON(`${API}/api/v1/sbbs/${id}/promote`);
    toast("SBB promoted to shared catalog");
    closeModal("detail-modal");
    await loadSBBs();
  } catch(e) { toast(e.message, "error"); }
}

async function deleteSBB(id) {
  if (!confirm("Delete this SBB?")) return;
  try {
    await del(`${API}/api/v1/sbbs/${id}`);
    toast("SBB deleted");
    closeModal("detail-modal");
    await loadSBBs();
  } catch(e) { toast(e.message, "error"); }
}

// ── Publish modal ──────────────────────────────────────────────────────────
function openPublishModal() {
  document.getElementById("publish-form").reset();
  populateABBSelect();
  openModal("publish-modal");
}

function populateABBSelect() {
  const sel = document.getElementById("f-abb");
  sel.innerHTML = `<option value="">— Select ABB —</option>`;
  allABBs.forEach(a => {
    const o = document.createElement("option");
    o.value = a.name; o.textContent = `${a.name} (${a.level})`;
    sel.appendChild(o);
  });
}

async function submitPublish(e) {
  e.preventDefault();
  const tags = document.getElementById("f-tags").value
    .split(",").map(t => t.trim()).filter(Boolean);

  const payload = {
    name:           document.getElementById("f-name").value.trim(),
    kind:           document.getElementById("f-kind").value,
    description:    document.getElementById("f-desc").value.trim(),
    domain:         document.getElementById("f-domain").value.trim(),
    abb_name:       document.getElementById("f-abb").value || null,
    version:        document.getElementById("f-version").value.trim() || "1.0.0",
    tags,
    inspect_passed: document.getElementById("f-inspect").checked,
    published_by:   document.getElementById("f-author").value.trim() || null,
    project:        document.getElementById("f-project").value.trim() || null,
  };

  try {
    await postJSON(`${API}/api/v1/sbbs`, payload);
    toast("SBB published successfully");
    closeModal("publish-modal");
    await loadSBBs();
  } catch(e) { toast(e.message, "error"); }
}

// ── Modal helpers ──────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// ── Data loading ───────────────────────────────────────────────────────────
async function loadABBs() {
  allABBs = await fetchJSON(`${API}/api/v1/abbs`);
  renderABBList();
}
async function loadSBBs() {
  allSBBs = await fetchJSON(`${API}/api/v1/sbbs`);
  renderStats();
  renderSBBGrid();
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  initTheme();

  document.getElementById("theme-btn").onclick = toggleTheme;
  document.getElementById("publish-btn").onclick = openPublishModal;
  document.getElementById("publish-form").onsubmit = submitPublish;

  document.getElementById("search-input").oninput = e => {
    searchTerm = e.target.value;
    renderSBBGrid();
  };
  document.getElementById("filter-kind").onchange = e => {
    activeKind = e.target.value;
    renderSBBGrid();
  };
  document.getElementById("filter-status").onchange = e => {
    activeStatus = e.target.value;
    renderSBBGrid();
  };

  document.querySelectorAll(".modal-overlay").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); });
  });

  await Promise.all([loadABBs(), loadSBBs()]);
}

document.addEventListener("DOMContentLoaded", init);
