/* k9x Repository — Phase 1 + 2 */

const API = "";
let activeTab = "sbbs";
let currentUser = null;
let isAdminMode = true;
let allSBBs = [], allABBs = [], allApps = [], allUsers = [], allPending = [], allPendingApps = [];
let pendingRejectId = null, pendingRejectType = null;
let activeSBBFilter = { abb: null, kind: "", status: "", search: "" };
// These three are always present in every k9-aif solution — filtering by them is noise
const INFRA_ABBS = new Set(["BaseRouter", "BaseOrchestrator", "BaseSquad"]);
let activeABBFilter = { level: "", search: "" };
let activeAppFilter = { status: "", search: "" };
let activeUserFilter = { role: "", search: "" };

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
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(e.detail || r.statusText); }
  return r.json();
}
async function patchJSON(url, body = {}) {
  const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  setTimeout(() => el.classList.remove("show"), 3200);
}

// ── Tabs / Nav ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  // close any open nav dropdowns
  document.querySelectorAll(".nav-item.open").forEach(i => i.classList.remove("open"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `panel-${tab}`));
  document.getElementById("sidebar-sbbs").style.display       = tab === "sbbs"       ? "" : "none";
  document.getElementById("sidebar-abbs").style.display       = tab === "abbs"       ? "" : "none";
  document.getElementById("sidebar-apps").style.display       = tab === "apps"       ? "" : "none";
  document.getElementById("sidebar-users").style.display      = tab === "users"      ? "" : "none";
  document.getElementById("sidebar-review").style.display     = tab === "review"     ? "" : "none";
  document.getElementById("sidebar-app-review").style.display = tab === "app-review" ? "" : "none";
  document.getElementById("sidebar-abb-list").style.display   = tab === "sbbs"       ? "" : "none";
  document.getElementById("search-input").placeholder =
    tab === "sbbs"   ? "Search SBBs…"         :
    tab === "abbs"   ? "Search ABBs…"          :
    tab === "apps"   ? "Search applications…"  :
    tab === "review" ? ""                      : "Search users…";
  const catalogTabs = ["sbbs", "abbs"];
  document.getElementById("nav-catalog")?.classList.toggle("active", catalogTabs.includes(tab));
  document.getElementById("nav-apps")?.classList.toggle("active", tab === "apps");
  document.getElementById("nav-review")?.classList.toggle("active", ["review","app-review"].includes(tab));
  render();
}

function switchTabFromChip(tab) {
  document.getElementById("user-chip-dropdown")?.classList.remove("open");
  switchTab(tab);
}

// ── Admin mode ─────────────────────────────────────────────────────────────
function toggleAdminMode() {
  isAdminMode = !isAdminMode;
  applyAdminMode();
  if (!isAdminMode && ["users","projects","groups","review","app-review"].includes(activeTab)) switchTab("sbbs");
}

function applyAdminMode() {
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = isAdminMode ? "" : "none";
  });
  const roleEl = document.getElementById("user-chip-role");
  const toggleBtn = document.getElementById("admin-toggle-btn");
  if (roleEl && currentUser?.role === "admin") {
    roleEl.textContent = isAdminMode ? "Admin mode" : "Limited access";
    roleEl.className   = `user-chip-role ${isAdminMode ? "role-chip-admin" : "role-chip-analyst"}`;
  }
  if (toggleBtn) {
    toggleBtn.textContent = isAdminMode ? "🔒 Switch to limited access" : "🔑 Enter admin mode";
  }
}

function render() {
  if (activeTab === "sbbs")       renderSBBGrid();
  if (activeTab === "abbs")       renderABBGrid();
  if (activeTab === "apps")       renderAppGrid();
  if (activeTab === "users")      renderUserGrid();
  if (activeTab === "review")     renderReviewQueue();
  if (activeTab === "app-review") renderAppReviewQueue();
}

// ── SBBs ───────────────────────────────────────────────────────────────────
function renderSBBStats() {
  document.getElementById("stat-total").textContent     = allSBBs.length;
  document.getElementById("stat-published").textContent = allSBBs.filter(s => s.status === "published").length;
  document.getElementById("stat-promoted").textContent  = allSBBs.filter(s => s.status === "promoted").length;
  document.getElementById("stat-inspect").textContent   = allSBBs.filter(s => s.inspect_passed).length;
}

function filteredSBBs() {
  const f = activeSBBFilter;
  return allSBBs.filter(s => {
    if (f.abb    && !(s.abb_names || []).includes(f.abb)) return false;
    if (f.kind   && s.kind    !== f.kind)    return false;
    if (f.status && s.status  !== f.status)  return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      return (s.name || "").toLowerCase().includes(q) ||
             (s.description || "").toLowerCase().includes(q) ||
             (s.domain || "").toLowerCase().includes(q);
    }
    return true;
  });
}

