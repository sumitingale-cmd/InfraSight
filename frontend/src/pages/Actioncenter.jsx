import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Clock, AlertCircle, CheckCircle2, Info, FileDown,
  Plus, X, ChevronDown,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const STATUS_META = {
  pending: { label: "PENDING", className: "badge-neutral" },
  in_progress: { label: "IN PROGRESS", className: "badge-medium" },
  overdue: { label: "OVERDUE", className: "badge-high" },
  completed: { label: "COMPLETED", className: "badge-low" },
  resolved: { label: "RESOLVED", className: "badge-low" },
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];
const SEVERITY_LABEL = { critical: "Critical Interventions", high: "High Priority Actions", medium: "Medium Priority Actions", low: "Low Priority Actions" };

const EMPTY_FILTERS = { project: "all", priority: "all", status: "all", assigned: "all", factor: "all" };

const CUSTOM_ACTION_DEFAULTS = {
  title: "", category: "", severity: "high", project: "",
  assigned_authority: "", statutory_deadline: "", description: "",
};

function daysRemaining(dateStr) {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diffMs / 86400000);
}

function toCSV(items) {
  const header = ["ID", "Title", "Category", "Severity", "Status", "Assigned Authority", "Deadline", "Progress %"];
  const rows = items.map((i) => [
    i.action_ref, i.title, i.category, i.severity, i.status,
    i.assigned_authority, i.statutory_deadline || "",
    i.execution_total ? Math.round((i.execution_current / i.execution_total) * 100) : "",
  ]);
  return [header, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function ActionCenter() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedEvidence, setExpandedEvidence] = useState(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState(CUSTOM_ACTION_DEFAULTS);
  const [modalError, setModalError] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/risk/action-center/?status=all")
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // ---- Filter option lists, derived from the data itself ----
  const projectOptions = useMemo(() => [...new Set(items.map((i) => i.project_name).filter(Boolean))], [items]);
  const assignedOptions = useMemo(() => [...new Set(items.map((i) => i.assigned_authority).filter(Boolean))], [items]);
  const factorOptions = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))], [items]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (filters.project !== "all" && i.project_name !== filters.project) return false;
      if (filters.priority !== "all" && i.severity !== filters.priority) return false;
      if (filters.status !== "all" && i.status !== filters.status) return false;
      if (filters.assigned !== "all" && i.assigned_authority !== filters.assigned) return false;
      if (filters.factor !== "all" && i.category !== filters.factor) return false;
      return true;
    });
  }, [items, filters]);

  const activeFilterCount = Object.values(filters).filter((v) => v !== "all").length;

  const stats = useMemo(() => ({
    critical: items.filter((i) => i.severity === "critical" && i.status !== "resolved" && i.status !== "completed").length,
    high: items.filter((i) => i.severity === "high" && i.status !== "resolved" && i.status !== "completed").length,
    overdue: items.filter((i) => i.status === "overdue").length,
    resolved: items.filter((i) => i.status === "resolved" || i.status === "completed").length,
  }), [items]);

  const grouped = useMemo(() => {
    const g = {};
    for (const sev of SEVERITY_ORDER) {
      g[sev] = filteredItems.filter((i) => i.severity === sev && i.status !== "resolved" && i.status !== "completed");
    }
    return g;
  }, [filteredItems]);

  const resolve = async (id) => {
    await api.post(`/risk/action-center/${id}/resolve/`);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "resolved" } : i)));
  };

  const toggleEvidence = (id) => {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const csv = toCSV(filteredItems);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `action-center-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportPDF = () => {
    // Lightweight client-side "PDF": opens the browser print dialog against
    // a printable version of the current filtered list. Swap for a real
    // PDF-generation endpoint if you need pixel-perfect output.
    window.print();
    setExportOpen(false);
  };

  const submitCustomAction = async (e) => {
    e.preventDefault();
    setModalError("");
    if (!modalForm.title || !modalForm.assigned_authority) {
      setModalError("Title and assigned authority are required.");
      return;
    }
    setModalSaving(true);
    try {
      const { project, description, ...rest } = modalForm;
      const { data } = await api.post("/risk/action-center/custom/", {
        ...rest,
        ai_attribution: description,
        project: project || null,
        statutory_deadline: modalForm.statutory_deadline || null,
        is_custom: true,
        status: "pending",
      });
      setItems((prev) => [data, ...prev]);
      setModalOpen(false);
      setModalForm(CUSTOM_ACTION_DEFAULTS);
    } catch (err) {
      setModalError(err.response?.data ? Object.values(err.response.data).flat().join(" ") : "Could not create action.");
    } finally {
      setModalSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ marginBottom: 0 }}>Action Center &amp; Recommendations</h1>
            <span className="badge badge-low badge-pill-dot">Active Statutory Track</span>
          </div>
          <p>Manage AI-recommended statutory interventions, field mitigation tasks, and inter-departmental workflows.</p>
        </div>
        <div className="page-actions ac-header-actions">
          <div className="role-chip">Role: {user?.role || "Officer"} (Authorized)</div>

          <div className="export-dropdown-wrap">
            <button type="button" className="btn" onClick={() => setExportOpen((o) => !o)}>
              <FileDown size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Export Tasks (CSV / PDF)
              <ChevronDown size={13} style={{ verticalAlign: "-1px", marginLeft: 6 }} />
            </button>
            {exportOpen && (
              <div className="export-dropdown-menu">
                <button type="button" onClick={exportCSV}>Export as CSV</button>
                <button type="button" onClick={exportPDF}>Export as PDF (print)</button>
              </div>
            )}
          </div>

          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Create Custom Action
          </button>
        </div>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="ac-stat-grid">
        <StatCard label="CRITICAL ACTIONS" value={stats.critical} note="Immediate statutory escalation required" icon={<AlertTriangle size={16} />} tone="critical" />
        <StatCard label="HIGH PRIORITY" value={stats.high} note="Scheduled for current bi-weekly sprint" icon={<Clock size={16} />} tone="high" />
        <StatCard label="OVERDUE TASKS" value={stats.overdue} note="Averaging +14 days past deadline" icon={<AlertCircle size={16} />} tone="overdue" />
        <StatCard label="RESOLVED & CLOSED" value={stats.resolved} note="Averted delays across resolved items" icon={<CheckCircle2 size={16} />} tone="resolved" />
      </div>

      {/* ---------- Filter bar ---------- */}
      <div className="ac-filter-bar">
        <FilterSelect label="Project" value={filters.project} onChange={(v) => setFilters((f) => ({ ...f, project: v }))} options={projectOptions} allLabel="All Projects" />
        <FilterSelect label="Priority" value={filters.priority} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} options={["critical", "high", "medium", "low"]} allLabel="All Priorities" />
        <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={Object.keys(STATUS_META)} allLabel="All Statuses" labelMap={(v) => STATUS_META[v]?.label} />
        <FilterSelect label="Assigned" value={filters.assigned} onChange={(v) => setFilters((f) => ({ ...f, assigned: v }))} options={assignedOptions} allLabel="All Officers" />
        <FilterSelect label="Factor" value={filters.factor} onChange={(v) => setFilters((f) => ({ ...f, factor: v }))} options={factorOptions} allLabel="All Factors" />
      </div>
      <div className="ac-filter-foot">
        <span>Showing <strong>{filteredItems.length}</strong> of <strong>{items.length}</strong> Interventions</span>
        {activeFilterCount > 0 && (
          <button type="button" className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Clear Filters</button>
        )}
      </div>

      {/* ---------- Grouped sections ---------- */}
      {loading ? (
        <p style={{ color: "var(--text-muted)", marginTop: 20 }}>Loading...</p>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ marginTop: 18 }}>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>No interventions match the current filters.</p>
        </div>
      ) : (
        SEVERITY_ORDER.map((sev) => {
          const list = grouped[sev];
          if (list.length === 0) return null;
          const urgent = list.filter((i) => i.status === "overdue" || (daysRemaining(i.statutory_deadline) ?? 99) <= 3).length;
          return (
            <div key={sev} className="ac-section" style={{ marginTop: 26 }}>
              <div className="ac-section-head">
                <span className={`ac-section-title tone-${sev}`}>
                  <span className="dot" />
                  {SEVERITY_LABEL[sev].toUpperCase()} {urgent > 0 && `(${urgent} URGENT)`}
                </span>
                <span className="field-hint">Model Influence: &gt;25% Delay Contribution</span>
              </div>
              <div className="ac-card-list">
                {list.map((item) => (
                  <ActionCard
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onSelectToggle={() => setSelectedId((cur) => (cur === item.id ? null : item.id))}
                    evidenceOpen={expandedEvidence.has(item.id)}
                    onToggleEvidence={() => toggleEvidence(item.id)}
                    onResolve={() => resolve(item.id)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* ---------- Create Custom Action modal ---------- */}
      {modalOpen && (
        <div className="ac-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="ac-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="ac-modal-head">
              <h3 style={{ margin: 0 }}>Create Custom Action</h3>
              <button type="button" className="icon-btn" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitCustomAction}>
              {modalError && <p className="error">{modalError}</p>}
              <label>Title</label>
              <input style={inputStyle} value={modalForm.title} onChange={(e) => setModalForm({ ...modalForm, title: e.target.value })} required />

              <div className="form-row">
                <div>
                  <label>Category</label>
                  <input style={inputStyle} placeholder="e.g. Compensation Pending" value={modalForm.category} onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })} />
                </div>
                <div>
                  <label>Severity</label>
                  <select style={inputStyle} value={modalForm.severity} onChange={(e) => setModalForm({ ...modalForm, severity: e.target.value })}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label>Assigned Authority</label>
                  <input style={inputStyle} value={modalForm.assigned_authority} onChange={(e) => setModalForm({ ...modalForm, assigned_authority: e.target.value })} required />
                </div>
                <div>
                  <label>Statutory Deadline</label>
                  <input type="date" style={inputStyle} value={modalForm.statutory_deadline} onChange={(e) => setModalForm({ ...modalForm, statutory_deadline: e.target.value })} />
                </div>
              </div>

              <label>Description / AI Attribution notes</label>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={modalForm.description} onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })} />

              <button type="submit" className="btn btn-primary" disabled={modalSaving} style={{ marginTop: 6 }}>
                {modalSaving ? "Creating..." : "Create Action"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, note, icon, tone }) {
  return (
    <div className="card ac-stat-card">
      <div className="ac-stat-head">
        <span className={`ac-stat-label tone-${tone}`}>{label}</span>
        <span className={`ac-stat-icon tone-${tone}`}>{icon}</span>
      </div>
      <div className={`ac-stat-value tone-${tone}`}>{value}</div>
      <div className="ac-stat-note">{note}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel, labelMap }) {
  return (
    <div className="ac-filter-select">
      <span className="ac-filter-select-label">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{labelMap ? labelMap(opt) : opt}</option>
        ))}
      </select>
    </div>
  );
}

function ActionCard({ item, selected, onSelectToggle, evidenceOpen, onToggleEvidence, onResolve }) {
  const meta = STATUS_META[item.status] || STATUS_META.pending;
  const remaining = daysRemaining(item.statutory_deadline);
  const overdue = item.status === "overdue";
  const progress = item.execution_total ? Math.round((item.execution_current / item.execution_total) * 100) : 0;

  return (
    <div className={`card ac-card${selected ? " selected" : ""}`}>
      <div className="ac-card-top">
        <div className="ac-card-top-left">
          <span className={`badge badge-${item.severity}`}>{item.severity?.toUpperCase()}</span>
          <span className="ac-card-ref">#{item.action_ref}{item.category ? ` • ${item.category}` : ""}</span>
        </div>
        <span className={`badge ${meta.className}`}>{overdue && remaining !== null ? `OVERDUE (${remaining > 0 ? "+" : ""}${-remaining}d)` : meta.label}</span>
      </div>

      <h3 className="ac-card-title">{item.title}</h3>

      {item.ai_attribution && (
        <div className="ac-info-box">
          <Info size={15} className="ac-info-icon" />
          <span><strong>AI Attribution:</strong> {item.ai_attribution}</span>
        </div>
      )}

      <div className="ac-card-meta-row">
        <div>
          <div className="ac-card-meta-label">ASSIGNED AUTHORITY</div>
          <div className="ac-card-meta-value">{item.assigned_authority || "Unassigned"}</div>
        </div>
        <div>
          <div className="ac-card-meta-label">STATUTORY DEADLINE</div>
          <div className={`ac-card-meta-value${remaining !== null && remaining <= 3 ? " urgent-text" : ""}`}>
            <Clock size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            {item.statutory_deadline
              ? `${new Date(item.statutory_deadline).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}${remaining !== null ? ` (${remaining >= 0 ? `${remaining} days remaining` : `${-remaining} days overdue`})` : ""}`
              : "No deadline set"}
          </div>
        </div>
      </div>

      {item.execution_total > 0 && (
        <div className="ac-progress-block">
          <div className="ac-progress-label">
            <span>Execution Milestone: {item.execution_current} / {item.execution_total} {item.category ? "Cases Scheduled" : "Complete"}</span>
            <strong>{progress}%</strong>
          </div>
          <div className="wizard-progress-track wide">
            <span className="wizard-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {evidenceOpen && (
        <div className="ac-evidence-box">
          {item.evidence_notes ? item.evidence_notes : "No supporting evidence attached yet."}
        </div>
      )}

      <div className="ac-card-foot">
        <span className="field-hint">{selected ? "Selected for Detailed Review" : item.project ? <Link to={`/projects/${item.project}`}>View project →</Link> : ""}</span>
        <div className="ac-card-foot-actions">
          <button type="button" className="link-btn" onClick={onToggleEvidence}>
            {evidenceOpen ? "Hide Evidence" : "View Evidence"}
          </button>
          {item.status !== "resolved" && item.status !== "completed" && (
            <button type="button" className="btn" onClick={onResolve}>Mark Resolved</button>
          )}
          <button type="button" className="btn btn-primary" onClick={onSelectToggle}>
            {selected ? "Remove from Panel" : "Active in Panel →"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: "0.9rem",
  marginBottom: 14,
};