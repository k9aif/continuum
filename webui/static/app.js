/* k9x Repository — Phase 1 + 2 */

const API = "";
let activeTab = "continuum";
let currentUser = null;
let isAdminMode = false;
let allSBBs = [], allABBs = [], allApps = [], allUsers = [], allPending = [], allPendingApps = [];
let pendingRejectId = null, pendingRejectType = null;
let dashPeriod = 30, dashData = null;
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
  document.getElementById("sidebar-sbbs").style.display        = tab === "sbbs"       ? "" : "none";
  document.getElementById("sidebar-abbs").style.display        = tab === "abbs"       ? "" : "none";
  document.getElementById("sidebar-apps").style.display        = tab === "apps"       ? "" : "none";
  document.getElementById("sidebar-users").style.display       = tab === "users"      ? "" : "none";
  document.getElementById("sidebar-review").style.display      = tab === "review"      ? "" : "none";
  document.getElementById("sidebar-app-review").style.display  = tab === "app-review"  ? "" : "none";
  document.getElementById("sidebar-user-review").style.display = tab === "user-review" ? "" : "none";
  document.getElementById("sidebar-continuum").style.display   = tab === "continuum"   ? "" : "none";
  document.getElementById("sidebar-dashboard").style.display   = tab === "dashboard"   ? "" : "none";
  document.getElementById("sidebar-abb-list").style.display    = tab === "sbbs"        ? "" : "none";
  document.getElementById("search-input").placeholder =
    tab === "sbbs"   ? "Search SBBs…"         :
    tab === "abbs"   ? "Search ABBs…"          :
    tab === "apps"   ? "Search applications…"  :
    tab === "review" ? ""                      : "Search users…";
  const catalogTabs = ["sbbs", "abbs"];
  document.getElementById("nav-catalog")?.classList.toggle("active", catalogTabs.includes(tab));
  document.getElementById("nav-apps")?.classList.toggle("active", tab === "apps");
  document.getElementById("nav-continuum")?.classList.toggle("active", tab === "continuum");
  document.getElementById("nav-review")?.classList.toggle("active", ["review","app-review","user-review"].includes(tab));
  document.getElementById("nav-dashboard")?.classList.toggle("active", tab === "dashboard");
  if (tab === "dashboard") loadDashboard(dashPeriod);
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
  if (!isAdminMode && ["users","projects","groups","review","app-review","user-review","dashboard"].includes(activeTab)) switchTab("sbbs");
}

function applyAdminMode() {
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = isAdminMode ? "" : "none";
  });
  const roleEl = document.getElementById("user-chip-role");
  const toggleBtn = document.getElementById("admin-toggle-btn");
  if (roleEl) {
    if (currentUser?.role === "admin") {
      roleEl.textContent = isAdminMode ? "Admin mode" : "Limited access";
      roleEl.className   = `user-chip-role ${isAdminMode ? "role-chip-admin" : "role-chip-analyst"}`;
      roleEl.style.display = "";
    } else if (currentUser) {
      roleEl.textContent = "";
      roleEl.className   = "user-chip-role";
      roleEl.style.display = "none";
      isAdminMode = false;
    } else {
      roleEl.textContent = "";
      roleEl.className   = "user-chip-role";
    }
  }
  if (toggleBtn) {
    toggleBtn.textContent = isAdminMode ? "🔒 Switch to limited access" : "🔑 Enter admin mode";
    toggleBtn.style.display = currentUser?.role === "admin" ? "" : "none";
  }
}