function renderSBBGrid() {
  renderSBBStats();
  renderABBList();
  const grid  = document.getElementById("sbb-grid");
  const items = filteredSBBs();
  grid.innerHTML = "";
  if (!items.length) { grid.innerHTML = emptyState("📦", "No SBBs found. Publish one to get started."); return; }
  items.forEach(s => {
    const card = document.createElement("div");
    card.className = "sbb-card";
    card.onclick = () => openSBBDetail(s);
    card.innerHTML = `
      <div class="status-dot status-${s.status}"></div>
      <div class="sbb-card-header">
        <div class="sbb-name">${s.name}</div>
        <div class="sbb-version">v${s.version}</div>
      </div>
      <div class="sbb-desc">${s.description || "No description."}</div>
      <div class="sbb-meta">
        ${s.kind     ? badge("badge-kind",   s.kind)     : ""}
        ${s.domain ? badge("badge-domain", s.domain) : ""}
        ${(s.abb_names || []).map(a => badge("badge-abb", a)).join("")}
        ${s.inspect_passed ? badge("badge-inspect","✓ inspect") : badge("badge-noinspect","✗ inspect")}
      </div>`;
    grid.appendChild(card);
  });
}

// ── ABB list (sidebar) ─────────────────────────────────────────────────────
function renderABBList() {
  const ul = document.getElementById("abb-list");
  ul.innerHTML = "";
  const all = mkItem("All SBBs", activeSBBFilter.abb === null, false, () => {
    activeSBBFilter.abb = null; renderABBList(); renderSBBGrid();
  });
  ul.appendChild(all);
  const foundation = allABBs.filter(a => a.level === "Foundation"    && !INFRA_ABBS.has(a.name));
  const common     = allABBs.filter(a => a.level === "CommonSystems" && !INFRA_ABBS.has(a.name));
  if (foundation.length) { ul.appendChild(sectionLabel("Foundation")); foundation.forEach(a => ul.appendChild(abbSidebarItem(a, false))); }
  if (common.length)     { ul.appendChild(sectionLabel("Common Systems")); common.forEach(a => ul.appendChild(abbSidebarItem(a, true))); }
}

function abbSidebarItem(a, isCS) {
  return mkItem(a.name, activeSBBFilter.abb === a.name, isCS, () => {
    activeSBBFilter.abb = a.name; renderABBList(); renderSBBGrid();
  });
}

function mkItem(label, active, isCS, onclick) {
  const el = document.createElement("div");
  el.className = "abb-item" + (active ? " active" : "");
  el.innerHTML = `<span class="abb-dot${isCS ? " cs" : ""}"></span>${label}`;
  el.onclick = onclick;
  return el;
}

function sectionLabel(text) {
  const el = document.createElement("div");
  el.className = "abb-section-label"; el.style.marginTop = "10px";
  el.textContent = text;
  return el;
}

// ── ABB catalog ────────────────────────────────────────────────────────────
function filteredABBs() {
  const f = activeABBFilter;
  return allABBs.filter(a => {
    if (f.level  && a.level !== f.level) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      return (a.name || "").toLowerCase().includes(q) ||
             (a.description || "").toLowerCase().includes(q);
    }
    return true;
  });
}

function renderABBGrid() {
  const items = filteredABBs();
  const grid  = document.getElementById("abb-grid");
  document.getElementById("abb-count").textContent = `${items.length} ABBs`;
  grid.innerHTML = "";

  const groups = { Foundation: [], CommonSystems: [], Industry: [], OrgSpecific: [] };
  items.forEach(a => { (groups[a.level] || groups.Foundation).push(a); });

  const levelLabel = { Foundation: "Foundation", CommonSystems: "Common Systems", Industry: "Industry", OrgSpecific: "Org Specific" };

  Object.entries(groups).forEach(([level, abbs]) => {
    if (!abbs.length) return;
    const section = document.createElement("div");
    section.className = "abb-catalog-section";
    section.innerHTML = `<div class="abb-catalog-label">${levelLabel[level]}</div>`;
    const row = document.createElement("div");
    row.className = "abb-catalog-row";
    abbs.forEach(a => {
      const card = document.createElement("div");
      card.className = "abb-card";
      card.onclick = () => openABBDetail(a);
      const sbbCount = allSBBs.filter(s => (s.abb_names || []).includes(a.name)).length;
      card.innerHTML = `
        <div class="abb-card-header">
          <span class="abb-kind-dot"></span>
          <span class="abb-card-name">${a.name}</span>
        </div>
        <div class="abb-card-kind">${badge("badge-kind", a.kind)}</div>
        <div class="abb-card-desc">${a.description || ""}</div>
        <div class="abb-card-footer">
          <span class="abb-module">${a.module || ""}</span>
          <span class="abb-sbb-count">${sbbCount} SBB${sbbCount !== 1 ? "s" : ""}</span>
        </div>`;
      row.appendChild(card);
    });
    section.appendChild(row);
    grid.appendChild(section);
  });

  if (!items.length) grid.innerHTML = emptyState("📐", "No ABBs match your filter.");
}

