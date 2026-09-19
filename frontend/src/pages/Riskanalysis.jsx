import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, BookOpen, Lightbulb, TriangleAlert,
  FileText, Scale, FileWarning, Info, MapPin,
  CheckCircle2, Circle, ChevronRight, Flame,
  Activity, ClipboardList, X, Download,
} from "lucide-react";
import api from "../api/axios";
import highwayImg from "../assets/highway.jpg";
import "../RiskAnalysis.css";

/* ─── helpers ────────────────────────────────────────────── */
const STAGES = [
  { key: "identification", label: "Identification", desc: "Demarcation complete" },
  { key: "notification",   label: "Notification",   desc: "Sec 11 gazette published" },
  { key: "assessment",     label: "Assessment",      desc: "S4 objections received" },
  { key: "compensation",   label: "Compensation",    desc: "Sec 19 / Award flagged" },
  { key: "possession",     label: "Possession",      desc: "Joint verification dep." },
  { key: "completion",     label: "Completion",      desc: "Revenue record mutation" },
];

const STAGE_INDEX = {
  identification: 0, notification: 1, survey: 1,
  assessment: 2, declaration: 2, award: 2,
  compensation: 3, possession: 4, rehabilitation: 4, completed: 5,
};

const FACTOR_ICONS = [FileText, Scale, FileWarning, Info, Activity, ClipboardList];

function factorIcon(i) {
  const Icon = FACTOR_ICONS[i % FACTOR_ICONS.length];
  return <Icon size={15} />;
}