function render() {
  if (activeTab === "sbbs")       renderSBBGrid();
  if (activeTab === "abbs")       renderABBGrid();
  if (activeTab === "apps")       renderAppGrid();
  if (activeTab === "users")      renderUserGrid();
  if (activeTab === "review")      renderReviewQueue();
  if (activeTab === "app-review")  renderAppReviewQueue();
  if (activeTab === "user-review") renderUserReviewQueue();
  if (activeTab === "continuum")   renderContinuum();
  if (activeTab === "dashboard" && dashData) renderDashboard();
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
  document.getElementById("stat-users-dev").textContent     = allUsers.filter(u => ["lead","developer","pm"].includes(u.role)).length;
  document.getElementById("stat-users-analyst").textContent = allUsers.filter(u => ["analyst","guest"].includes(u.role)).length;

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
      ${s.promoted_by ? row("Promoted by", s.promoted_by) : ""}
      ${s.promoted_at ? row("Promoted at", fmtDate(s.promoted_at)) : ""}
      ${row("Last updated", fmtDate(s.updated_at))}
    </div>
    ${auditHtml}
    <div class="detail-actions">
      ${currentUser?.role === "admin" && s.status === "published" ? `<button class="btn btn-primary btn-sm" onclick="promoteSBB(${s.id})">Promote</button>` : ""}
      ${currentUser?.role === "admin" ? `<button class="btn btn-danger btn-sm" onclick="deleteSBB(${s.id})">Delete</button>` : ""}
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
      ${a.project_url ? `<div class="detail-row"><span class="detail-key">Project Page</span><span class="detail-value"><a href="${a.project_url}" target="_blank" rel="noopener">Open ↗</a></span></div>` : ""}
      ${a.url ? `<div class="detail-row"><span class="detail-key">App URL</span><span class="detail-value"><a href="${a.url}" target="_blank" rel="noopener">${a.url}</a></span></div>` : ""}
    </div>
    ${(a.sbbs_used || []).length ? `<div class="detail-section"><h3>SBBs Used</h3>` +
      (a.sbbs_used).map(s => `<div class="detail-row"><span class="detail-key">${s}</span>
        <span class="detail-value">${allSBBs.find(sb => sb.name === s) ? badge("badge-inspect","✓ in catalog") : badge("badge-noinspect","not in catalog")}</span>
      </div>`).join("") + `</div>` : ""}
    <div class="detail-actions">
      ${currentUser?.role === "admin" ? `<button class="btn btn-danger btn-sm" onclick="deleteApp(${a.id})">Remove</button>` : ""}
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
      ${!u.is_active
        ? `<button class="btn btn-primary btn-sm" onclick="activateUser(${u.id})">Approve</button>`
        : `<button class="btn btn-ghost btn-sm" onclick="deactivateUser(${u.id})">Deactivate</button>`}
      <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Remove</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal('detail-modal')">Close</button>
    </div>`;
  openModal("detail-modal");
}

// ── SBB publish form ───────────────────────────────────────────────────────
function openPublishModal() {
  if (!currentUser) { toast("Please sign in to publish an SBB", "error"); return; }
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
    toast("SBB submitted for review");
    closeModal("publish-modal");
    await Promise.all([loadSBBs(), loadReviewQueue()]);
  } catch(err) { toast(err.message, "error"); }
}

async function promoteSBB(id) {
  const actor = currentUser?.email || "";
  try {
    await patchJSON(`${API}/api/v1/sbbs/${id}/promote?actor=${encodeURIComponent(actor)}`);
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
    project:       document.getElementById("a-project").value.trim()     || null,
    project_url:   document.getElementById("a-project-url").value.trim() || null,
    department:    document.getElementById("a-department").value.trim()   || null,
    url:           document.getElementById("a-url").value.trim()          || null,
    team:          document.getElementById("a-team").value.trim() || null,
    contact:       document.getElementById("a-contact").value.trim() || null,
    k9aif_version: document.getElementById("a-version").value.trim() || null,
    status:        document.getElementById("a-status").value,
    tags:          splitCSV(document.getElementById("a-tags").value),
    sbbs_used:     splitCSV(document.getElementById("a-sbbs").value),
  };
  try {
    await postJSON(`${API}/api/v1/applications`, payload);
    toast("Application submitted for review");
    closeModal("app-modal");
    await Promise.all([loadApps(), loadAppReviewQueue()]);
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

async function activateUser(id) {
  try {
    await patchJSON(`${API}/api/v1/users/${id}/activate`);
    toast("User approved — they can now sign in");
    closeModal("detail-modal");
    await loadUsers();
  } catch(err) { toast(err.message, "error"); }
}

async function deactivateUser(id) {
  if (!confirm("Deactivate this user?")) return;
  try {
    await patchJSON(`${API}/api/v1/users/${id}/deactivate`);
    toast("User deactivated");
    closeModal("detail-modal");
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

// ── Dashboard ──────────────────────────────────────────────────────────────
async function loadDashboard(days) {
  days = days || dashPeriod;
  dashPeriod = days;
  try {
    dashData = await fetchJSON(`${API}/api/v1/audit/summary?days=${days}`);
    if (activeTab === "dashboard") renderDashboard();
  } catch(err) { console.error("Dashboard load error", err); }
}

function setDashPeriod(days) {
  dashPeriod = days;
  document.querySelectorAll(".period-btn").forEach(b => {
    b.classList.toggle("active", parseInt(b.dataset.days) === days);
  });
  const label = document.getElementById("dash-period-label");
  if (label) label.textContent = `last ${days} days`;
  loadDashboard(days);
}

function renderDashboard() {
  if (!dashData) return;
  const d = dashData;

  const pendingTotal = allPending.length + allPendingApps.length + allPendingUsers.length;
  document.getElementById("dash-stat-cards").innerHTML = `
    <div class="stat-card"><div class="stat-value">${allSBBs.length}</div><div class="stat-label">Total SBBs</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--success)">${allApps.length}</div><div class="stat-label">Applications</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--accent)">${allUsers.length}</div><div class="stat-label">Users</div></div>
    <div class="stat-card"><div class="stat-value" style="color:${pendingTotal > 0 ? "var(--warning)" : "var(--text-muted)"}">${pendingTotal}</div><div class="stat-label">Pending Review</div></div>
  `;

  renderActivityChart(d.daily_activity);
  renderDonutChart(d.sbb_statuses);

  const contEl = document.getElementById("dash-contributors");
  if (!d.top_contributors.length) {
    contEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:16px 0">No activity yet.</div>`;
  } else {
    const maxCnt = d.top_contributors[0].count;
    contEl.innerHTML = d.top_contributors.map((c, i) => `
      <div class="dash-contrib-row">
        <span class="dash-contrib-rank">#${i+1}</span>
        <span class="dash-contrib-name">${c.actor}</span>
        <div class="dash-contrib-bar-wrap"><div class="dash-contrib-bar" style="width:${Math.round(c.count/maxCnt*100)}%"></div></div>
        <span class="dash-contrib-count">${c.count}</span>
      </div>`).join("");
  }

  const recentEl = document.getElementById("dash-recent");
  if (!d.recent_activity.length) {
    recentEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:16px 0">No activity recorded.</div>`;
  } else {
    recentEl.innerHTML = d.recent_activity.map(e => `
      <div class="audit-row">
        <span class="audit-action audit-${e.action}">${e.action}</span>
        <span class="audit-actor">${e.entity} #${e.entity_id}${e.actor ? " · " + e.actor : ""}</span>
        <span class="audit-time">${fmtDate(e.created_at)}</span>
      </div>`).join("");
  }
}