// ── Applications ───────────────────────────────────────────────────────────
function filteredApps() {
  const f = activeAppFilter;
  return allApps.filter(a => {
    if (f.status && a.status !== f.status) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      return (a.name || "").toLowerCase().includes(q) ||
             (a.description || "").toLowerCase().includes(q) ||
             (a.domain || "").toLowerCase().includes(q);
    }
    return true;
  });
}

function renderAppGrid() {
  document.getElementById("stat-apps-total").textContent      = allApps.length;
  document.getElementById("stat-apps-production").textContent = allApps.filter(a => a.status === "production").length;
  document.getElementById("stat-apps-active").textContent     = allApps.filter(a => a.status === "active").length;
  document.getElementById("stat-apps-poc").textContent        = allApps.filter(a => a.status === "poc").length;

  const items = filteredApps();
  const grid  = document.getElementById("app-grid");
  grid.innerHTML = "";
  if (!items.length) { grid.innerHTML = emptyState("🏗️", "No applications registered yet."); return; }
  items.forEach(a => {
    const card = document.createElement("div");
    card.className = "sbb-card";
    card.onclick = () => openAppDetail(a);
    const sbbList = (a.sbbs_used || []).slice(0, 3).map(s => badge("badge-abb", s)).join("") +
      (a.sbbs_used?.length > 3 ? `<span class="badge badge-kind">+${a.sbbs_used.length - 3}</span>` : "");
    card.innerHTML = `
      <div class="app-status-dot app-status-${a.status}"></div>
      <div class="sbb-card-header">
        <div class="sbb-name">${a.name}</div>
        <div class="sbb-version">${badge("app-badge-" + a.status, a.status.toUpperCase())}</div>
      </div>
      <div class="sbb-desc">${a.description || "No description."}</div>
      <div class="app-card-meta">
        ${a.team       ? `<div class="app-meta-row"><span class="app-meta-key">Team</span><span class="app-meta-val">${a.team}</span></div>` : ""}
        ${a.department ? `<div class="app-meta-row"><span class="app-meta-key">Dept</span><span class="app-meta-val">${a.department}</span></div>` : ""}
        ${a.project    ? `<div class="app-meta-row"><span class="app-meta-key">Project</span><span class="app-meta-val">${a.project}</span></div>` : ""}
      </div>
      <div class="sbb-meta" style="margin-top:8px">
        ${a.domain ? badge("badge-domain", a.domain) : ""}
        ${a.k9aif_version ? `<span class="badge badge-domain">k9-aif ${a.k9aif_version}</span>` : ""}
      </div>
      ${sbbList ? `<div class="sbb-meta" style="margin-top:6px">${sbbList}</div>` : ""}`;
    grid.appendChild(card);
  });
}

// ── Users ──────────────────────────────────────────────────────────────────
function filteredUsers() {
  const f = activeUserFilter;
  return allUsers.filter(u => {
    if (f.role && u.role !== f.role) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      return (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    }
    return true;
  });
}

function renderUserGrid() {
  document.getElementById("stat-users-total").textContent   = allUsers.length;
  document.getElementById("stat-users-admin").textContent   = allUsers.filter(u => u.role === "admin").length;
  document.getElementById("stat-users-dev").textContent     = allUsers.filter(u => u.role === "developer").length;
  document.getElementById("stat-users-analyst").textContent = allUsers.filter(u => u.role === "analyst").length;

  const items = filteredUsers();
  const grid  = document.getElementById("user-grid");
  grid.innerHTML = "";
  if (!items.length) { grid.innerHTML = emptyState("👤", "No users yet. Add one to get started."); return; }
  items.forEach(u => {
    const card = document.createElement("div");
    card.className = "user-card";
    card.onclick = () => openUserDetail(u);
    card.innerHTML = `
      <div class="user-avatar">${u.name.charAt(0).toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-email">${u.email}</div>
        ${u.phone ? `<div class="user-phone">${u.phone}</div>` : ""}
      </div>
      <div class="user-role-badge role-${u.role}">${u.role}</div>`;
    grid.appendChild(card);
  });
}