function fmtLabel(raw) {
  return String(raw || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function impactLabel(i) {
  if (i <= 1) return { cls: "xai-impact-high",   text: "HIGH IMPACT" };
  return         { cls: "xai-impact-medium", text: "MEDIUM IMPACT" };
}

/* ─── CSV utility ────────────────────────────────────────── */
function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape  = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines   = [headers.map(escape).join(","),
                   ...rows.map(r => headers.map(h => escape(r[h])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Build real "records" rows from project data ─────────── */
function buildRecordsForFactor(factorName, project, prediction) {
  const raw = String(factorName || "").toLowerCase();

  const baseRow = {
    project_id:   `LA-${String(project?.id ?? "").padStart(4, "0")}`,
    project_name:  project?.name ?? "—",
    district:      project?.district ?? "—",
    state:         project?.state ?? "—",
    project_type:  project?.project_type ?? "—",
    current_stage: project?.current_stage ?? "—",
    factor:        fmtLabel(factorName),
    risk_band:     prediction?.risk_band ?? project?.risk_band ?? "Unknown",
    risk_score:    prediction?.risk_score ?? "—",
    delay_probability: prediction?.delay_probability ?? "—",
    predicted_at:  prediction?.predicted_at ?? "—",
  };

  if (raw.includes("legal") || raw.includes("dispute")) {
    return Array.from({ length: project?.legal_disputes_count || 1 }, (_, i) => ({
      ...baseRow,
      record_type:   "Legal Dispute",
      case_ref:      `LD-${String(project?.id ?? 0).padStart(3, "0")}-${String(i + 1).padStart(3, "0")}`,
      field_value:   project?.legal_disputes_count ?? 0,
      field_note:    "Pending High Court / compensation-related dispute",
    }));
  }

  if (raw.includes("compensation")) {
    return [{
      ...baseRow,
      record_type:  "Compensation Disbursement",
      case_ref:     `COMP-${String(project?.id ?? 0).padStart(4, "0")}`,
      field_value:  `${project?.compensation_disbursed_pct ?? 0}%`,
      field_note:   "Percentage of compensation disbursed to affected families",
    }];
  }

  if (raw.includes("approval") || raw.includes("delay")) {
    return [{
      ...baseRow,
      record_type:  "Approval Delay",
      case_ref:     `APD-${String(project?.id ?? 0).padStart(4, "0")}`,
      field_value:  `${project?.approval_delay_days ?? 0} days`,
      field_note:   "Administrative approval pending beyond scheduled deadline",
    }];
  }

  if (raw.includes("possession")) {
    return [{
      ...baseRow,
      record_type:  "Possession Status",
      case_ref:     `POS-${String(project?.id ?? 0).padStart(4, "0")}`,
      field_value:  `${project?.possession_status_pct ?? 0}%`,
      field_note:   "Percentage of land physically handed over",
    }];
  }

  if (raw.includes("rehab")) {
    return [{
      ...baseRow,
      record_type:  "Rehabilitation Progress",
      case_ref:     `RHB-${String(project?.id ?? 0).padStart(4, "0")}`,
      field_value:  `${project?.rehabilitation_progress_pct ?? 0}%`,
      field_note:   "R&R progress for affected families",
    }];
  }

  if (raw.includes("stakeholder") || raw.includes("responsiveness")) {
    return [{
      ...baseRow,
      record_type:  "Stakeholder Responsiveness",
      case_ref:     `STK-${String(project?.id ?? 0).padStart(4, "0")}`,
      field_value:  `${project?.stakeholder_responsiveness_score ?? 0}/10`,
      field_note:   "Score reflecting engagement and grievance redressal frequency",
    }];
  }

  // Generic fallback
  return [{
    ...baseRow,
    record_type:  "Feature Record",
    case_ref:     `FTR-${String(project?.id ?? 0).padStart(4, "0")}`,
    field_value:  "—",
    field_note:   `Model-identified risk factor: ${fmtLabel(factorName)}`,
  }];
}

/* ─── Records Modal ──────────────────────────────────────── */
function RecordsModal({ factor, records, onClose }) {
  const name = fmtLabel(factor?.name || factor || "");
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", borderRadius: 10, width: "100%", maxWidth: 780,
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
      }}>
        {/* header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid #e5e9f2",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
              Records — {name}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
              {records.length} record{records.length !== 1 ? "s" : ""} found in this project
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => downloadCSV(records, `records-${name.replace(/\s+/g, "-").toLowerCase()}.csv`)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "7px 12px", borderRadius: 6, border: "1px solid #e5e9f2",
                background: "#f8fafc", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#334155",
              }}
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 6, border: "1px solid #e5e9f2",
                background: "#f8fafc", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", color: "#64748b",
              }}
            ><X size={15} /></button>
          </div>
        </div>

        {/* table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                {["Case Ref", "Record Type", "Field Value", "Risk Band", "District", "Note"].map(h => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left", fontWeight: 700,
                    fontSize: "0.68rem", letterSpacing: "0.05em", color: "#64748b",
                    borderBottom: "1px solid #e5e9f2", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "0.8rem", color: "#2563eb", fontWeight: 700 }}>{r.case_ref}</td>
                  <td style={{ padding: "10px 14px", color: "#334155", fontWeight: 600 }}>{r.record_type}</td>
                  <td style={{ padding: "10px 14px", color: "#0f172a", fontWeight: 700 }}>{r.field_value}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 3, fontSize: "0.68rem", fontWeight: 800,
                      background: r.risk_band === "High" || r.risk_band === "Critical" ? "#fee2e2"
                               : r.risk_band === "Medium" ? "#fef3c7" : "#dcfce7",
                      color: r.risk_band === "High" || r.risk_band === "Critical" ? "#dc2626"
                           : r.risk_band === "Medium" ? "#d97706" : "#16a34a",
                    }}>{r.risk_band}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{r.district}, {r.state}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b", fontSize: "0.75rem", maxWidth: 220 }}>{r.field_note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* footer */}
        <div style={{
          padding: "12px 20px", borderTop: "1px solid #e5e9f2",
          fontSize: "0.73rem", color: "#94a3b8",
        }}>
          Data sourced from live project fields · InfraSight Risk Engine
        </div>
      </div>
    </div>
  );
}

/* ─── Audit Records export ───────────────────────────────── */
function exportAuditCSV(project, xai, prediction) {
  if (!project) return;
  const rows = (xai?.features || []).map((f, i) => ({
    rank:              i + 1,
    factor:            fmtLabel(f.name),
    importance_pct:    (f.importance * 100).toFixed(2),
    direction:         f.direction || "—",
    project_id:        `LA-${String(project.id ?? "").padStart(4, "0")}`,
    project_name:      project.name,
    district:          project.district,
    state:             project.state,
    risk_band:         prediction?.risk_band ?? "—",
    risk_score:        prediction?.risk_score ?? "—",
    delay_probability: prediction?.delay_probability ?? "—",
    compensation_pct:  project.compensation_disbursed_pct,
    possession_pct:    project.possession_status_pct,
    legal_disputes:    project.legal_disputes_count,
    approval_delay:    project.approval_delay_days,
    current_stage:     project.current_stage,
    exported_at:       new Date().toISOString(),
  }));
  if (!rows.length) {
    // Export basic project data even without XAI features
    rows.push({
      project_id:      `LA-${String(project.id ?? "").padStart(4, "0")}`,
      project_name:    project.name,
      district:        project.district,
      state:           project.state,
      risk_band:       prediction?.risk_band ?? "—",
      risk_score:      prediction?.risk_score ?? "—",
      current_stage:   project.current_stage,
      exported_at:     new Date().toISOString(),
    });
  }
  downloadCSV(rows, `audit-records-${project.name?.replace(/\s+/g, "-").toLowerCase() ?? "project"}.csv`);
}

/* ─── Survey Ledger section ──────────────────────────────── */
const SURVEY_LEDGER_ID = "xai-survey-ledger-section";

/* ─── component ──────────────────────────────────────────── */
export default function RiskAnalysisXAI() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const ledgerRef    = useRef(null);

  const [project,    setProject]    = useState(null);
  const [xai,        setXai]        = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [showAll,    setShowAll]    = useState(false);
  const [modal,      setModal]      = useState(null); // {factor, records}

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get(`/projects/${id}/`),
      api.get(`/risk/xai/${id}/`),
      api.get(`/risk/history/${id}/`),
    ]).then(([projRes, xaiRes, histRes]) => {
      if (projRes.status === "fulfilled") setProject(projRes.value.data);
      if (xaiRes.status  === "fulfilled") setXai(xaiRes.value.data);
      else setError("Explainability data isn't available yet — run a Risk Assessment first.");

      if (histRes.status === "fulfilled" && histRes.value.data.length > 0) {
        const sorted = [...histRes.value.data].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setPrediction(sorted[0]);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const openRecords = (feat) => {
    const records = buildRecordsForFactor(feat.name, project, prediction);
    setModal({ factor: feat, records });
  };

  const scrollToLedger = () => {
    ledgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* derived */
  const band      = prediction?.risk_band || project?.risk_band || "Unknown";
  const score     = prediction?.risk_score ?? project?.risk_score ?? null;
  const delayProb = score != null ? Math.round(score) : null;
  const stageSlug = project?.current_stage || "compensation";
  const stageIdx  = STAGE_INDEX[stageSlug.toLowerCase()] ?? 3;
  const stageName = STAGES[stageIdx]?.label ?? "Compensation";
  const bandLower = band.toLowerCase();

  const allFeatures  = xai?.features || [];
  const visibleFeatures = showAll ? allFeatures : allFeatures.slice(0, 3);
  const topFeatures  = allFeatures.slice(0, 3);
  const moreCount    = Math.max(0, allFeatures.length - 3);

  const bottleneck   = topFeatures[0] ? fmtLabel(topFeatures[0].name) : "—";

  // Milestone slippage: derived from approval_delay_days if available
  const approvalDays = Number(project?.approval_delay_days) || 0;
  const slippageLow  = approvalDays > 0 ? approvalDays : 115;
  const slippageHigh = approvalDays > 0 ? Math.round(approvalDays * 1.22) : 141;

  // Pending families: total minus those with possession
  const totalFamilies    = Number(project?.affected_families) || 0;
  const possessionPct    = Number(project?.possession_status_pct) || 0;
  const pendingFamilies  = totalFamilies > 0
    ? Math.round(totalFamilies * (1 - possessionPct / 100))
    : 0;

  const insightText = xai?.summary
    || (topFeatures.length
      ? `The current prediction is primarily driven by ${bottleneck} and related acquisition indicators for this project.`
      : "Run a risk assessment to generate AI insights for this project.");

  if (loading) {
    return <div className="xai-page"><div className="xai-loading">Loading risk analysis…</div></div>;
  }

  return (
    <div className="xai-page">

      {/* modal */}
      {modal && (
        <RecordsModal
          factor={modal.factor}
          records={modal.records}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── top bar ── */}
      <div className="xai-topbar">
        <div className="xai-breadcrumb">
          <span className="xai-bc-muted">Land Acquisition AI</span>
          <ChevronRight size={12} className="xai-bc-sep" />
          <span className="xai-bc-current">Risk Analysis (XAI)</span>
        </div>
        <div className="xai-topbar-actions">
          <button className="xai-btn" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft size={13} /> View Project
          </button>
          {/* Audit Records: exports full XAI + project data as CSV */}
          <button
            className="xai-btn xai-btn-ghost"
            onClick={() => exportAuditCSV(project, xai, prediction)}
            title="Export full risk audit record as CSV"
          >
            <BookOpen size={13} /> Audit Records
          </button>
          <Link to={`/projects/${id}/risk-assessment`} className="xai-btn xai-btn-primary">
            <Lightbulb size={13} /> View Recommendations
          </Link>
        </div>
      </div>

      {/* ── page header ── */}
      <div className="xai-header">
        <div className="xai-header-title-row">
          <h1>Risk Analysis</h1>
          <span className="xai-pill active">● Active</span>
          <span className="xai-pill demo">DEMO / PROTOTYPE DATA</span>
        </div>
        {project && (
          <div className="xai-header-meta">
            <span>Project ID:&nbsp;<strong>LA-{new Date().getFullYear()}-{String(project.id).padStart(3, "0")}</strong></span>
            <span className="xai-meta-sep">•</span>
            <MapPin size={11} />
            <span>Location: District {project.district}, {project.state}</span>
            <span className="xai-meta-sep">•</span>
            <span>
              Target: {project.land_area_hectares ?? "—"} Ha
              {score != null && (
                <strong className={`xai-band-tag band-${bandLower}`}>
                  &nbsp;{score} Ha in {band}
                </strong>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── cadastral survey banner ── */}
      {project && (
        <div className="xai-survey-banner" style={{
          backgroundImage: `linear-gradient(90deg, rgba(11,21,38,0.92) 0%, rgba(11,21,38,0.75) 60%, rgba(11,21,38,0.55) 100%), url(${highwayImg})`,
          backgroundSize: "cover", backgroundPosition: "center 60%",
        }}>
          <div className="xai-survey-badge">GIS CADASTRAL LAYER ACTIVE</div>
          <div className="xai-survey-body">
            <div className="xai-survey-left">
              <strong>Project Area — Cadastral Survey &amp; Acquisition Corridor</strong>
              <div className="xai-survey-meta">
                <span><MapPin size={11} />{project.district}, {project.state}</span>
                <span className="xai-meta-sep">•</span>
                <span>Total Area: {project.land_area_hectares ?? "—"} Ha</span>
                <span className="xai-meta-sep">•</span>
                {project.legal_disputes_count > 0 && (
                  <span className="xai-survey-dispute">
                    ⚠ {project.legal_disputes_count} Cadastral Parcel Demarcation Dispute{project.legal_disputes_count > 1 ? "s" : ""} in Record
                  </span>
                )}
              </div>
            </div>
            {/* View Survey Ledger — scrolls to the ledger section below */}
            <button className="xai-btn xai-btn-ghost xai-btn-sm" onClick={scrollToLedger}>
              <FileText size={12} /> View Survey Ledger
            </button>
          </div>
        </div>
      )}

      {/* ── stat cards ── */}
      <div className="xai-stat-grid">
        <div className="xai-stat-card">
          <div className="xai-stat-head">
            <span className="xai-stat-label">RISK LEVEL</span>
            <TriangleAlert size={14} className={`xai-stat-icon tone-${bandLower}`} />
          </div>
          <div className="xai-stat-value-row">
            <span className={`xai-band-badge band-${bandLower}`}>{band.toUpperCase()}</span>
            {(bandLower === "high" || bandLower === "critical") && (
              <span className="xai-band-badge band-critical xai-ml4">CRITICAL</span>
            )}
          </div>
          <div className="xai-stat-note">Requires administrative escalation</div>
        </div>

        <div className="xai-stat-card">
          <div className="xai-stat-head">
            <span className="xai-stat-label">DELAY PROBABILITY</span>
            <Activity size={14} className="xai-stat-icon" />
          </div>
          <div className={`xai-stat-big tone-${bandLower}`}>{delayProb != null ? `${delayProb}%` : "—"}</div>
          {score != null && (
            <div className="xai-stat-note">
              <span className="xai-tag-up">+{Math.max(0, delayProb - 65)}% Avg. baseline</span>
              &nbsp;Milestone slippage: {slippageLow} to {slippageHigh} days
            </div>
          )}
        </div>

        <div className="xai-stat-card">
          <div className="xai-stat-head">
            <span className="xai-stat-label">CURRENT STAGE</span>
            <ClipboardList size={14} className="xai-stat-icon" />
          </div>
          <div className="xai-stat-big">{stageName}</div>
          <div className="xai-stat-note">
            RFCTLARR Sec 19 / Award &nbsp;
            <strong>{totalFamilies}</strong> total · <strong>{pendingFamilies}</strong> pending
          </div>
        </div>

        <div className="xai-stat-card">
          <div className="xai-stat-head">
            <span className="xai-stat-label">PRIMARY BOTTLENECK</span>
            <Flame size={14} className="xai-stat-icon tone-high" />
          </div>
          <div className="xai-stat-big xai-stat-big-sm">{bottleneck}</div>
          <div className="xai-stat-note">
            {project?.legal_disputes_count
              ? `${project.legal_disputes_count} active dispute${project.legal_disputes_count > 1 ? "s" : ""} on critical path`
              : "Top feature by model importance"}
          </div>
        </div>
      </div>

      {/* ── insight banner ── */}
      <div className="xai-insight-banner">
        <div className="xai-insight-icon"><Lightbulb size={15} /></div>
        <div className="xai-insight-body">
          <div className="xai-insight-label">
            KEY INSIGHT • PREDICTIVE ATTRIBUTION
            <span className="xai-insight-ts">
              Evaluated: Today, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} IST
            </span>
          </div>
          <p className="xai-insight-text">{insightText}</p>
        </div>
      </div>

      {/* ── why at risk ── */}
      <div className="xai-section-head">
        <div>
          <h2>Why is this project at risk?</h2>
          <p>Observed project indicators and administrative records supporting the delay prediction.</p>
        </div>
        <div className="xai-section-tag">
          Tree SHAP Factor Decomposition • Total Cumulative Risk ~{delayProb ?? 0}%
        </div>
      </div>

      {error && <div className="xai-error-card"><Info size={14} /> {error}</div>}

      {/* ── factor cards ── */}
      {visibleFeatures.length > 0 ? (
        <>
          <div className="xai-factor-grid">
            {visibleFeatures.map((feat, i) => {
              const imp  = impactLabel(i);
              const name = fmtLabel(feat.name);
              const pct  = feat.importance
                ? `+${Math.round(feat.importance * 100)}% Impact`
                : "Significant impact";
              // Record count: derive from real project data where possible
              const recordCount = (() => {
                const raw = String(feat.name || "").toLowerCase();
                if (raw.includes("legal") || raw.includes("dispute"))
                  return project?.legal_disputes_count || 1;
                return 1; // each other factor = 1 project record
              })();

              return (
                <div key={i} className={`xai-factor-card ${
                  i === 0 ? "xai-factor-primary" : i === 1 ? "xai-factor-secondary" : "xai-factor-contrib"
                }`}>
                  <div className="xai-factor-top-row">
                    <span className={`xai-factor-role ${i === 0 ? "role-primary" : i === 1 ? "role-secondary" : "role-contrib"}`}>
                      {i === 0 ? "PRIMARY DRIVER" : i === 1 ? "SECONDARY DRIVER" : "CONTRIBUTING FACTOR"}
                    </span>
                    <span className={`xai-impact-tag ${imp.cls}`}>{imp.text}</span>
                  </div>

                  <div className="xai-factor-title">{factorIcon(i)}<strong>{name}</strong></div>

                  <div className="xai-influence-row">
                    <span className="xai-influence-label">Model Influence (SHAP)</span>
                    <span className="xai-influence-pct">{pct}</span>
                  </div>
                  <div className="xai-influence-bar">
                    <span
                      className={`xai-influence-fill ${i === 0 ? "fill-red" : i === 1 ? "fill-orange" : "fill-blue"}`}
                      style={{ width: `${Math.min(100, Math.round((feat.importance || 0.1) * 100 * 5))}%` }}
                    />
                  </div>

                  <div className="xai-evidence-block">
                    <div className="xai-evidence-label">SUPPORTING PROJECT EVIDENCE</div>
                    <ul className="xai-evidence-list">
                      <li>Ranked #{i + 1} driver by SHAP feature importance decomposition.</li>
                      <li>
                        {name} current value:&nbsp;
                        <strong>
                          {(() => {
                            const raw = String(feat.name || "").toLowerCase();
                            if (raw.includes("legal") || raw.includes("dispute"))
                              return `${project?.legal_disputes_count ?? 0} disputes`;
                            if (raw.includes("compensation"))
                              return `${project?.compensation_disbursed_pct ?? 0}% disbursed`;
                            if (raw.includes("approval") || raw.includes("delay"))
                              return `${project?.approval_delay_days ?? 0} days`;
                            if (raw.includes("possession"))
                              return `${project?.possession_status_pct ?? 0}% handed over`;
                            if (raw.includes("rehab"))
                              return `${project?.rehabilitation_progress_pct ?? 0}% complete`;
                            if (raw.includes("stakeholder"))
                              return `${project?.stakeholder_responsiveness_score ?? 0}/10`;
                            return "see full record";
                          })()}
                        </strong>
                      </li>
                    </ul>
                  </div>

                  <div className="xai-factor-footer">
                    <span className="xai-footer-src">{name} • Project Record</span>
                    <span className="xai-footer-date">{new Date().toLocaleDateString()}</span>
                  </div>

                  {/* VIEW RECORDS — opens modal with real project data */}
                  <button
                    className="xai-view-records-btn"
                    onClick={() => openRecords(feat)}
                  >
                    View Records ({recordCount} case{recordCount !== 1 ? "s" : ""}) ↗
                  </button>
                </div>
              );
            })}
          </div>

          {/* SHOW MORE — toggles all features */}
          {moreCount > 0 && (
            <button
              className="xai-show-more-btn"
              onClick={() => setShowAll(prev => !prev)}
            >
              {showAll
                ? `∧ Show Less (hide ${moreCount} factor${moreCount !== 1 ? "s" : ""})`
                : `∨ View All Risk Factors (${moreCount} additional low-impact factor${moreCount !== 1 ? "s" : ""})`}
            </button>
          )}
        </>
      ) : (
        !error && (
          <div className="xai-empty-factors">
            <Info size={15} />
            Run a Risk Assessment on this project to generate AI-powered explainability data.
          </div>
        )
      )}

      {/* ── statutory progression flow ── */}
      <div className="xai-section-head xai-section-head-mt">
        <div>
          <h2>Statutory Progression Flow</h2>
          <p>RFCTLARR 2013 Milestone Progression &amp; Risk State</p>
        </div>
        <div className="xai-stage-legend">
          <span><i className="xai-dot xai-dot-done" /> Completed</span>
          <span><i className="xai-dot xai-dot-active" /> Active Bottleneck</span>
          <span><i className="xai-dot xai-dot-pending" /> Pending</span>
        </div>
      </div>

      <div className="xai-stage-pipeline">
        {STAGES.map((s, i) => {
          const isDone    = i < stageIdx;
          const isCurrent = i === stageIdx;
          const stageBand = isDone ? "low" : isCurrent ? bandLower : "pending";
          return (
            <div key={s.key} className={`xai-stage ${isDone ? "xai-stage-done" : isCurrent ? "xai-stage-active" : "xai-stage-pending"}`}>
              <div className="xai-stage-node">
                {isDone   ? <CheckCircle2 size={16} className="xai-node-done" /> :
                 isCurrent ? <span className="xai-node-active">{i + 1}</span> :
                             <Circle size={14} className="xai-node-pending" />}
              </div>
              <div className="xai-stage-num">0{i + 1}</div>
              <strong className="xai-stage-label">{s.label}</strong>
              <p className="xai-stage-desc">{s.desc}</p>
              {isCurrent && <div className="xai-stage-current-tag">Sec 19 / Award Flagged</div>}
              <span className={`xai-stage-badge sbadge-${stageBand}`}>
                {isDone ? "COMPLETED" : isCurrent ? `${stageBand.toUpperCase()} RISK` : "UPCOMING"}
              </span>
              {isCurrent && <span className="xai-stage-bottleneck-flag">BOTTLENECK</span>}
            </div>
          );
        })}
      </div>

      {/* ── SHAP bar chart ── */}
      {xai?.features?.length > 0 && (
        <div className="xai-chart-card">
          <div className="xai-section-head xai-section-head-inline">
            <div>
              <h2>Feature Importance (SHAP)</h2>
              <p>Relative contribution of each factor to the overall risk score.</p>
            </div>
          </div>
          <div className="xai-bar-list">
            {[...xai.features].sort((a, b) => b.importance - a.importance).slice(0, 8).map((f, i) => {
              const maxVal = xai.features[0]?.importance || 1;
              const pct    = Math.round((f.importance / maxVal) * 100);
              const isRisk = f.direction === "increases_risk";
              return (
                <div key={i} className="xai-bar-row">
                  <div className="xai-bar-label">{fmtLabel(f.name)}</div>
                  <div className="xai-bar-track">
                    <div className={`xai-bar-fill ${isRisk ? "fill-risk" : "fill-safe"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={`xai-bar-val ${isRisk ? "val-risk" : "val-safe"}`}>
                    {(f.importance * 100).toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
          <div className="xai-chart-legend">
            <span><i className="xai-dot" style={{ background: "#dc2626" }} /> Increases risk</span>
            <span><i className="xai-dot" style={{ background: "#16a34a" }} /> Decreases risk</span>
          </div>
        </div>
      )}

      {xai?.summary && (
        <div className="xai-summary-card">
          <h3>Plain-Language Summary</h3>
          <p>{xai.summary}</p>
        </div>
      )}

      {/* ── SURVEY LEDGER section ── */}
      <div
        id={SURVEY_LEDGER_ID}
        ref={ledgerRef}
        className="xai-chart-card"
        style={{ marginTop: 24, scrollMarginTop: 20 }}
      >
        <div className="xai-section-head xai-section-head-inline">
          <div>
            <h2>Survey Ledger — Cadastral &amp; Acquisition Record</h2>
            <p>Project-level statutory field data used in this risk analysis.</p>
          </div>
          <button
            className="xai-btn xai-btn-ghost"
            style={{ fontSize: "0.78rem" }}
            onClick={() => project && downloadCSV(
              [{
                project_id:                    `LA-${String(project.id ?? "").padStart(4, "0")}`,
                project_name:                   project.name,
                project_type:                   project.project_type,
                district:                       project.district,
                state:                          project.state,
                land_area_hectares:             project.land_area_hectares,
                affected_families:              project.affected_families,
                compensation_disbursed_pct:     project.compensation_disbursed_pct,
                possession_status_pct:          project.possession_status_pct,
                rehabilitation_progress_pct:    project.rehabilitation_progress_pct,
                legal_disputes_count:           project.legal_disputes_count,
                approval_delay_days:            project.approval_delay_days,
                stakeholder_responsiveness:     project.stakeholder_responsiveness_score,
                current_stage:                  project.current_stage,
                started_on:                     project.started_on,
                target_completion:              project.target_completion,
                risk_band:                      prediction?.risk_band ?? "—",
                risk_score:                     prediction?.risk_score ?? "—",
                exported_at:                    new Date().toISOString(),
              }],
              `survey-ledger-${project.name?.replace(/\s+/g, "-").toLowerCase() ?? "project"}.csv`
            )}
          >
            <Download size={12} /> Export Ledger
          </button>
        </div>

        {project ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", marginTop: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Field", "Value", "Notes"].map(h => (
                  <th key={h} style={{
                    padding: "9px 14px", textAlign: "left", fontSize: "0.68rem",
                    fontWeight: 700, letterSpacing: "0.05em", color: "#64748b",
                    borderBottom: "1px solid #e5e9f2",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { field: "Project ID",                    value: `LA-${String(project.id ?? "").padStart(4, "0")}`,     note: "System-assigned identifier" },
                { field: "Name",                           value: project.name,                                          note: "" },
                { field: "Type",                           value: project.project_type,                                  note: "" },
                { field: "District / State",               value: `${project.district}, ${project.state}`,               note: "" },
                { field: "Total Land Area",                value: `${project.land_area_hectares ?? "—"} Ha`,             note: "Total area to be acquired" },
                { field: "Affected Families",              value: project.affected_families,                             note: `${pendingFamilies} pending possession` },
                { field: "Compensation Disbursed",         value: `${project.compensation_disbursed_pct ?? 0}%`,         note: "Of total compensation award" },
                { field: "Possession Status",              value: `${project.possession_status_pct ?? 0}%`,              note: "Physical handover complete" },
                { field: "Rehabilitation Progress",        value: `${project.rehabilitation_progress_pct ?? 0}%`,        note: "R&R site development" },
                { field: "Legal Disputes",                 value: project.legal_disputes_count ?? 0,                     note: "Active dispute cases on record" },
                { field: "Approval Delay",                 value: `${project.approval_delay_days ?? 0} days`,            note: "Administrative approval overrun" },
                { field: "Stakeholder Responsiveness",     value: `${project.stakeholder_responsiveness_score ?? 0}/10`, note: "Engagement & grievance redressal score" },
                { field: "Current Stage",                  value: stageName,                                             note: `Backend slug: ${project.current_stage}` },
                { field: "Started On",                     value: project.started_on ?? "—",                             note: "" },
                { field: "Target Completion",              value: project.target_completion ?? "—",                      note: "" },
                { field: "Latest Risk Band",               value: prediction?.risk_band ?? "No prediction yet",          note: "" },
                { field: "Latest Risk Score",              value: prediction?.risk_score != null ? `${prediction.risk_score}/100` : "—", note: "" },
              ].map(({ field, value, note }) => (
                <tr key={field} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 14px", fontWeight: 600, color: "#334155" }}>{field}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: "#0f172a" }}>{String(value ?? "—")}</td>
                  <td style={{ padding: "9px 14px", fontSize: "0.76rem", color: "#94a3b8" }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "16px 0" }}>No project data available.</p>
        )}
      </div>

    </div>
  );
}