function renderActivityChart(daily) {
  const el = document.getElementById("dash-activity-chart");
  if (!el) return;
  if (!daily.length) {
    el.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:40px 0">No activity in this period.</div>`;
    return;
  }
  const byDay = {};
  daily.forEach(d => { byDay[d.day] = (byDay[d.day] || 0) + d.count; });
  const days  = Object.keys(byDay).sort();
  const counts = days.map(d => byDay[d]);
  const maxCount = Math.max(...counts, 1);
  const W = 480, H = 130, PADL = 28, PADB = 26, PADR = 8, PADT = 8;
  const chartW = W - PADL - PADR, chartH = H - PADB - PADT;
  const slotW = chartW / days.length;
  const barW  = Math.max(3, Math.floor(slotW * 0.6));
  let bars = "", labels = "";
  days.forEach((day, i) => {
    const x = PADL + i * slotW + (slotW - barW) / 2;
    const barH = Math.max(2, (counts[i] / maxCount) * chartH);
    const y = PADT + chartH - barH;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${barH.toFixed(1)}" rx="2" fill="var(--accent)" opacity="0.82"><title>${day}: ${counts[i]} events</title></rect>`;
    if (days.length <= 14 || i % Math.ceil(days.length / 10) === 0) {
      const dt = new Date(day + "T00:00:00");
      labels += `<text x="${(x + barW/2).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${dt.getMonth()+1}/${dt.getDate()}</text>`;
    }
  });
  const gridLines = [0, 0.5, 1].map(frac => {
    const y = (PADT + chartH - frac * chartH).toFixed(1);
    const val = Math.round(frac * maxCount);
    return `<line x1="${PADL}" y1="${y}" x2="${W-PADR}" y2="${y}" stroke="var(--border)" stroke-width="1"/>
            <text x="${PADL-3}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="var(--text-muted)">${val}</text>`;
  }).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible">${gridLines}${bars}${labels}</svg>`;
}

function renderDonutChart(statuses) {
  const el = document.getElementById("dash-donut-chart");
  if (!el) return;
  const COLORS = { draft:"#94a3b8", published:"#10b981", promoted:"#8b5cf6", pending_review:"#f59e0b", rejected:"#ef4444" };
  const total = statuses.reduce((s, e) => s + e.count, 0);
  if (!total) {
    el.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:40px 0">No SBBs yet.</div>`;
    return;
  }
  const CX = 110, CY = 110, R = 90, IR = 52;
  let startAngle = -Math.PI / 2, slices = "";
  statuses.forEach(s => {
    const frac = s.count / total;
    const endAngle = startAngle + frac * 2 * Math.PI;
    if (frac < 0.001) { startAngle = endAngle; return; }
    const [x1,y1] = [CX + R*Math.cos(startAngle), CY + R*Math.sin(startAngle)];
    const [x2,y2] = [CX + R*Math.cos(endAngle),   CY + R*Math.sin(endAngle)];
    const [ix1,iy1] = [CX + IR*Math.cos(startAngle), CY + IR*Math.sin(startAngle)];
    const [ix2,iy2] = [CX + IR*Math.cos(endAngle),   CY + IR*Math.sin(endAngle)];
    const large = frac > 0.5 ? 1 : 0;
    const color = COLORS[s.status] || "#6366f1";
    slices += `<path d="M ${ix1.toFixed(2)} ${iy1.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${IR} ${IR} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z" fill="${color}"><title>${s.status}: ${s.count}</title></path>`;
    startAngle = endAngle;
  });
  const legend = statuses.map(s => {
    const color = COLORS[s.status] || "#6366f1";
    return `<div class="dash-legend-item">
      <span class="dash-legend-dot" style="background:${color}"></span>
      <span class="dash-legend-label">${s.status}</span>
      <span class="dash-legend-count">${s.count} (${Math.round(s.count/total*100)}%)</span>
    </div>`;
  }).join("");
  el.innerHTML = `<div class="dash-donut-wrap">
    <svg viewBox="0 0 ${CX*2} ${CY*2}" style="width:220px;height:220px;flex-shrink:0">
      ${slices}
      <text x="${CX}" y="${CY}" text-anchor="middle" dominant-baseline="middle" font-size="26" font-weight="700" fill="var(--text-header)">${total}</text>
      <text x="${CX}" y="${CY+22}" text-anchor="middle" font-size="12" fill="var(--text-muted)">SBBs</text>
    </svg>
    <div class="dash-legend">${legend}</div>
  </div>`;
}