// ── Detail modals ──────────────────────────────────────────────────────────
async function openSBBDetail(s) {
  document.getElementById("detail-title").textContent = s.name;
  let auditHtml = "";
  try {
    const log = await fetchJSON(`${API}/api/v1/audit?entity=sbb&entity_id=${s.id}&limit=5`);
    if (log.length) {
      auditHtml = `<div class="detail-section"><h3>History</h3>` +
        log.map(e => `<div class="audit-row">
          <span class="audit-action audit-${e.action}">${e.action}</span>
          <span class="audit-actor">${e.actor || "—"}</span>
          <span class="audit-time">${fmtDate(e.created_at)}</span>
        </div>`).join("") + `</div>`;
    }
  } catch(_) {}
  document.getElementById("detail-body").innerHTML = `
    <div class="detail-desc">${s.description || "No description."}</div>
    <div class="detail-section"><h3>Metadata</h3>
      ${row("Kind",         s.kind)}
      ${row("Domain",       s.domain)}
      ${(s.abb_names||[]).length ? `<div class="detail-row"><span class="detail-key">ABB Contracts</span><span class="detail-value">${s.abb_names.join(", ")}</span></div>` : ""}
      ${row("Version",      s.version)}
      ${row("Status",       s.status)}
      ${row("Inspect",      s.inspect_passed ? "✓ Passed" : "✗ Not passed")}
      ${row("Published by",   s.published_by)}
      ${row("Technical Lead", s.tech_lead)}
      ${row("Project",        s.project)}
      ${s.git_ref ? `<div class="detail-row"><span class="detail-key">Source</span><span class="detail-value"><a href="${s.git_ref}" target="_blank" rel="noopener">${s.git_ref}</a></span></div>` : ""}
      ${row("Tags",         (s.tags || []).join(", "))}
      ${row("Published at", fmtDate(s.published_at))}
    </div>
    ${auditHtml}
    <div class="detail-actions">
      ${s.status === "published" ? `<button class="btn btn-primary btn-sm" onclick="promoteSBB(${s.id})">Promote</button>` : ""}
      <button class="btn btn-danger btn-sm" onclick="deleteSBB(${s.id})">Delete</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal('detail-modal')">Close</button>
    </div>`;
  openModal("detail-modal");
}

function openABBDetail(a) {
  const implementing = allSBBs.filter(s => (s.abb_names || []).includes(a.name));
  const appsUsing    = allApps.filter(app => (app.sbbs_used || []).some(s => implementing.map(i => i.name).includes(s)));
  document.getElementById("detail-title").textContent = a.name;
  document.getElementById("detail-body").innerHTML = `
    <div class="detail-desc">${a.description || "No description."}</div>
    <div class="detail-section"><h3>Contract</h3>
      ${row("Kind",   a.kind)}
      ${row("Level",  a.level)}
      ${row("Module", a.module)}
    </div>
    ${implementing.length ? `<div class="detail-section"><h3>Implementing SBBs (${implementing.length})</h3>` +
      implementing.map(s => `<div class="detail-row">
        <span class="detail-key">${s.name}</span>
        <span class="detail-value">${badge("badge-kind", s.kind)} ${badge("status-badge-" + s.status, s.status)}</span>
      </div>`).join("") + `</div>` : ""}
    ${appsUsing.length ? `<div class="detail-section"><h3>Used by Applications (${appsUsing.length})</h3>` +
      appsUsing.map(ap => `<div class="detail-row">
        <span class="detail-key">${ap.name}</span>
        <span class="detail-value">${badge("app-badge-" + ap.status, ap.status)}</span>
      </div>`).join("") + `</div>` : ""}
    <div class="detail-actions">
      <button class="btn btn-ghost btn-sm" onclick="closeModal('detail-modal')">Close</button>
    </div>`;
  openModal("detail-modal");
}

function openAppDetail(a) {
  document.getElementById("detail-title").textContent = a.name;
  document.getElementById("detail-body").innerHTML = `
    <div class="detail-desc">${a.description || "No description."}</div>
    <div class="detail-section"><h3>Details</h3>
      ${row("Project",       a.project)}
      ${row("Department",    a.department)}
      ${row("Domain",        a.domain)}
      ${row("Status",        a.status)}
      ${row("Team",    a.team)}
      ${row("Contact", a.contact)}
      ${row("k9-aif ver",   a.k9aif_version)}
      ${row("Tags",          (a.tags || []).join(", "))}
      ${a.url ? `<div class="detail-row"><span class="detail-key">URL</span><span class="detail-value"><a href="${a.url}" target="_blank" rel="noopener">${a.url}</a></span></div>` : ""}
    </div>
    ${(a.sbbs_used || []).length ? `<div class="detail-section"><h3>SBBs Used</h3>` +
      (a.sbbs_used).map(s => `<div class="detail-row"><span class="detail-key">${s}</span>
        <span class="detail-value">${allSBBs.find(sb => sb.name === s) ? badge("badge-inspect","✓ in catalog") : badge("badge-noinspect","not in catalog")}</span>
      </div>`).join("") + `</div>` : ""}
    <div class="detail-actions">
      <button class="btn btn-danger btn-sm" onclick="deleteApp(${a.id})">Remove</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal('detail-modal')">Close</button>
    </div>`;
  openModal("detail-modal");
}

