import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  MapPin, Clock, HandCoins, Brain, AlertTriangle,
  CheckCircle2, Circle, FileText, ArrowRight, Gavel,
  Pencil, Play, TrendingUp, Flag, Gauge, ChevronRight,
  BarChart2, Layers, Users, Scale, ShieldAlert, Activity,
  ClipboardList, CalendarCheck, BookOpen, Download, Info,
  CheckSquare, AlertCircle, Timer, Hash,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";

import api from "../api/axios";
import "../ProjectDetails.css";

/* ─── CSV download utility ──────────────────────────────── */
function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.map(esc).join(","),
    ...rows.map(r => headers.map(h => esc(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Report generators ─────────────────────────────────── */
// Each report builds a focused CSV from project + prediction data.
function buildReport(type, project, prediction, history) {
  const base = {
    project_id:    `LA-${String(project.id ?? "").padStart(4, "0")}`,
    project_name:  project.name,
    district:      project.district,
    state:         project.state,
    project_type:  project.project_type,
    current_stage: project.current_stage,
    exported_at:   new Date().toISOString(),
  };

  switch (type) {
    case "Acquisition Report":
      return [{
        ...base,
        land_area_hectares:           project.land_area_hectares,
        affected_families:            project.affected_families,
        compensation_disbursed_pct:   project.compensation_disbursed_pct,
        possession_status_pct:        project.possession_status_pct,
        rehabilitation_progress_pct:  project.rehabilitation_progress_pct,
        started_on:                   project.started_on,
        target_completion:            project.target_completion,
      }];

    case "Compensation Report":
      return [{
        ...base,
        affected_families:           project.affected_families,
        compensation_disbursed_pct:  project.compensation_disbursed_pct,
        rehabilitation_progress_pct: project.rehabilitation_progress_pct,
        stakeholder_score:           project.stakeholder_responsiveness_score,
      }];

    case "Risk Report":
      return [{
        ...base,
        risk_band:          prediction?.risk_band         ?? "—",
        risk_score:         prediction?.risk_score        ?? "—",
        delay_probability:  prediction?.delay_probability ?? "—",
        top_factor_1:       prediction?.top_factors?.[0]?.factor ?? "—",
        top_factor_2:       prediction?.top_factors?.[1]?.factor ?? "—",
        top_factor_3:       prediction?.top_factors?.[2]?.factor ?? "—",
        recommendation_1:   prediction?.recommendations?.[0]     ?? "—",
        recommendation_2:   prediction?.recommendations?.[1]     ?? "—",
        predicted_at:       prediction?.predicted_at             ?? "—",
      }];

    case "Historical Report":
      return history.length
        ? history.map((h, i) => ({
            ...base,
            run_number:  i + 1,
            risk_band:   h.risk_band,
            risk_score:  h.risk_score,
            recorded_at: h.created_at,
          }))
        : [{ ...base, note: "No prediction history recorded yet." }];

    case "Legal Disputes Report":
      return Array.from({ length: Math.max(project.legal_disputes_count || 0, 1) }, (_, i) => ({
        ...base,
        case_ref:    `LD-${String(project.id ?? 0).padStart(3, "0")}-${String(i + 1).padStart(3, "0")}`,
        legal_disputes_total: project.legal_disputes_count ?? 0,
        approval_delay_days:  project.approval_delay_days ?? 0,
        note: i < (project.legal_disputes_count || 0)
          ? "Active legal dispute recorded in system"
          : "No disputes on record",
      }));

    case "R&R Report":
      return [{
        ...base,
        affected_families:           project.affected_families,
        rehabilitation_progress_pct: project.rehabilitation_progress_pct,
        possession_status_pct:       project.possession_status_pct,
        compensation_disbursed_pct:  project.compensation_disbursed_pct,
      }];

    case "Timeline Report":
      return [{
        ...base,
        started_on:                 project.started_on,
        target_completion:          project.target_completion,
        approval_delay_days:        project.approval_delay_days,
        compensation_disbursed_pct: project.compensation_disbursed_pct,
        possession_status_pct:      project.possession_status_pct,
        current_stage:              project.current_stage,
      }];

    case "Prediction Report":
      return [{
        ...base,
        total_prediction_runs:  history.length,
        latest_risk_band:       prediction?.risk_band         ?? "—",
        latest_risk_score:      prediction?.risk_score        ?? "—",
        latest_delay_prob:      prediction?.delay_probability ?? "—",
        legal_disputes_count:   project.legal_disputes_count,
        approval_delay_days:    project.approval_delay_days,
      }];

    default:
      return [base];
  }
}

/* ─── constants ─────────────────────────────────────────── */
const RISK_COLORS = {
  Low: "risk-low", Medium: "risk-medium",
  High: "risk-high", Critical: "risk-critical",
};

const STAGES = [
  { name: "Identification", description: "Land parcels identified" },
  { name: "Notification",   description: "Affected parties notified" },
  { name: "Assessment",     description: "Land valuation completed" },
  { name: "Compensation",   description: "Compensation processing" },
  { name: "Possession",     description: "Physical possession" },
  { name: "Completion",     description: "Acquisition completed" },
];

const TABS = [
  "Overview",
  "Acquisition & Parcels",
  "Risk & Explainability",
  "Recommended Actions",
  "Historical Milestones",
  "Documents / Records",
];

/* ─── helpers ───────────────────────────────────────────── */
function getProjectProgress(project) {
  // Average the four acquisition sub-metrics for a holistic progress figure
  const comp  = Number(project.compensation_disbursed_pct)  || 0;
  const poss  = Number(project.possession_status_pct)        || 0;
  const rehab = Number(project.rehabilitation_progress_pct)  || 0;
  // Map current_stage to a rough stage-completion pct
  const stageMap = {
    notification: 5, survey: 12, declaration: 22,
    award: 35, compensation: 55, possession: 72,
    rehabilitation: 88, completed: 100,
  };
  const stagePct = stageMap[project.current_stage] ?? 0;
  return Math.round((comp + poss + rehab + stagePct) / 4);
}

function getStageIndex(stage) {
  const n = String(stage || "").toLowerCase().trim();
  if (n.includes("ident"))                        return 0;
  if (n.includes("notif") || n.includes("survey"))return 1;
  if (n.includes("assess") || n.includes("award") || n.includes("declar")) return 2;
  if (n.includes("compens"))                      return 3;
  if (n.includes("possess") || n.includes("rehab"))return 4;
  if (n.includes("complet"))                      return 5;
  return 2;
}

function getStageLabel(stage) {
  const n = String(stage || "").toLowerCase().trim();
  const map = {
    survey: "Notification", award: "Assessment",
    declaration: "Assessment", rehabilitation: "Possession",
    completed: "Completion",
  };
  return map[n] || (n.charAt(0).toUpperCase() + n.slice(1)) || "Assessment";
}

function fmtFactorName(factor) {
  if (!factor) return "Risk Factor";
  const raw = typeof factor === "string"
    ? factor
    : (factor.factor || factor.name || factor.feature || "Risk Factor");
  return String(raw).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function fmtFactorDesc(factor) {
  if (!factor) return "This factor may affect acquisition timelines.";
  if (typeof factor === "string")
    return `The model identified ${fmtFactorName(factor)} as a risk factor.`;
  return factor.description || factor.reason || factor.detail
    || `The model identified ${fmtFactorName(factor)} as a contributing factor.`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function severityOf(factor, importance, index) {
  const explicit = String(factor?.severity || factor?.level || "").toUpperCase();
  if (["LOW","MEDIUM","HIGH","CRITICAL"].includes(explicit)) return explicit;
  const s = Number(importance) || 0;
  if (s >= 0.5 || index === 0) return "HIGH";
  if (s >= 0.25 || index === 1) return "HIGH";
  return "MEDIUM";
}

/* ─── sub-components ────────────────────────────────────── */
function ProgressRow({ label, value, color }) {
  const safe = Math.min(Math.max(Number(value) || 0, 0), 100);
  return (
    <div className="progress-detail">
      <div className="progress-detail-header">
        <span>{label}</span>
        <strong>{safe.toFixed(0)}%</strong>
      </div>
      <div className="large-progress">
        <span style={{ width: `${safe}%`, background: color || "#2563eb" }} />
      </div>
    </div>
  );
}

function DetailMetric({ icon, label, value, unit, subtext, progress, riskClass }) {
  return (
    <div className="detail-metric">
      <div className="metric-top">
        <div className="metric-icon">{icon}</div>
        <div className="metric-text">
          <div className="metric-label">{label}</div>
          {riskClass
            ? <div className="metric-value"><span className={`metric-risk ${riskClass}`}>{value}</span></div>
            : <div className="metric-value">{value}{unit && <span className="metric-unit">{unit}</span>}</div>
          }
          <div className="metric-subtext">{subtext}</div>
        </div>
      </div>
      {progress !== undefined && (
        <div className="metric-progress">
          <span style={{ width: `${Math.min(Math.max(Number(progress)||0,0),100)}%` }} />
        </div>
      )}
    </div>
  );
}

function RiskFactorCard({ factor, index }) {
  const name       = fmtFactorName(factor);
  const desc       = fmtFactorDesc(factor);
  const importance = Number(factor?.importance ?? factor?.score ?? 0);
  const sev        = severityOf(factor, importance, index);
  const sevLower   = sev.toLowerCase();
  return (
    <div className={`risk-factor sev-${sevLower}`}>
      <div className="risk-factor-top">
        <div className="risk-factor-title">
          <span className="factor-dot" />
          <strong>{name}</strong>
        </div>
        <span className={`severity ${sevLower}`}>{sev}</span>
      </div>
      <p>{desc}</p>
      <div className="factor-footer">
        <span>Impact:</span>
        <strong>
          {importance
            ? importance > 1
              ? `+${Math.round(importance)} days`
              : `${Math.round(importance * 100)}%`
            : "Significant"}
        </strong>
      </div>
    </div>
  );
}

function ActionCard({ item, onResolve }) {
  const sevColor = {
    critical: "#b42318", high: "#c2410c", medium: "#92400e", low: "#166534",
  };
  const sevBg = {
    critical: "#fef2f2", high: "#fff7ed", medium: "#fefce8", low: "#f0fdf4",
  };
  const statusIcon = {
    pending: <Timer size={12} />, in_progress: <Activity size={12} />,
    overdue: <AlertCircle size={12} />, completed: <CheckSquare size={12} />,
    resolved: <CheckCircle2 size={12} />,
  };

  return (
    <div className="detail-card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            padding: "3px 8px", borderRadius: 3, fontSize: 9, fontWeight: 800,
            background: sevBg[item.severity] || "#f8fafc",
            color: sevColor[item.severity] || "#334155",
            border: `1px solid ${sevColor[item.severity] || "#e2e8f0"}22`,
            textTransform: "uppercase", letterSpacing: "0.4px",
          }}>{item.severity}</span>
          <span style={{ fontSize: 10, color: "#64748b" }}>{item.action_ref}</span>
          {item.category && (
            <span style={{ fontSize: 9, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 3, padding: "2px 6px", color: "#64748b" }}>
              {item.category}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>
          {statusIcon[item.status]}
          <span style={{ textTransform: "capitalize" }}>{item.status?.replace("_", " ")}</span>
        </div>
      </div>

      <h3 style={{ margin: "0 0 6px", fontSize: 13, color: "#172033", lineHeight: 1.4 }}>{item.title}</h3>

      {item.ai_attribution && (
        <div style={{
          display: "flex", gap: 7, padding: "8px 10px", marginBottom: 10,
          background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5,
          fontSize: 10, color: "#1e40af", alignItems: "flex-start",
        }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {item.ai_attribution}
        </div>
      )}

      {item.evidence_notes && (
        <p style={{ margin: "0 0 10px", fontSize: 10.5, color: "#64748b", lineHeight: 1.55 }}>{item.evidence_notes}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 10 }}>
        {item.assigned_authority && (
          <div style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 4, padding: "8px 9px" }}>
            <span style={{ display: "block", color: "#7b8798", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Assigned Authority
            </span>
            <strong style={{ display: "block", marginTop: 3, fontSize: 11, color: "#172033" }}>
              {item.assigned_authority}
            </strong>
          </div>
        )}
        {item.statutory_deadline && (
          <div style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 4, padding: "8px 9px" }}>
            <span style={{ display: "block", color: "#7b8798", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Statutory Deadline
            </span>
            <strong style={{ display: "block", marginTop: 3, fontSize: 11, color: item.status === "overdue" ? "#b42318" : "#172033" }}>
              {fmtDate(item.statutory_deadline)}
            </strong>
          </div>
        )}
      </div>

      {item.status !== "resolved" && item.status !== "completed" && (
        <button
          onClick={() => onResolve(item.id)}
          style={{
            height: 30, padding: "0 12px", border: "1px solid #bbf7d0",
            borderRadius: 4, background: "#f0fdf4", color: "#166534",
            fontSize: 10, fontWeight: 700, cursor: "pointer", display: "inline-flex",
            alignItems: "center", gap: 5,
          }}
        >
          <CheckCircle2 size={11} /> Mark Resolved
        </button>
      )}
    </div>
  );
}

/* ─── main component ─────────────────────────────────────── */
export default function ProjectDetails() {
  const { id }     = useParams();
  const navigate   = useNavigate();

  const [project,    setProject]    = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [xai,        setXai]        = useState(null);
  const [history,    setHistory]    = useState([]);
  const [actions,    setActions]    = useState([]);
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [activeTab,  setActiveTab]  = useState("Overview");
  const [tabLoading, setTabLoading] = useState(false);

  /* ── initial load ───────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setError("");

    api.get(`/projects/${id}/`)
      .then(res => {
        setProject(res.data);
        // latest_prediction is now embedded by the serializer
        if (res.data.latest_prediction) {
          setPrediction(res.data.latest_prediction);
        }
      })
      .catch(err => {
        const s = err.response?.status;
        const d = err.response?.data?.detail;
        if (s === 401) setError("Session expired — please log in again.");
        else if (s === 404) setError(`Project ${id} not found.`);
        else setError(d ? `Could not load project: ${d}` : "Could not load project.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  /* ── lazy-load data per tab ─────────────────────────────── */
  useEffect(() => {
    if (!project) return;

    if (activeTab === "Risk & Explainability" && !xai) {
      setTabLoading(true);
      api.get(`/risk/xai/${id}/`)
        .then(res => setXai(res.data))
        .catch(() => setXai({ features: [], summary: "" }))
        .finally(() => setTabLoading(false));
    }

    if (activeTab === "Historical Milestones" && history.length === 0) {
      setTabLoading(true);
      api.get(`/risk/history/${id}/`)
        .then(res => setHistory([...res.data].reverse()))
        .catch(() => setHistory([]))
        .finally(() => setTabLoading(false));
    }

    if (activeTab === "Recommended Actions" && actions.length === 0) {
      setTabLoading(true);
      api.get(`/risk/action-center/project/${id}/`)
        .then(res => setActions(Array.isArray(res.data) ? res.data : []))
        .catch(() => setActions([]))
        .finally(() => setTabLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, project]);

  /* ── run prediction ─────────────────────────────────────── */
  const runPrediction = useCallback(async () => {
    setPredicting(true);
    setError("");
    try {
      const { data } = await api.post(`/risk/predict/${id}/`);
      setPrediction(data);
      // refresh actions — a new AI action may have been created
      const actRes = await api.get(`/risk/action-center/project/${id}/`);
      setActions(Array.isArray(actRes.data) ? actRes.data : []);
      // append to history chart
      setHistory(prev => [...prev, {
        created_at: new Date().toISOString(),
        risk_score: data.risk_score ?? 0,
        risk_band:  data.risk_band,
      }]);
      // reset XAI so it re-fetches fresh data next time user visits that tab
      setXai(null);
    } catch (err) {
      const s = err.response?.status;
      const d = err.response?.data?.detail || err.response?.data?.error || "";
      if (s === 404)    setError(`Prediction failed — project ${id} not found.`);
      else if (d)       setError(`Prediction failed — ${d}`);
      else              setError("Prediction failed — has the model been trained yet?");
    } finally {
      setPredicting(false);
    }
  }, [id]);

  /* ── resolve action ─────────────────────────────────────── */
  const resolveAction = useCallback(async (actionId) => {
    try {
      await api.post(`/risk/action-center/${actionId}/resolve/`);
      setActions(prev => prev.map(a =>
        a.id === actionId ? { ...a, status: "resolved" } : a
      ));
    } catch {
      setError("Could not resolve action item.");
    }
  }, []);

  /* ── loading / error states ─────────────────────────────── */
  if (loading) {
    return (
      <div className="project-detail-page">
        <div className="projects-loading">Loading project…</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-detail-page">
        <div className="projects-error">{error || "Project not found."}</div>
      </div>
    );
  }

  /* ── derived values ─────────────────────────────────────── */
  const riskBand   = prediction?.risk_band || "Unknown";
  const riskScore  = prediction?.risk_score ?? null;
  const delayProb  = prediction?.delay_probability ?? null;
  const riskClass  = RISK_COLORS[riskBand] || "risk-neutral";

  const compensation  = Number(project.compensation_disbursed_pct)  || 0;
  const possession    = Number(project.possession_status_pct)        || 0;
  const rehabilitation= Number(project.rehabilitation_progress_pct)  || 0;
  const progress      = getProjectProgress(project);
  const currentStage  = project.current_stage || "compensation";
  const stageLabel    = getStageLabel(currentStage);
  const stageIndex    = getStageIndex(currentStage);
  const projectStatus = project.current_stage === "completed" ? "Completed" : "Active";

  const acquiredHa = (() => {
    const total = Number(project.land_area_hectares) || 0;
    return total ? (total * progress / 100).toFixed(2) : null;
  })();

  const delayPct = delayProb !== null
    ? Math.round(Number(delayProb) > 1 ? Number(delayProb) : Number(delayProb) * 100)
    : null;

  const scoreDisplay = riskScore !== null
    ? Number(riskScore) <= 1 && Number(riskScore) > 0
      ? Math.round(Number(riskScore) * 100)
      : Number(riskScore).toFixed(0)
    : null;

  const topFactors      = prediction?.top_factors    || [];
  const recommendations = prediction?.recommendations || [];

  const overviewSentence = [
    project.name, "is a",
    project.project_type || "land acquisition",
    "project in",
    [project.district, project.state].filter(Boolean).join(", ") || "—",
    project.land_area_hectares ? `covering ${project.land_area_hectares} ha` : null,
    project.affected_families  ? `and affecting ${project.affected_families} families.` : null,
  ].filter(Boolean).join(" ").replace(/\s+\./g, ".");

  // chart data for history tab
  const chartData = history.map((h, i) => ({
    cycle: `Run ${i + 1}`,
    date:  fmtDate(h.created_at),
    score: h.risk_score ?? 0,
    band:  h.risk_band,
  }));

  /* ─────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────── */
  return (
    <div className="project-detail-page">

      {/* ── breadcrumb ── */}
      <div className="detail-topbar">
        <span className="breadcrumb-muted">InfraSight</span>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <Link to="/projects" className="breadcrumb-link">Projects</Link>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span className="breadcrumb-current">Project Details</span>
      </div>

      {/* ── header ── */}
      <div className="detail-header">
        <div className="detail-header-left">
          <div className="detail-title-row">
            <h1>{project.name || "—"}</h1>
            <span className="active-project-badge">
              <span className="status-dot" />{projectStatus}
            </span>
          </div>
          <div className="detail-subtitle">
            <span>Project ID: LA-{String(project.id ?? "—").padStart(4, "0")}</span>
            <span className="meta-separator">•</span>
            <span><MapPin size={11} /> {project.district || "—"}, {project.state || "—"}</span>
            <span className="meta-separator">•</span>
            <span>Target: {project.land_area_hectares ?? "—"} ha</span>
          </div>
        </div>
        <div className="detail-header-actions">
          <button className="secondary-action" onClick={() => navigate(`/projects/${id}/risk-assessment`)}>
            <BarChart2 size={13} /> Risk Assessment
          </button>
          <button className="primary-action" onClick={runPrediction} disabled={predicting}>
            <Play size={13} />{predicting ? "Running…" : "Run Prediction"}
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="detail-summary-grid">
        <DetailMetric label="PROJECT PROGRESS" value={progress.toFixed(1)} unit="%" subtext={acquiredHa ? `${acquiredHa} ha acquired` : "Area data unavailable"} progress={progress} icon={<TrendingUp size={17} />} />
        <DetailMetric label="RISK LEVEL"        value={riskBand.toUpperCase()} subtext={scoreDisplay !== null ? `Risk score: ${scoreDisplay}` : "Run prediction"} riskClass={riskClass} icon={<Gauge size={17} />} />
        <DetailMetric label="DELAY PROBABILITY" value={delayPct !== null ? delayPct : "—"} unit={delayPct !== null ? "%" : ""} subtext="Predicted acquisition delay" icon={<Clock size={17} />} />
        <DetailMetric label="CURRENT STAGE"     value={stageLabel} subtext="Land acquisition process" icon={<Flag size={17} />} />
      </div>

      {/* ── error ── */}
      {error && (
        <div className="detail-error">
          <AlertTriangle size={17} />{error}
        </div>
      )}

      {/* ── tab strip ── */}
      <div className="detail-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? "detail-tab active" : "detail-tab"}
            onClick={() => setActiveTab(tab)}
          >{tab}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1 — OVERVIEW
      ══════════════════════════════════════════════════════ */}
      {activeTab === "Overview" && (
        <>
          {/* overview banner */}
          <div className="project-overview-banner">
            <div className="overview-banner-icon"><Brain size={17} /></div>
            <div>
              <strong>Project Overview: </strong>
              <span>
                {overviewSentence}
                {riskBand !== "Unknown" && ` The current prediction indicates ${riskBand.toLowerCase()} risk.`}
              </span>
            </div>
          </div>

          {/* 3-col grid: acquisition | risk | action */}
          <div className="overview-main-grid">
            {/* acquisition status */}
            <section className="detail-card acquisition-card">
              <div className="card-heading">
                <div><h2>Acquisition Status</h2><p>Current progress of the land acquisition.</p></div>
                <span className="stage-badge">Stage {stageIndex + 1} of 6</span>
              </div>
              <ProgressRow label="Land Acquisition"      value={progress}       />
              <ProgressRow label="Compensation Disbursed" value={compensation}  color="#16a34a" />
              <ProgressRow label="Possession Status"      value={possession}    color="#d97706" />
              <ProgressRow label="Rehabilitation Progress" value={rehabilitation} color="#7c3aed" />
              <div className="acquisition-details">
                <div><span>Current Stage</span><strong>{stageLabel}</strong></div>
                <div><span>Affected Families</span><strong>{project.affected_families ?? "—"}</strong></div>
                <div><span>Legal Disputes</span><strong>{project.legal_disputes_count ?? "—"}</strong></div>
              </div>
              <Link to={`/projects/${id}/risk-assessment`} className="detail-link">
                Detailed parcel breakdown <ArrowRight size={14} />
              </Link>
            </section>

            {/* risk summary */}
            <section className="detail-card risk-summary-card">
              <div className="card-heading">
                <div><h2>Risk Summary</h2><p>AI-generated risk assessment.</p></div>
                {riskBand !== "Unknown" && (
                  <span className={`risk-small-badge ${riskClass}`}>● {riskBand.toUpperCase()} RISK</span>
                )}
              </div>
              <div className="risk-summary-content">
                <div className="risk-score-box">
                  <span>Risk Score</span>
                  <div>
                    <strong>{scoreDisplay !== null ? scoreDisplay : "—"}</strong>
                    {scoreDisplay !== null && <span className="score-out-of">/ 100</span>}
                  </div>
                </div>
                <div className="delay-box">
                  <span>Delay Probability</span>
                  <strong>{delayPct !== null ? `${delayPct}%` : "—"}</strong>
                </div>
              </div>
              <div className={topFactors.length ? "risk-factor-highlight" : "risk-factor-highlight neutral"}>
                <div className="risk-factor-header"><span>MAIN RISK FACTOR</span></div>
                <strong>{topFactors.length ? fmtFactorName(topFactors[0]) : "Risk factors unavailable"}</strong>
                <p>{topFactors.length ? fmtFactorDesc(topFactors[0]) : "Run a risk prediction to identify the major factors affecting this project."}</p>
              </div>
              <Link to={`/projects/${id}/risk-analysis`} className="full-analysis-button">
                View Full Risk Analysis <ArrowRight size={14} />
              </Link>
            </section>

            {/* top recommended action — live from actions array */}
            <section className="detail-card recommended-card">
              <div className="card-heading">
                <div><h2>Top Recommended Action</h2><p>Highest priority intervention.</p></div>
                <span className="priority-badge">PRIORITY: {actions[0]?.severity?.toUpperCase() || "HIGH"}</span>
              </div>
              <div className="recommended-icon"><Gavel size={18} /></div>
              <h3>
                {actions[0]?.title || (recommendations[0] || "Review pending compensation cases")}
              </h3>
              <p className="recommended-description">
                {actions[0]?.ai_attribution || actions[0]?.evidence_notes
                  || (recommendations[0]
                    ? "This recommendation was generated by the AI risk assessment model."
                    : "Review unresolved compensation and legal cases to reduce acquisition delays.")}
              </p>
              <div className="recommendation-meta">
                <div>
                  <span>Deadline</span>
                  <strong>{actions[0]?.statutory_deadline ? fmtDate(actions[0].statutory_deadline) : "Immediate"}</strong>
                </div>
                <div>
                  <span>Assigned Authority</span>
                  <strong>{actions[0]?.assigned_authority || "Project Officer"}</strong>
                </div>
              </div>
              <Link to="/action-center" className="full-analysis-button">
                View Action Center <ArrowRight size={14} />
              </Link>
            </section>
          </div>

          {/* timeline */}
          <section className="detail-card timeline-card">
            <div className="card-heading">
              <div><h2>Acquisition Stage Timeline</h2><p>Statutory timeline and current active transition.</p></div>
              <div className="timeline-legend">
                <span><i className="legend-dot completed" /> Completed</span>
                <span><i className="legend-dot current" /> Current Stage</span>
                <span><i className="legend-dot upcoming" /> Upcoming</span>
              </div>
            </div>
            <div className="timeline">
              <div className="timeline-line" />
              {STAGES.map((stage, index) => {
                const done    = index < stageIndex;
                const current = index === stageIndex;
                return (
                  <div key={stage.name} className={done ? "timeline-stage is-done" : current ? "timeline-stage is-current" : "timeline-stage"}>
                    <div className={done ? "timeline-node completed" : current ? "timeline-node current" : "timeline-node upcoming"}>
                      {done ? <CheckCircle2 size={16} /> : current ? <span>{index + 1}</span> : <Circle size={12} />}
                    </div>
                    <strong>{stage.name}</strong>
                    <span>{stage.description}</span>
                    <small>{done ? "Completed" : current ? "Current" : "Upcoming"}</small>
                  </div>
                );
              })}
            </div>
          </section>

          {/* key risk factors */}
          <section className="detail-card factors-card">
            <div className="card-heading">
              <div><h2>Key Risk Factors</h2><p>Top operational factors affecting scheduled handover.</p></div>
              <Link to={`/projects/${id}/risk-analysis`} className="view-analysis-link">
                View Risk Analysis <ArrowRight size={13} />
              </Link>
            </div>
            <div className="risk-factors-grid">
              {topFactors.length > 0
                ? topFactors.slice(0, 3).map((f, i) => <RiskFactorCard key={i} factor={f} index={i} />)
                : [
                    { factor: "Compensation Pending",   description: "Rate adjustment requests across affected villages.", importance: 0.68 },
                    { factor: "Legal Dispute",           description: "Pending High Court or compensation-related disputes.", importance: 0.45 },
                    { factor: "Documentation Delay",     description: "Encumbrance verification pending.", importance: 0.12 },
                  ].map((f, i) => <RiskFactorCard key={i} factor={f} index={i} />)
              }
            </div>
          </section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2 — ACQUISITION & PARCELS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "Acquisition & Parcels" && (
        <>
          <div className="detail-card" style={{ marginTop: 10 }}>
            <div className="card-heading">
              <div><h2>Acquisition Progress Detail</h2><p>Full breakdown of land acquisition sub-metrics for this project.</p></div>
              <span className="stage-badge large">Stage {stageIndex + 1} of 6</span>
            </div>

            <ProgressRow label="Overall Acquisition Progress"   value={progress}       />
            <ProgressRow label="Compensation Disbursed"          value={compensation}  color="#16a34a" />
            <ProgressRow label="Possession Status"               value={possession}    color="#d97706" />
            <ProgressRow label="Rehabilitation Progress"          value={rehabilitation} color="#7c3aed" />

            <div className="information-grid" style={{ marginTop: 16 }}>
              {[
                { icon: <Hash size={15} />,          label: "Project Type",               value: project.project_type || "—" },
                { icon: <MapPin size={15} />,         label: "Location",                   value: `${project.district}, ${project.state}` },
                { icon: <Layers size={15} />,         label: "Land Area (Ha)",             value: project.land_area_hectares ?? "—" },
                { icon: <Users size={15} />,          label: "Affected Families",          value: project.affected_families ?? "—" },
                { icon: <Scale size={15} />,          label: "Legal Disputes",             value: project.legal_disputes_count ?? "—" },
                { icon: <Timer size={15} />,          label: "Approval Delay (Days)",      value: project.approval_delay_days ?? "—" },
                { icon: <Activity size={15} />,       label: "Stakeholder Responsiveness", value: project.stakeholder_responsiveness_score != null ? `${project.stakeholder_responsiveness_score}/10` : "—" },
                { icon: <CalendarCheck size={15} />,  label: "Project Started",            value: fmtDate(project.started_on) },
                { icon: <CalendarCheck size={15} />,  label: "Target Completion",          value: fmtDate(project.target_completion) },
                { icon: <Flag size={15} />,           label: "Current Stage",              value: stageLabel },
              ].map(({ icon, label, value }) => (
                <div key={label} className="info-item">
                  <div className="info-icon">{icon}</div>
                  <div><span>{label}</span><strong>{String(value)}</strong></div>
                </div>
              ))}
            </div>
          </div>

          {/* stage pipeline */}
          <section className="detail-card timeline-card">
            <div className="card-heading">
              <div><h2>Stage Pipeline</h2><p>RFCTLARR 2013 statutory acquisition stages.</p></div>
              <div className="timeline-legend">
                <span><i className="legend-dot completed" /> Completed</span>
                <span><i className="legend-dot current" /> Current</span>
                <span><i className="legend-dot upcoming" /> Upcoming</span>
              </div>
            </div>
            <div className="timeline">
              <div className="timeline-line" />
              {STAGES.map((stage, index) => {
                const done    = index < stageIndex;
                const current = index === stageIndex;
                return (
                  <div key={stage.name} className={done ? "timeline-stage is-done" : current ? "timeline-stage is-current" : "timeline-stage"}>
                    <div className={done ? "timeline-node completed" : current ? "timeline-node current" : "timeline-node upcoming"}>
                      {done ? <CheckCircle2 size={16} /> : current ? <span>{index + 1}</span> : <Circle size={12} />}
                    </div>
                    <strong>{stage.name}</strong>
                    <span>{stage.description}</span>
                    <small>{done ? "Completed" : current ? "Current" : "Upcoming"}</small>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3 — RISK & EXPLAINABILITY
      ══════════════════════════════════════════════════════ */}
      {activeTab === "Risk & Explainability" && (
        <>
          {tabLoading && <div className="projects-loading" style={{ marginTop: 10 }}>Loading explainability data…</div>}

          {!tabLoading && (
            <>
              {/* risk snapshot cards */}
              <div className="detail-summary-grid" style={{ marginTop: 10 }}>
                <DetailMetric label="RISK BAND"          value={riskBand.toUpperCase()} riskClass={riskClass} subtext="Latest AI prediction" icon={<ShieldAlert size={17} />} />
                <DetailMetric label="RISK SCORE"         value={scoreDisplay ?? "—"}    unit={scoreDisplay ? "/100" : ""} subtext="Multi-factor severity" icon={<Gauge size={17} />} />
                <DetailMetric label="DELAY PROBABILITY"  value={delayPct ?? "—"}        unit={delayPct != null ? "%" : ""} subtext="Likelihood of overrun" icon={<Activity size={17} />} />
                <DetailMetric label="TOP FACTOR"         value={topFactors.length ? fmtFactorName(topFactors[0]).split(" ").slice(0,2).join(" ") : "—"} subtext="Primary risk driver" icon={<AlertTriangle size={17} />} />
              </div>

              {/* factor cards from prediction */}
              <section className="detail-card factors-card" style={{ marginTop: 10 }}>
                <div className="card-heading">
                  <div><h2>Key Risk Factors</h2><p>Top factors driving this project's risk score.</p></div>
                  <Link to={`/projects/${id}/risk-analysis`} className="view-analysis-link">
                    Full XAI Analysis <ArrowRight size={13} />
                  </Link>
                </div>
                {topFactors.length > 0 ? (
                  <div className="risk-factors-grid">
                    {topFactors.map((f, i) => <RiskFactorCard key={i} factor={f} index={i} />)}
                  </div>
                ) : (
                  <div className="prediction-empty">
                    <div className="prediction-empty-icon"><BarChart2 size={24} /></div>
                    <h3>No prediction data yet</h3>
                    <p>Run a risk prediction to see the model's contributing factors for this project.</p>
                    <button className="predict-button" onClick={runPrediction} disabled={predicting}>
                      <Play size={13} />{predicting ? "Running…" : "Run Prediction Now"}
                    </button>
                  </div>
                )}
              </section>

              {/* XAI feature importance bar chart */}
              {xai?.features?.length > 0 && (
                <section className="detail-card" style={{ marginTop: 10 }}>
                  <div className="card-heading">
                    <div><h2>Feature Importance (SHAP)</h2><p>Relative contribution of each feature to the risk score.</p></div>
                    <span className="stage-badge">{xai.features.length} features</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {[...xai.features].sort((a,b) => b.importance - a.importance).map((f, i) => {
                      const max = xai.features[0]?.importance || 1;
                      const pct = Math.round((f.importance / max) * 100);
                      const isRisk = f.direction === "increases_risk";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 190, fontSize: 10.5, color: "#334155", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {String(f.name || "").replace(/_/g," ").replace(/\b\w/g, c=>c.toUpperCase())}
                          </div>
                          <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: isRisk ? "#dc2626" : "#16a34a", borderRadius: 4, transition: "width .4s ease" }} />
                          </div>
                          <div style={{ width: 40, textAlign: "right", fontSize: 10, fontWeight: 700, color: isRisk ? "#dc2626" : "#16a34a" }}>
                            {(f.importance * 100).toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10.5, color: "#64748b" }}>
                    <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#dc2626", marginRight: 5, verticalAlign: "middle" }} />Increases risk</span>
                    <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#16a34a", marginRight: 5, verticalAlign: "middle" }} />Decreases risk</span>
                  </div>
                  {xai.summary && (
                    <div style={{ marginTop: 14, padding: "10px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5, fontSize: 11, color: "#1e3a5f", lineHeight: 1.6 }}>
                      <strong>Summary: </strong>{xai.summary}
                    </div>
                  )}
                </section>
              )}

              {!xai && !tabLoading && (
                <div className="prediction-empty" style={{ padding: "30px 0" }}>
                  <div className="prediction-empty-icon"><BarChart2 size={24} /></div>
                  <h3>Explainability data unavailable</h3>
                  <p>Run a risk prediction first, then visit this tab to see the model's feature importance breakdown.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4 — RECOMMENDED ACTIONS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "Recommended Actions" && (
        <div style={{ marginTop: 10 }}>
          <div className="card-heading" style={{ padding: "14px 0 12px", borderBottom: "1px solid #edf1f6", marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 750 }}>Recommended Actions</h2>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
                AI-generated and manually created action items for this project.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {actions.length > 0 && (
                <span className="stage-badge">{actions.length} action{actions.length !== 1 ? "s" : ""}</span>
              )}
              <Link to="/action-center" className="secondary-action" style={{ textDecoration: "none", height: 30, fontSize: 10.5 }}>
                <ClipboardList size={12} /> Action Center
              </Link>
            </div>
          </div>

          {tabLoading && <div className="projects-loading">Loading actions…</div>}

          {!tabLoading && actions.length === 0 && (
            <div className="prediction-empty">
              <div className="prediction-empty-icon"><ClipboardList size={24} /></div>
              <h3>No action items yet</h3>
              <p>Run a risk prediction — AI will automatically generate action items for High or Critical risk projects.</p>
              <button className="predict-button" onClick={runPrediction} disabled={predicting}>
                <Play size={13} />{predicting ? "Running…" : "Run Prediction Now"}
              </button>
            </div>
          )}

          {!tabLoading && actions.length > 0 && (
            <>
              {/* recommendations from latest prediction */}
              {recommendations.length > 0 && (
                <section className="detail-card" style={{ marginBottom: 14 }}>
                  <div className="card-heading">
                    <div><h2>Model Recommendations</h2><p>Generated by the latest risk prediction run.</p></div>
                    <span className="stage-badge">{recommendations.length} items</span>
                  </div>
                  <ul className="recommendation-list" style={{ marginTop: 10 }}>
                    {recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </section>
              )}

              {/* live action items */}
              <div>
                {actions.map(item => (
                  <ActionCard key={item.id} item={item} onResolve={resolveAction} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 5 — HISTORICAL MILESTONES
      ══════════════════════════════════════════════════════ */}
      {activeTab === "Historical Milestones" && (
        <div style={{ marginTop: 10 }}>
          {tabLoading && <div className="projects-loading">Loading history…</div>}

          {!tabLoading && (
            <>
              {/* risk trend chart */}
              <section className="detail-card">
                <div className="card-heading">
                  <div><h2>Risk Score Trend</h2><p>Prediction history across review cycles for this project.</p></div>
                  <span className="stage-badge">{chartData.length} cycle{chartData.length !== 1 ? "s" : ""}</span>
                </div>

                {chartData.length < 2 ? (
                  <div className="prediction-empty" style={{ padding: "24px 0" }}>
                    <div className="prediction-empty-icon"><Activity size={22} /></div>
                    <h3>Not enough history yet</h3>
                    <p>Run the prediction at least twice to build a trend line. Each run adds a data point.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pdGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                      <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0,100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${v}`, "Risk Score"]} labelFormatter={(l, p) => p?.[0]?.payload?.date || l} />
                      <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} fill="url(#pdGrad)" dot={{ r: 4, fill: "#2563eb" }} animationDuration={900} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </section>

              {/* prediction history table */}
              {history.length > 0 && (
                <section className="detail-card" style={{ marginTop: 10 }}>
                  <div className="card-heading">
                    <div><h2>Prediction Log</h2><p>All recorded risk assessments for this project.</p></div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["#", "Date", "Risk Band", "Risk Score"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#64748b", fontSize: 9, fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().map((h, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "9px 10px", color: "#94a3b8" }}>{history.length - i}</td>
                          <td style={{ padding: "9px 10px", color: "#334155" }}>{fmtDate(h.created_at)}</td>
                          <td style={{ padding: "9px 10px" }}>
                            <span className={`risk-badge ${RISK_COLORS[h.risk_band] || "risk-neutral"}`}>{h.risk_band || "—"}</span>
                          </td>
                          <td style={{ padding: "9px 10px", fontWeight: 700, color: "#172033" }}>
                            {h.risk_score != null ? Number(h.risk_score).toFixed(1) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* project timeline milestones */}
              <section className="detail-card timeline-card" style={{ marginTop: 10 }}>
                <div className="card-heading">
                  <div><h2>Stage Milestones</h2><p>Statutory acquisition timeline for this project.</p></div>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748b" }}>
                    {project.started_on      && <span>Started: <strong style={{ color: "#172033" }}>{fmtDate(project.started_on)}</strong></span>}
                    {project.target_completion && <><span style={{ color: "#cbd5e1" }}>•</span><span>Target: <strong style={{ color: "#172033" }}>{fmtDate(project.target_completion)}</strong></span></>}
                  </div>
                </div>
                <div className="timeline">
                  <div className="timeline-line" />
                  {STAGES.map((stage, index) => {
                    const done    = index < stageIndex;
                    const current = index === stageIndex;
                    return (
                      <div key={stage.name} className={done ? "timeline-stage is-done" : current ? "timeline-stage is-current" : "timeline-stage"}>
                        <div className={done ? "timeline-node completed" : current ? "timeline-node current" : "timeline-node upcoming"}>
                          {done ? <CheckCircle2 size={16} /> : current ? <span>{index + 1}</span> : <Circle size={12} />}
                        </div>
                        <strong>{stage.name}</strong>
                        <span>{stage.description}</span>
                        <small>{done ? "Completed" : current ? "Current" : "Upcoming"}</small>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 6 — DOCUMENTS / RECORDS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "Documents / Records" && (
        <div style={{ marginTop: 10 }}>
          <section className="detail-card">
            <div className="card-heading">
              <div><h2>Project Reports</h2><p>Institutional records and audited dossiers available on demand.</p></div>
              <span className="reports-format">PDF &amp; Spreadsheet export formats</span>
            </div>

            <div className="reports-grid" style={{ marginTop: 14 }}>
              {[
                { icon: <FileText size={17} />,      title: "Acquisition Report",    description: "Full cadastral registry, surveyed boundaries and area breakdown." },
                { icon: <HandCoins size={17} />,     title: "Compensation Report",   description: "Disbursement register, escrow balances and PAP account logs." },
                { icon: <ShieldAlert size={17} />,   title: "Risk Report",           description: "Attribution factors, probability curves and critical parcels list." },
                { icon: <BookOpen size={17} />,      title: "Historical Report",     description: "Gazette notifications, committee resolutions and audit history." },
                { icon: <Scale size={17} />,         title: "Legal Disputes Report", description: `${project.legal_disputes_count || 0} dispute(s) currently recorded for this project.` },
                { icon: <Users size={17} />,         title: "R&R Report",            description: `${project.affected_families || 0} affected families — resettlement status and R&R progress.` },
                { icon: <CalendarCheck size={17} />, title: "Timeline Report",       description: `Project started ${fmtDate(project.started_on)}. Target completion: ${fmtDate(project.target_completion)}.` },
                { icon: <BarChart2 size={17} />,     title: "Prediction Report",     description: `${history.length} prediction run(s) on record. Latest band: ${riskBand}.` },
              ].map(({ icon, title, description }) => {
                const slug     = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                const filename = `${slug}-LA-${String(project.id).padStart(4, "0")}-${new Date().toISOString().slice(0, 10)}.csv`;
                return (
                  <div key={title} className="report-card">
                    <div className="report-icon">{icon}</div>
                    <div className="report-content">
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                    <button
                      type="button"
                      className="report-button"
                      onClick={() => downloadCSV(buildReport(title, project, prediction, history), filename)}
                      title={`Download ${title} as CSV`}
                    >
                      <Download size={11} /> Export <ArrowRight size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* project metadata summary */}
          <section className="detail-card" style={{ marginTop: 10 }}>
            <div className="card-heading">
              <div><h2>Project Metadata</h2><p>Full field record as stored in the system.</p></div>
            </div>
            <div className="information-grid" style={{ marginTop: 10 }}>
              {[
                { label: "Project ID",            value: `LA-${String(project.id).padStart(4,"0")}` },
                { label: "Name",                   value: project.name },
                { label: "Type",                   value: project.project_type },
                { label: "State",                  value: project.state },
                { label: "District",               value: project.district },
                { label: "Land Area (Ha)",          value: project.land_area_hectares },
                { label: "Affected Families",       value: project.affected_families },
                { label: "Legal Disputes",          value: project.legal_disputes_count },
                { label: "Approval Delay (Days)",   value: project.approval_delay_days },
                { label: "Stakeholder Score",       value: `${project.stakeholder_responsiveness_score}/10` },
                { label: "Current Stage",           value: stageLabel },
                { label: "Compensation %",          value: `${compensation}%` },
                { label: "Possession %",            value: `${possession}%` },
                { label: "Rehabilitation %",        value: `${rehabilitation}%` },
                { label: "Started On",              value: fmtDate(project.started_on) },
                { label: "Target Completion",       value: fmtDate(project.target_completion) },
                { label: "Record Created",          value: fmtDate(project.created_at) },
                { label: "Last Updated",            value: fmtDate(project.updated_at) },
              ].map(({ label, value }) => (
                <div key={label} className="info-item">
                  <div className="info-icon"><Info size={13} /></div>
                  <div><span>{label}</span><strong>{value ?? "—"}</strong></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