// ── Enterprise Continuum ───────────────────────────────────────────────────
const EC_LEVELS = ["Foundation", "CommonSystems", "Industry", "OrgSpecific"];
const EC_META = {
  Foundation:    { label: "Foundation",     color: "#6366f1", desc: "Generic, vendor-neutral contracts applicable to all agentic systems" },
  CommonSystems: { label: "Common Systems", color: "#10b981", desc: "Cross-industry reusable patterns built on Foundation contracts" },
  Industry:      { label: "Industry",       color: "#f59e0b", desc: "Domain-specific patterns for vertical industries — Insurance, Finance, Healthcare, Defense" },
  OrgSpecific:   { label: "Org-Specific",   color: "#8b5cf6", desc: "Enterprise-customized solutions and deployed applications" },
};
const EC_TIER_PRIORITY = { OrgSpecific: 4, Industry: 3, CommonSystems: 2, Foundation: 1 };

function sbbTier(sbb) {
  const names = sbb.abb_names || [];
  if (!names.length) return sbb.domain ? "Industry" : "OrgSpecific";
  let best = "Foundation";
  names.forEach(name => {
    const abb = allABBs.find(a => a.name === name);
    const lvl = abb ? abb.level : "Foundation";
    if ((EC_TIER_PRIORITY[lvl] || 1) > (EC_TIER_PRIORITY[best] || 1)) best = lvl;
  });
  // Domain-tagged SBBs with only Foundation ABBs → Industry
  if (best === "Foundation" && sbb.domain) best = "Industry";
  return best;
}

function openABBById(id)  { const a = allABBs.find(x => x.id === id); if (a) openABBDetail(a); }
function openSBBById(id)  { const s = allSBBs.find(x => x.id === id); if (s) openSBBDetail(s); }
function openAppById(id)  { const a = allApps.find(x => x.id === id); if (a) openAppDetail(a); }