function openUserDetail(u) {
  document.getElementById("detail-title").textContent = u.name;
  document.getElementById("detail-body").innerHTML = `
    <div class="detail-section"><h3>Profile</h3>
      ${row("Email",       u.email)}
      ${row("Phone",       u.phone)}
      ${row("Role",        u.role)}
      ${row("Department",  u.department)}
      ${row("Team",        u.team)}
      ${row("Manager",     u.manager)}
      ${row("Project",     u.project)}
      ${row("Application", u.application)}
      ${row("Status",      u.is_active ? "Active" : "Inactive")}
      ${row("Since",       fmtDate(u.created_at))}
    </div>
    <div class="detail-actions">
      <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Remove</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal('detail-modal')">Close</button>
    </div>`;
  openModal("detail-modal");
}

// ── SBB publish form ───────────────────────────────────────────────────────
function openPublishModal() {
  document.getElementById("publish-form").reset();
  const list = document.getElementById("f-abb-list");
  list.innerHTML = "";
  const groups = { Foundation: [], CommonSystems: [] };
  allABBs.forEach(a => (groups[a.level] || groups.Foundation).push(a));
  Object.entries(groups).forEach(([level, abbs]) => {
    if (!abbs.length) return;
    const lbl = document.createElement("div");
    lbl.className = "abb-cb-group-label";
    lbl.textContent = level === "CommonSystems" ? "Common Systems" : level;
    list.appendChild(lbl);
    abbs.forEach(a => {
      const row = document.createElement("label");
      row.className = "abb-cb-row";
      row.innerHTML = `<input type="checkbox" class="abb-cb" value="${a.name}" />
        <span class="abb-cb-name">${a.name}</span>
        <span class="abb-cb-kind">${a.kind}</span>`;
      list.appendChild(row);
    });
  });
  openModal("publish-modal");
}

async function submitPublish(e) {
  e.preventDefault();
  // Client-side gates (server repeats these — early feedback only)
  const nameVal = document.getElementById("f-name").value.trim();
  if (!/^[A-Z]/.test(nameVal))  { toast("Name must start with an uppercase letter (PascalCase)", "error"); return; }
  if (/\s/.test(nameVal))        { toast("Name must not contain spaces — use PascalCase", "error"); return; }
  if (nameVal.length < 3)        { toast("Name must be at least 3 characters", "error"); return; }
  const descVal = document.getElementById("f-desc").value.trim();
  if (descVal && descVal.length < 20) { toast("Description must be at least 20 characters or leave it empty", "error"); return; }
  const checkedAbbs = [...document.querySelectorAll(".abb-cb:checked")].map(c => c.value);
  const customAbbs  = splitCSV(document.getElementById("f-abb-custom")?.value || "");
  if (!checkedAbbs.length && !customAbbs.length) { toast("Select at least one ABB contract", "error"); return; }
  const payload = {
    name:           document.getElementById("f-name").value.trim(),
    kind:           document.getElementById("f-kind").value,
    description:    document.getElementById("f-desc").value.trim(),
    domain:         document.getElementById("f-domain").value.trim(),
    abb_names:      [...new Set([
                      ...[...document.querySelectorAll(".abb-cb:checked")].map(c => c.value),
                      ...splitCSV(document.getElementById("f-abb-custom")?.value || ""),
                    ])],
    version:        document.getElementById("f-version").value.trim() || "1.0.0",
    tags:           splitCSV(document.getElementById("f-tags").value),
    inspect_passed: document.getElementById("f-inspect").checked,
    published_by:   document.getElementById("f-author").value.trim() || null,
    tech_lead:      document.getElementById("f-tech-lead").value.trim() || null,
    project:        document.getElementById("f-project").value.trim() || null,
    git_ref:        document.getElementById("f-git-ref").value.trim() || null,
  };
  try {
    await postJSON(`${API}/api/v1/sbbs`, payload);
    toast("SBB published");
    closeModal("publish-modal");
    await loadSBBs();
  } catch(err) { toast(err.message, "error"); }
}

async function promoteSBB(id) {
  try {
    await patchJSON(`${API}/api/v1/sbbs/${id}/promote`);
    toast("SBB promoted to shared catalog");
    closeModal("detail-modal");
    await loadSBBs();
  } catch(err) { toast(err.message, "error"); }
}

async function deleteSBB(id) {
  if (!confirm("Delete this SBB?")) return;
  try {
    await del(`${API}/api/v1/sbbs/${id}`);
    toast("SBB deleted");
    closeModal("detail-modal");
    await loadSBBs();
  } catch(err) { toast(err.message, "error"); }
}

// ── App register form ──────────────────────────────────────────────────────
async function submitApp(e) {
  e.preventDefault();
  const payload = {
    name:          document.getElementById("a-name").value.trim(),
    description:   document.getElementById("a-desc").value.trim(),
    domain:        document.getElementById("a-domain").value.trim(),
    project:       document.getElementById("a-project").value.trim() || null,
    department:    document.getElementById("a-department").value.trim() || null,
    url:           document.getElementById("a-url").value.trim() || null,
    team:          document.getElementById("a-team").value.trim() || null,
    contact:       document.getElementById("a-contact").value.trim() || null,
    k9aif_version: document.getElementById("a-version").value.trim() || null,
    status:        document.getElementById("a-status").value,
    tags:          splitCSV(document.getElementById("a-tags").value),
    sbbs_used:     splitCSV(document.getElementById("a-sbbs").value),
  };
  try {
    await postJSON(`${API}/api/v1/applications`, payload);
    toast("Application registered");
    closeModal("app-modal");
    await loadApps();
  } catch(err) { toast(err.message, "error"); }
}

async function deleteApp(id) {
  if (!confirm("Remove this application?")) return;
  try {
    await del(`${API}/api/v1/applications/${id}`);
    toast("Application removed");
    closeModal("detail-modal");
    await loadApps();
  } catch(err) { toast(err.message, "error"); }
}

// ── User form ──────────────────────────────────────────────────────────────
async function submitUser(e) {
  e.preventDefault();
  const payload = {
    name:        document.getElementById("u-name").value.trim(),
    email:       document.getElementById("u-email").value.trim(),
    phone:       document.getElementById("u-phone").value.trim()       || null,
    role:        document.getElementById("u-role").value,
    department:  document.getElementById("u-department").value.trim()  || null,
    team:        document.getElementById("u-team").value.trim()        || null,
    manager:     document.getElementById("u-manager").value.trim()     || null,
    project:     document.getElementById("u-project").value.trim()     || null,
    application: document.getElementById("u-application").value.trim() || null,
    password:    document.getElementById("u-password").value,
  };
  try {
    await postJSON(`${API}/api/v1/users`, payload);
    toast("User added");
    closeModal("user-modal");
    await loadUsers();
  } catch(err) { toast(err.message, "error"); }
}

async function deleteUser(id) {
  if (!confirm("Remove this user?")) return;
  try {
    await del(`${API}/api/v1/users/${id}`);
    toast("User removed");
    closeModal("detail-modal");
    await loadUsers();
  } catch(err) { toast(err.message, "error"); }
}

// ── Review Queue ───────────────────────────────────────────────────────────
async function loadReviewQueue() {
  allPending = await fetchJSON(`${API}/api/v1/sbbs/review-queue`);
  const chip = document.getElementById("review-queue-count");
  if (chip) chip.textContent = `${allPending.length} pending`;
  updateReviewBadge();
  if (activeTab === "review") renderReviewQueue();
}

async function loadAppReviewQueue() {
  allPendingApps = await fetchJSON(`${API}/api/v1/applications/review-queue`);
  const chip = document.getElementById("app-review-queue-count");
  if (chip) chip.textContent = `${allPendingApps.length} pending`;
  updateReviewBadge();
  if (activeTab === "app-review") renderAppReviewQueue();
}

function updateReviewBadge() {
  const total = allPending.length + allPendingApps.length;
  const badge = document.getElementById("review-nav-badge");
  if (badge) { badge.textContent = total; badge.style.display = total > 0 ? "" : "none"; }
}

function renderAppReviewQueue() {
  const list = document.getElementById("app-review-queue-list");
  if (!list) return;
  if (!allPendingApps.length) { list.innerHTML = emptyState("✅", "No applications pending review."); return; }
  list.innerHTML = "";
  allPendingApps.forEach(a => {
    const div = document.createElement("div");
    div.className = "review-row";
    div.innerHTML = `
      <div class="review-row-header">
        <div class="review-row-name">${a.name}</div>
        ${a.domain ? badge("badge-domain", a.domain) : ""}
      </div>
      ${a.description ? `<div class="review-row-desc">${a.description}</div>` : ""}
      <div class="review-row-grid">
        ${detailItem("Contact",    a.contact    || "—")}
        ${detailItem("Team",       a.team       || "—")}
        ${detailItem("Department", a.department || "—")}
        ${detailItem("Project",    a.project    || "—")}
        ${detailItem("k9-aif ver", a.k9aif_version || "—")}
        ${detailItem("Submitted",  fmtDate(a.created_at))}
        ${a.url ? `<div class="review-detail-item"><span class="review-detail-key">URL</span><span class="review-detail-val"><a href="${a.url}" target="_blank" rel="noopener">${a.url}</a></span></div>` : ""}
      </div>
      ${(a.sbbs_used||[]).length ? `<div class="review-row-meta">${(a.sbbs_used).map(s => badge("badge-abb", s)).join("")}</div>` : ""}
      <div class="review-row-actions">
        <button class="btn btn-primary btn-sm" onclick="approveApp(${a.id})">Approve → POC</button>
        <button class="btn btn-danger btn-sm"  onclick="openRejectModal(${a.id}, 'app')">Reject</button>
      </div>`;
    list.appendChild(div);
  });
}