function renderContinuum() {
  const matrix = document.getElementById("ec-matrix");
  if (!matrix) return;

  // Group ABBs by level
  const abbsByLevel = {};
  EC_LEVELS.forEach(l => abbsByLevel[l] = []);
  allABBs.forEach(a => { if (abbsByLevel[a.level]) abbsByLevel[a.level].push(a); });

  // Group published/promoted SBBs by tier
  const sbbsByTier = {};
  EC_LEVELS.forEach(l => sbbsByTier[l] = []);
  allSBBs
    .filter(s => ["published", "promoted"].includes(s.status))
    .forEach(s => { const t = sbbTier(s); if (sbbsByTier[t]) sbbsByTier[t].push(s); });

  matrix.innerHTML = "";

  EC_LEVELS.forEach(level => {
    const meta   = EC_META[level];
    const abbs   = abbsByLevel[level] || [];
    const sbbs   = sbbsByTier[level]  || [];
    const apps   = level === "OrgSpecific" ? allApps.filter(a => a.status !== "archived") : [];

    const row = document.createElement("div");
    row.className = "ec-row";
    row.style.borderLeft = `4px solid ${meta.color}`;

    // Tier badge
    const tierHtml = `
      <div class="ec-tier-badge">
        <div class="ec-tier-dot" style="background:${meta.color}"></div>
        <div class="ec-tier-name" style="color:${meta.color}">${meta.label}</div>
        <div class="ec-tier-desc">${meta.desc}</div>
      </div>`;

    // ABBs
    const abbHints = {
      Industry:    "Register vertical ABBs here — eTOM, BIAN, ARTS reference models, or your firm's industry patterns.",
      OrgSpecific: "Enterprise-specific ABBs promoted from shared SBBs — your org's IP that other teams can implement.",
    };
    let abbHtml = abbs.length
      ? abbs.map(a => `
          <div class="ec-abb-card" onclick="openABBById(${a.id})">
            <div class="ec-abb-name">${a.name}</div>
            <div class="ec-abb-kind">${a.kind}</div>
            ${a.module ? `<div class="ec-abb-module">${a.module}</div>` : ""}
          </div>`).join("")
      : `<div class="ec-empty-col">
           <span class="ec-empty-hint">${abbHints[level] || "No ABBs registered"}</span>
           ${["Industry","OrgSpecific"].includes(level) ? `<button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="switchTab('abbs')">+ Register ABB</button>` : ""}
         </div>`;

    // SBBs + Apps
    let sbbHtml = "";
    if (level === "Foundation") {
      sbbHtml += `<div class="ec-foundation-banner">
        <div class="ec-foundation-icon">⬡</div>
        <div class="ec-foundation-text">All solutions across all tiers are built on Foundation ABBs</div>
        <div class="ec-foundation-sub">Every SBB below implements one or more Foundation contracts</div>
      </div>`;
    } else if (sbbs.length) {
      sbbHtml += sbbs.map(s => `
        <div class="ec-sbb-card ec-sbb-${s.status}" onclick="openSBBById(${s.id})">
          <div class="ec-sbb-name">${s.name}</div>
          <div class="ec-sbb-meta">
            ${s.kind ? badge("badge-kind", s.kind) : ""}
            ${s.status === "promoted" ? badge("badge-inspect", "promoted") : ""}
            ${s.inspect_passed ? `<span style="color:var(--success);font-size:10px">✓ inspect</span>` : ""}
          </div>
        </div>`).join("");
    }
    if (apps.length) {
      sbbHtml += apps.map(a => `
        <div class="ec-app-card" onclick="openAppById(${a.id})">
          <div class="ec-app-dot app-status-${a.status}"></div>
          <div class="ec-app-name">${a.name}</div>
          ${badge("app-badge-" + a.status, a.status)}
        </div>`).join("");
    }
    if (!sbbs.length && !apps.length) {
      const hints = {
        Foundation:    "Generic, domain-free SBBs live here — reference implementations that any team can extend. As patterns mature, they become candidates for ABB elevation.",
        CommonSystems: "Cross-industry SBBs implementing OOB k9-aif patterns — K9ValidationLoopAgent, K9PlanningLoopAgent, BaseCriticActorAgent. The k9_agents/ library lives here.",
        Industry:      "Domain-specific SBBs tagged with a vertical — insurance, finance, healthcare, defense. Publish an SBB with a domain tag to appear here.",
        OrgSpecific:   "Deployed applications and org-specific SBBs appear here. Register an application to track your k9-aif adoption.",
      };
      const action = level === "OrgSpecific"
        ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="switchTab('apps')">+ Register App</button>`
        : `<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="switchTab('sbbs')">+ Publish SBB</button>`;
      sbbHtml = `<div class="ec-empty-col"><span class="ec-empty-hint">${hints[level]}</span>${action}</div>`;
    }

    row.innerHTML = `
      ${tierHtml}
      <div class="ec-abb-col">${abbHtml}</div>
      <div class="ec-sep">
        <div class="ec-sep-arrow" style="color:${meta.color}">→</div>
        <div class="ec-sep-label">implements</div>
      </div>
      <div class="ec-sbb-col">${sbbHtml}</div>`;

    matrix.appendChild(row);
  });
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

let allPendingUsers = [];

async function loadUserReviewQueue() {
  allPendingUsers = await fetchJSON(`${API}/api/v1/users/pending`);
  const chip = document.getElementById("user-review-count");
  if (chip) chip.textContent = `${allPendingUsers.length} pending`;
  updateReviewBadge();
  if (activeTab === "user-review") renderUserReviewQueue();
}

function updateReviewBadge() {
  const total = allPending.length + allPendingApps.length + allPendingUsers.length;
  const badge = document.getElementById("review-nav-badge");
  if (badge) { badge.textContent = total; badge.style.display = total > 0 ? "" : "none"; }
}

function renderUserReviewQueue() {
  const list = document.getElementById("user-review-list");
  if (!list) return;
  if (!allPendingUsers.length) {
    list.innerHTML = emptyState("✅", "No pending registrations.");
    document.getElementById("user-review-detail").innerHTML = `<div class="review-detail-empty">Select a registration to review</div>`;
    return;
  }
  list.innerHTML = "";
  allPendingUsers.forEach(u => {
    const div = document.createElement("div");
    div.className = "review-list-row";
    div.innerHTML = `
      <div class="rlr-name">${u.name}</div>
      <div class="rlr-meta" style="font-size:11px;color:var(--text-muted)">${u.email}</div>
      <div class="rlr-date">${fmtDate(u.created_at)}</div>`;
    div.onclick = () => viewUserDetail(u, div);
    list.appendChild(div);
  });
}

function viewUserDetail(u, rowEl) {
  document.querySelectorAll(".review-list-row.active").forEach(r => r.classList.remove("active"));
  rowEl?.classList.add("active");
  const panel = document.getElementById("user-review-detail");
  panel.innerHTML = `
    <div class="rdp-header">
      <div class="rdp-name">${u.name}</div>
    </div>
    <div class="rdp-grid">
      ${detailItem("Email",      u.email)}
      ${detailItem("Department", u.department || "—")}
      ${detailItem("Team",       u.team       || "—")}
      ${detailItem("Requested",  fmtDate(u.created_at))}
    </div>
    <div class="rdp-actions">
      <button class="btn btn-primary" onclick="approveUser(${u.id})">Approve</button>
      <button class="btn btn-danger"  onclick="rejectUser(${u.id})">Reject</button>
    </div>`;
}

async function approveUser(id) {
  try {
    await patchJSON(`${API}/api/v1/users/${id}/activate`);
    toast("User approved — they can now sign in");
    document.getElementById("user-review-detail").innerHTML = `<div class="review-detail-empty">Select a registration to review</div>`;
    await loadUserReviewQueue();
    updateReviewBadge();
  } catch(err) { toast(err.message, "error"); }
}

async function rejectUser(id) {
  if (!confirm("Reject and remove this registration?")) return;
  try {
    await del(`${API}/api/v1/users/${id}`);
    toast("Registration rejected and removed");
    document.getElementById("user-review-detail").innerHTML = `<div class="review-detail-empty">Select a registration to review</div>`;
    await loadUserReviewQueue();
    updateReviewBadge();
  } catch(err) { toast(err.message, "error"); }
}

function renderAppReviewQueue() {
  const list = document.getElementById("app-review-queue-list");
  if (!list) return;
  if (!allPendingApps.length) {
    list.innerHTML = emptyState("✅", "No applications pending review.");
    document.getElementById("app-review-detail").innerHTML = `<div class="review-detail-empty">Select an application to review</div>`;
    return;
  }
  list.innerHTML = "";
  allPendingApps.forEach(a => {
    const div = document.createElement("div");
    div.className = "review-list-row";
    div.innerHTML = `
      <div class="rlr-name">${a.name}</div>
      <div class="rlr-meta">${a.domain ? badge("badge-domain", a.domain) : ""}</div>
      <div class="rlr-date">${fmtDate(a.created_at)}</div>`;
    div.onclick = () => viewAppDetail(a, div);
    list.appendChild(div);
  });
}

function viewAppDetail(a, rowEl) {
  document.querySelectorAll(".review-list-row.active").forEach(r => r.classList.remove("active"));
  rowEl?.classList.add("active");
  const panel = document.getElementById("app-review-detail");
  panel.innerHTML = `
    <div class="rdp-header">
      <div class="rdp-name">${a.name}</div>
      ${a.domain ? badge("badge-domain", a.domain) : ""}
    </div>
    ${a.description ? `<div class="rdp-desc">${a.description}</div>` : ""}
    <div class="rdp-grid">
      ${detailItem("Contact",    a.contact    || "—")}
      ${detailItem("Team",       a.team       || "—")}
      ${detailItem("Department", a.department || "—")}
      ${detailItem("Project",    a.project    || "—")}
      ${detailItem("k9-aif ver", a.k9aif_version || "—")}
      ${detailItem("Submitted",  fmtDate(a.created_at))}
      ${a.project_url ? `<div class="review-detail-item"><span class="review-detail-key">Project Page</span><span class="review-detail-val"><a href="${a.project_url}" target="_blank" rel="noopener">Open ↗</a></span></div>` : ""}
      ${a.url ? `<div class="review-detail-item"><span class="review-detail-key">App URL</span><span class="review-detail-val"><a href="${a.url}" target="_blank" rel="noopener">${a.url}</a></span></div>` : ""}
    </div>
    ${(a.sbbs_used||[]).length ? `<div class="rdp-sbbs">${a.sbbs_used.map(s => badge("badge-abb", s)).join("")}</div>` : ""}
    <div class="rdp-actions">
      <button class="btn btn-primary" onclick="approveApp(${a.id})">Approve → POC</button>
      <button class="btn btn-danger"  onclick="openRejectModal(${a.id}, 'app')">Reject</button>
    </div>`;
}

async function approveApp(id) {
  const actor = currentUser?.email || null;
  try {
    await patchJSON(`${API}/api/v1/applications/${id}/approve?actor=${encodeURIComponent(actor || "")}`);
    toast("Application approved and added to catalog");
    document.getElementById("app-review-detail").innerHTML = `<div class="review-detail-empty">Select an application to review</div>`;
    await Promise.all([loadApps(), loadAppReviewQueue()]);
    updateReviewBadge();
  } catch(err) { toast(err.message, "error"); }
}

function renderReviewQueue() {
  const list = document.getElementById("review-queue-list");
  if (!list) return;
  if (!allPending.length) {
    list.innerHTML = emptyState("✅", "No SBBs pending review — queue is clear.");
    document.getElementById("sbb-review-detail").innerHTML = `<div class="review-detail-empty">Select an SBB to review</div>`;
    return;
  }
  list.innerHTML = "";
  allPending.forEach(s => {
    const div = document.createElement("div");
    div.className = "review-list-row";
    div.innerHTML = `
      <div class="rlr-name">${s.name}</div>
      <div class="rlr-meta">${badge("badge-kind", s.kind)} ${s.inspect_passed ? badge("badge-inspect","✓") : badge("badge-noinspect","✗")}</div>
      <div class="rlr-date">${fmtDate(s.created_at)}</div>`;
    div.onclick = () => viewSBBDetail(s, div);
    list.appendChild(div);
  });
}

function viewSBBDetail(s, rowEl) {
  document.querySelectorAll(".review-list-row.active").forEach(r => r.classList.remove("active"));
  rowEl?.classList.add("active");
  const managerLine = s.submission_note?.match(/manager=([^|]+)/)?.[1]?.trim();
  const panel = document.getElementById("sbb-review-detail");
  panel.innerHTML = `
    <div class="rdp-header">
      <div class="rdp-name">${s.name}</div>
      ${badge("badge-kind", s.kind)}
      ${s.inspect_passed ? badge("badge-inspect","✓ inspect") : badge("badge-noinspect","✗ inspect")}
    </div>
    <div class="rdp-abbs">${(s.abb_names||[]).map(a => badge("badge-abb", a)).join("")} ${s.domain ? badge("badge-domain", s.domain) : ""}</div>
    ${s.description ? `<div class="rdp-desc">${s.description}</div>` : ""}
    ${managerLine ? `<div class="review-manager-note">Manager: <strong>${managerLine}</strong></div>` : ""}
    <div class="rdp-grid">
      ${detailItem("Submitted by",   s.published_by || "—")}
      ${detailItem("Technical Lead", s.tech_lead    || "—")}
      ${detailItem("Project",        s.project      || "—")}
      ${detailItem("Version",        s.version)}
      ${detailItem("Submitted",      fmtDate(s.created_at))}
      ${s.git_ref ? `<div class="review-detail-item"><span class="review-detail-key">Source</span><span class="review-detail-val"><a href="${s.git_ref}" target="_blank" rel="noopener">${s.git_ref}</a></span></div>` : ""}
    </div>
    <div class="rdp-actions">
      <button class="btn btn-primary" onclick="approveSBB(${s.id})">Approve → Publish</button>
      <button class="btn btn-danger"  onclick="openRejectModal(${s.id})">Reject</button>
    </div>`;
}

function detailItem(key, val) {
  return `<div class="review-detail-item"><span class="review-detail-key">${key}</span><span class="review-detail-val">${val}</span></div>`;
}

async function approveSBB(id) {
  const actor = currentUser?.email || null;
  try {
    await patchJSON(`${API}/api/v1/sbbs/${id}/approve?actor=${encodeURIComponent(actor || "")}`);
    toast("SBB approved and published to catalog");
    document.getElementById("sbb-review-detail").innerHTML = `<div class="review-detail-empty">Select an SBB to review</div>`;
    await Promise.all([loadSBBs(), loadReviewQueue()]);
    updateReviewBadge();
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
      document.getElementById("app-review-detail").innerHTML = `<div class="review-detail-empty">Select an application to review</div>`;
      await loadAppReviewQueue();
    } else {
      await patchJSON(`${API}/api/v1/sbbs/${pendingRejectId}/reject?${params}`);
      toast("SBB rejected");
      document.getElementById("sbb-review-detail").innerHTML = `<div class="review-detail-empty">Select an SBB to review</div>`;
      await loadReviewQueue();
    }
    updateReviewBadge();
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
async function loadUsers() { allUsers = await fetchJSON(`${API}/api/v1/users`); renderUserGrid(); }

function renderCurrentUser() {
  const chip      = document.getElementById("user-chip");
  const loginBtn  = document.getElementById("login-btn");
  const nameEl    = document.getElementById("user-chip-name");
  const toggleBtn = document.getElementById("admin-toggle-btn");
  const registerBtn = document.getElementById("register-btn");
  if (!currentUser) {
    chip.style.display = "none";
    if (loginBtn)    loginBtn.style.display    = "";
    if (registerBtn) registerBtn.style.display = "";
    document.getElementById("publish-btn")?.setAttribute("disabled", "true");
    document.getElementById("register-app-btn")?.setAttribute("disabled", "true");
    applyAdminMode();
    return;
  }
  if (loginBtn)    loginBtn.style.display    = "none";
  if (registerBtn) registerBtn.style.display = "none";
  document.getElementById("publish-btn")?.removeAttribute("disabled");
  document.getElementById("register-app-btn")?.removeAttribute("disabled");
  nameEl.textContent = currentUser.name;
  chip.style.display = "flex";

  if (currentUser.role === "admin") {
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
    chip.onclick = (e) => {
      e.stopPropagation();
      document.getElementById("user-chip-dropdown").classList.toggle("open");
    };
    toggleBtn.style.display = "none";
  }
  applyAdminMode();
}

// ── Auth ───────────────────────────────────────────────────────────────────
const SESSION_KEY = "k9x_user";

async function submitRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById("register-error");
  errEl.style.display = "none";
  const payload = {
    name:       document.getElementById("reg-name").value.trim(),
    email:      document.getElementById("reg-email").value.trim(),
    password:   document.getElementById("reg-password").value,
    department: document.getElementById("reg-department").value.trim() || null,
    team:       document.getElementById("reg-team").value || null,
  };
  try {
    await postJSON(`${API}/api/v1/auth/register`, payload);
    closeModal("register-modal");
    document.getElementById("register-form").reset();
    toast("Registration submitted — an admin will approve your account");
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "";
  }
}

async function submitLogin(e) {
  e.preventDefault();
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl    = document.getElementById("login-error");
  errEl.style.display = "none";
  try {
    const user = await postJSON(`${API}/api/v1/auth/login`, { email, password });
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    currentUser = user;
    isAdminMode = user.role === "admin";
    closeModal("login-modal");
    renderCurrentUser();
    await Promise.all([loadReviewQueue(), loadAppReviewQueue(), loadUserReviewQueue(), loadUsers()]);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "";
  }
}

// ── Profile & Change Password ──────────────────────────────────────────────

function openProfileModal() {
  if (!currentUser) return;
  document.getElementById("prof-name").value = currentUser.name || "";
  document.getElementById("prof-email").value = currentUser.email || "";
  document.getElementById("prof-phone").value = currentUser.phone || "";
  document.getElementById("prof-department").value = currentUser.department || "";
  document.getElementById("prof-team").value = currentUser.team || "";
  document.getElementById("prof-manager").value = currentUser.manager || "";
  document.getElementById("prof-error").style.display = "none";
  document.getElementById("prof-success").style.display = "none";
  document.getElementById("user-chip-dropdown")?.classList.remove("open");
  openModal("profile-modal");
}

document.getElementById("profile-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("prof-error");
  const okEl = document.getElementById("prof-success");
  errEl.style.display = "none"; okEl.style.display = "none";
  try {
    const updated = await postJSON(`${API}/api/v1/auth/update-profile`, {
      email: currentUser.email,
      name: document.getElementById("prof-name").value.trim(),
      phone: document.getElementById("prof-phone").value.trim() || null,
      department: document.getElementById("prof-department").value.trim() || null,
      team: document.getElementById("prof-team").value.trim() || null,
      manager: document.getElementById("prof-manager").value.trim() || null,
    });
    currentUser = { ...currentUser, ...updated };
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    renderCurrentUser();
    okEl.style.display = "block";
    setTimeout(() => closeModal("profile-modal"), 1200);
  } catch (err) { errEl.textContent = err.message; errEl.style.display = "block"; }
});

function openChangePasswordModal() {
  document.getElementById("cp-current").value = "";
  document.getElementById("cp-new").value = "";
  document.getElementById("cp-confirm").value = "";
  document.getElementById("cp-error").style.display = "none";
  document.getElementById("cp-success").style.display = "none";
  document.getElementById("user-chip-dropdown")?.classList.remove("open");
  openModal("change-password-modal");
}

document.getElementById("change-password-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("cp-error");
  const okEl = document.getElementById("cp-success");
  errEl.style.display = "none"; okEl.style.display = "none";
  const newPass = document.getElementById("cp-new").value;
  const confirm = document.getElementById("cp-confirm").value;
  if (newPass !== confirm) { errEl.textContent = "Passwords do not match"; errEl.style.display = "block"; return; }
  if (newPass.length < 6) { errEl.textContent = "Password must be at least 6 characters"; errEl.style.display = "block"; return; }
  try {
    await postJSON(`${API}/api/v1/auth/change-password`, {
      email: currentUser.email,
      current_password: document.getElementById("cp-current").value,
      new_password: newPass,
    });
    okEl.style.display = "block";
    setTimeout(() => closeModal("change-password-modal"), 1200);
  } catch (err) { errEl.textContent = err.message; errEl.style.display = "block"; }
});

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  isAdminMode = false;
  allPending = []; allPendingApps = []; allPendingUsers = [];
  document.getElementById("user-chip-dropdown")?.classList.remove("open");
  document.getElementById("login-email").value = "";
  document.getElementById("login-password").value = "";
  document.getElementById("login-error").style.display = "none";
  renderCurrentUser();
  applyAdminMode();
  updateReviewBadge();
  switchTab("continuum");
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  initTheme();

  // Restore session if present — catalog always loads regardless
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    currentUser = JSON.parse(saved);
    isAdminMode = currentUser.role === "admin";
  }
  document.getElementById("login-form").onsubmit    = submitLogin;
  document.getElementById("register-form").onsubmit = submitRegister;
  document.getElementById("login-btn")?.addEventListener("click",    () => { document.getElementById("login-form").reset(); document.getElementById("login-error").style.display="none"; openModal("login-modal"); });
  document.getElementById("register-btn")?.addEventListener("click", () => { document.getElementById("register-form").reset(); document.getElementById("register-error").style.display="none"; openModal("register-modal"); });

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

  renderCurrentUser();
  await Promise.all([loadABBs(), loadSBBs(), loadApps(), loadUsers(), loadReviewQueue(), loadAppReviewQueue(), loadUserReviewQueue()]);
  renderABBList();
  renderContinuum();
}

document.addEventListener("DOMContentLoaded", init);