async function approveApp(id) {
  const actor = currentUser?.email || null;
  try {
    await patchJSON(`${API}/api/v1/applications/${id}/approve?actor=${encodeURIComponent(actor || "")}`);
    toast("Application approved and added to catalog");
    await Promise.all([loadApps(), loadAppReviewQueue()]);
  } catch(err) { toast(err.message, "error"); }
}

function renderReviewQueue() {
  const list = document.getElementById("review-queue-list");
  if (!list) return;
  if (!allPending.length) {
    list.innerHTML = emptyState("✅", "No SBBs pending review — queue is clear.");
    return;
  }
  list.innerHTML = "";
  allPending.forEach(s => {
    const managerLine = s.submission_note?.match(/manager=([^|]+)/)?.[1]?.trim();
    const div = document.createElement("div");
    div.className = "review-row";
    div.innerHTML = `
      <div class="review-row-header">
        <div class="review-row-name">${s.name}</div>
        ${badge("badge-kind", s.kind)}
        ${s.inspect_passed ? badge("badge-inspect","✓ inspect") : badge("badge-noinspect","✗ inspect")}
      </div>
      <div class="review-row-meta">
        ${(s.abb_names||[]).map(a => badge("badge-abb", a)).join("")}
        ${s.domain ? badge("badge-domain", s.domain) : ""}
      </div>
      ${s.description ? `<div class="review-row-desc">${s.description}</div>` : ""}
      ${managerLine ? `<div class="review-manager-note">Manager approval declared: <strong>${managerLine}</strong></div>` : ""}
      <div class="review-row-grid">
        ${detailItem("Submitted by", s.published_by || "—")}
        ${detailItem("Technical Lead", s.tech_lead || "—")}
        ${detailItem("Project", s.project || "—")}
        ${detailItem("Version", s.version)}
        ${detailItem("Submitted", fmtDate(s.created_at))}
        ${s.git_ref ? `<div class="review-detail-item"><span class="review-detail-key">Source</span><span class="review-detail-val"><a href="${s.git_ref}" target="_blank" rel="noopener">${s.git_ref}</a></span></div>` : ""}
      </div>
      <div class="review-row-actions">
        <button class="btn btn-primary btn-sm" onclick="approveSBB(${s.id})">Approve → Publish</button>
        <button class="btn btn-danger btn-sm"  onclick="openRejectModal(${s.id})">Reject</button>
      </div>`;
    list.appendChild(div);
  });
}

function detailItem(key, val) {
  return `<div class="review-detail-item"><span class="review-detail-key">${key}</span><span class="review-detail-val">${val}</span></div>`;
}

async function approveSBB(id) {
  const actor = currentUser?.email || null;
  try {
    await patchJSON(`${API}/api/v1/sbbs/${id}/approve?actor=${encodeURIComponent(actor || "")}`);
    toast("SBB approved and published to catalog");
    await Promise.all([loadSBBs(), loadReviewQueue()]);
  } catch(err) { toast(err.message, "error"); }
}

function openRejectModal(id, type = "sbb") {
  pendingRejectId   = id;
  pendingRejectType = type;
  document.getElementById("reject-reason-input").value = "";
  openModal("reject-modal");
}

async function submitReject() {
  const reason = document.getElementById("reject-reason-input").value.trim();
  if (!reason) { toast("Please provide a rejection reason", "error"); return; }
  const actor  = currentUser?.email || null;
  const params = `actor=${encodeURIComponent(actor || "")}&reason=${encodeURIComponent(reason)}`;
  try {
    if (pendingRejectType === "app") {
      await patchJSON(`${API}/api/v1/applications/${pendingRejectId}/reject?${params}`);
      toast("Application rejected");
      await loadAppReviewQueue();
    } else {
      await patchJSON(`${API}/api/v1/sbbs/${pendingRejectId}/reject?${params}`);
      toast("SBB rejected");
      await loadReviewQueue();
    }
    closeModal("reject-modal");
    pendingRejectId   = null;
    pendingRejectType = null;
  } catch(err) { toast(err.message, "error"); }
}

// ── Modal helpers ──────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// ── Utility ────────────────────────────────────────────────────────────────
function badge(cls, text) { return `<span class="badge ${cls}">${text}</span>`; }
function row(key, val)    { return val ? `<div class="detail-row"><span class="detail-key">${key}</span><span class="detail-value">${val}</span></div>` : ""; }
function emptyState(icon, msg) { return `<div class="empty"><div class="empty-icon">${icon}</div><p>${msg}</p></div>`; }
function splitCSV(s)     { return s.split(",").map(t => t.trim()).filter(Boolean); }
function fmtDate(d)      { return d ? new Date(d).toLocaleString() : "—"; }

// ── Data loading ───────────────────────────────────────────────────────────
async function loadABBs()  { allABBs  = await fetchJSON(`${API}/api/v1/abbs`); }
async function loadSBBs()  { allSBBs  = await fetchJSON(`${API}/api/v1/sbbs`); renderSBBGrid(); }
async function loadApps()  { allApps  = await fetchJSON(`${API}/api/v1/applications`); renderAppGrid(); }
async function loadUsers() { allUsers = await fetchJSON(`${API}/api/v1/users`); renderUserGrid(); renderCurrentUser(); }

function renderCurrentUser() {
  currentUser = allUsers.find(u => u.role === "admin") || allUsers[0] || null;
  const chip      = document.getElementById("user-chip");
  const nameEl    = document.getElementById("user-chip-name");
  const toggleBtn = document.getElementById("admin-toggle-btn");
  if (!currentUser) { chip.style.display = "none"; return; }
  nameEl.textContent = currentUser.name;
  chip.style.display = "flex";

  if (currentUser.role === "admin") {
    // click chip = open/close dropdown
    chip.onclick = (e) => {
      e.stopPropagation();
      document.getElementById("user-chip-dropdown").classList.toggle("open");
    };
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      document.getElementById("user-chip-dropdown").classList.remove("open");
      toggleAdminMode();
    };
    toggleBtn.style.display = "";
  } else {
    chip.onclick = null;
    toggleBtn.style.display = "none";
  }
  applyAdminMode();
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  initTheme();

  document.getElementById("theme-btn").onclick   = toggleTheme;
  document.getElementById("help-btn").onclick    = () => openModal("help-modal");
  document.getElementById("publish-btn").onclick = openPublishModal;
  document.getElementById("register-app-btn").onclick = () => { document.getElementById("app-form").reset(); openModal("app-modal"); };
  document.getElementById("add-user-btn").onclick     = () => { document.getElementById("user-form").reset(); openModal("user-modal"); };

  document.getElementById("publish-form").onsubmit = submitPublish;
  document.getElementById("app-form").onsubmit     = submitApp;
  document.getElementById("user-form").onsubmit    = submitUser;

  document.getElementById("search-input").oninput = e => {
    const v = e.target.value;
    activeSBBFilter.search  = v;
    activeABBFilter.search  = v;
    activeAppFilter.search  = v;
    activeUserFilter.search = v;
    render();
  };

  document.getElementById("filter-kind").onchange   = e => { activeSBBFilter.kind   = e.target.value; renderSBBGrid(); };
  document.getElementById("filter-status").onchange = e => { activeSBBFilter.status = e.target.value; renderSBBGrid(); };
  document.getElementById("filter-level").onchange  = e => { activeABBFilter.level  = e.target.value; renderABBGrid(); };
  document.getElementById("filter-app-status").onchange = e => { activeAppFilter.status  = e.target.value; renderAppGrid(); };
  document.getElementById("filter-role").onchange       = e => { activeUserFilter.role   = e.target.value; renderUserGrid(); };

  document.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  document.querySelectorAll(".modal-overlay").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); });
  });

  // Nav dropdowns: click-to-toggle (same pattern as user chip — no hover gap)
  document.querySelectorAll(".nav-item").forEach(item => {
    const dd = item.querySelector(".nav-dropdown");
    if (!dd) return;
    const btn = item.querySelector(".nav-btn");
    if (!btn) return;
    btn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".nav-item.open").forEach(i => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    };
  });

  document.addEventListener("click", () => {
    document.getElementById("user-chip-dropdown")?.classList.remove("open");
    document.querySelectorAll(".nav-item.open").forEach(i => i.classList.remove("open"));
  });

  await Promise.all([loadABBs(), loadSBBs(), loadApps(), loadUsers(), loadReviewQueue(), loadAppReviewQueue()]);
  renderABBList();
}

document.addEventListener("DOMContentLoaded", init);
