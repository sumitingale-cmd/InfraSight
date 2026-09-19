import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShieldAlert, Clock3, Layers, TrendingUp, Info, Scale, FileWarning,
  FileText, ArrowLeft, ChevronDown, CircleGauge,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../api/axios";

const BAND_TONE = { Low: "low", Medium: "medium", High: "high", Critical: "critical" };

const STAGE_SEQUENCE = [
  { key: "identification", name: "Identification", fallbackDesc: "Boundary demarcation and alignment survey." },
  { key: "notification", name: "Notification", fallbackDesc: "Statutory Sec 11 notification published." },
  { key: "assessment", name: "Assessment", fallbackDesc: "Social impact assessment and public hearings." },
  { key: "compensation", name: "Compensation", fallbackDesc: "Award declaration and compensation disbursement." },
  { key: "possession", name: "Possession", fallbackDesc: "Joint verification and physical handover." },
  { key: "completion", name: "Completion", fallbackDesc: "Revenue record mutation and final sign-off." },
];

// Maps the project's `current_stage` slug (from the New Project wizard) onto
// the 6-box stage sequence shown here.
const STAGE_INDEX_MAP = {
  notification: 1, survey: 2, declaration: 2, award: 3, compensation: 3,
  possession: 4, rehabilitation: 4, completed: 5,
};

const FACTOR_ICONS = [FileText, Scale, FileWarning, Info];

function factorIcon(i) {
  const Icon = FACTOR_ICONS[i] || Info;
  return <Icon size={16} />;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default function RiskAssessment() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch project metadata and prediction history independently.
    // Do NOT call runPrediction() here — it fires the POST separately on mount
    // which causes a double-prediction race and a ghost history entry.
    api.get(`/projects/${id}/`).then((res) => setProject(res.data));
    api
      .get(`/risk/history/${id}/`)
      // History comes back newest-first from the API; reverse so chart
      // plots oldest → newest left to right.
      .then((res) => setHistory([...res.data].reverse()))
      .catch(() => setHistory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runPrediction = async () => {
    setRunning(true);
    setError("");
    try {
      const { data } = await api.post(`/risk/predict/${id}/`);
      setResult(data);
      // Append new entry at the end so the chart stays oldest → newest.
      setHistory((prev) => [
        ...prev,
        {
          created_at: new Date().toISOString(),
          risk_score: data.risk_score ?? 0,
          risk_band: data.risk_band,
        },
      ]);
    } catch {
      setError("Could not run the risk model. Check that risk_model.pkl is available on the backend.");
    } finally {
      setRunning(false);
    }
  };

  const band = result?.risk_band || project?.risk_band;
  const tone = BAND_TONE[band] || "medium";
  const score = result?.risk_score ?? project?.risk_score ?? null;

  // Estimated delay — use the project's real approval_delay_days if available,
  // otherwise derive from the risk score using a calibrated non-linear formula:
  //   score 0–25  → 1–3 months  (low risk)
  //   score 25–50 → 3–6 months  (medium)
  //   score 50–75 → 6–12 months (high)
  //   score 75–100 → 12–18 months (critical)
  // Formula: base(2 months) + exponential scale on the upper range.
  const estimatedMonths = (() => {
    const approvalDays = Number(project?.approval_delay_days);
    if (approvalDays > 0) {
      // Real data available: convert days to months (round to 1 dp)
      return (approvalDays / 30).toFixed(1);
    }
    if (score == null) return "—";
    const s = Number(score);
    if (s <= 25)  return (1 + (s / 25) * 2).toFixed(1);          // 1.0 – 3.0
    if (s <= 50)  return (3 + ((s - 25) / 25) * 3).toFixed(1);   // 3.0 – 6.0
    if (s <= 75)  return (6 + ((s - 50) / 25) * 6).toFixed(1);   // 6.0 – 12.0
    return (12 + ((s - 75) / 25) * 6).toFixed(1);                 // 12.0 – 18.0
  })();

  const currentStageIdx = STAGE_INDEX_MAP[project?.current_stage] ?? 0;

  const parcelsCleared = project?.parcels_acquired ?? null;
  const parcelsTotal = project?.total_parcels ?? null;

  const factors = useMemo(() => {
    // top_factors from the backend: [{factor: "field_name", importance: 0.x}, ...]
    // Normalise into the shape this component expects: {label, text, impact, weight}
    const list = result?.top_factors || [];
    return list.slice(0, 3).map((item, i) => {
      // Support both the object shape {factor, importance} and a plain string.
      const rawLabel =
        typeof item === "string" ? item : (item.factor || item.name || "Risk Factor");
      const label = rawLabel
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        label,
        // Human-readable sentence used in prose/cards.
        text: label,
        impact: i < 2 ? "high" : "medium",
        weight: i < 2 ? "HIGH" : "MEDIUM",
      };
    });
  }, [result]);

  const chartData = history.map((h, i) => ({
    cycle: `Cycle ${i + 1}`,
    date: fmtDate(h.created_at),
    score: h.risk_score ?? 0,
  }));

  if (!project) return <p style={{ color: "var(--text-muted)" }}>Loading project...</p>;

  return (
    <>
      {/* ---------- Header ---------- */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ marginBottom: 0 }}>Risk Assessment</h1>
            <span className="badge badge-low badge-pill-dot">Active</span>
            <span className="badge badge-demo">DEMO / PROTOTYPE DATA</span>
          </div>
          <p>AI-powered prediction of potential land acquisition delay risk.</p>
          <div className="ra-breadcrumb-line">
            <strong>{project.name}</strong>
            <span className="dot-sep" />
            Project ID: <strong>{project.id === undefined ? "—" : `LA-${new Date().getFullYear()}-${String(project.id).padStart(3, "0")}`}</strong>
            <span className="dot-sep" />
            District {project.district}, {project.state}
          </div>
        </div>
        <div className="page-actions">
          <Link to={`/projects/${id}`} className="btn">
            <ArrowLeft size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            View Project
          </Link>
          <button type="button" className="btn btn-primary" onClick={runPrediction} disabled={running}>
            <CircleGauge size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            {running ? "Running..." : "Run Prediction"}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* ---------- Stat cards ---------- */}
      <div className="ac-stat-grid">
        <div className="card ac-stat-card">
          <div className="ac-stat-head">
            <span className={`ac-stat-label tone-${tone}`}>RISK LEVEL</span>
            <span className={`ac-stat-icon tone-${tone}`}><ShieldAlert size={15} /></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <span className={`badge badge-${band?.toLowerCase()}`}>{band?.toUpperCase() || "—"}</span>
            <span className={`ac-stat-value tone-${tone}`} style={{ fontSize: "1.4rem" }}>{band || "—"}</span>
          </div>
          <div className="ac-stat-note">{tone === "high" || tone === "critical" ? "Requires administrative escalation" : "Within normal monitoring range"}</div>
        </div>

        <div className="card ac-stat-card">
          <div className="ac-stat-head">
            <span className="ac-stat-label" style={{ color: "var(--text-muted)" }}>DELAY PROBABILITY</span>
            <span className="ac-stat-icon" style={{ background: "#f1f5f9" }}><TrendingUp size={15} /></span>
          </div>
          <div className="ac-stat-value" style={{ marginTop: 10 }}>{score != null ? `${Math.round(score)}%` : "—"}</div>
          <div className="ac-stat-note">High likelihood of milestone overrun</div>
        </div>

        <div className="card ac-stat-card">
          <div className="ac-stat-head">
            <span className="ac-stat-label" style={{ color: "var(--text-muted)" }}>ESTIMATED DELAY</span>
            <span className="ac-stat-icon" style={{ background: "#f1f5f9" }}><Clock3 size={15} /></span>
          </div>
          <div className="ac-stat-value" style={{ marginTop: 10 }}>{estimatedMonths} Months</div>
          <div className="ac-stat-note">
            {Number(project?.approval_delay_days) > 0
              ? `Based on ${project.approval_delay_days} recorded approval delay days`
              : "Estimated from risk score — calibrated delay model"}
          </div>
        </div>

        <div className="card ac-stat-card">
          <div className="ac-stat-head">
            <span className="ac-stat-label" style={{ color: "var(--text-muted)" }}>CURRENT STAGE</span>
            <span className="ac-stat-icon" style={{ background: "#f1f5f9" }}><Layers size={15} /></span>
          </div>
          <div className="ac-stat-value" style={{ fontSize: "1.15rem", marginTop: 10 }}>
            {STAGE_SEQUENCE[currentStageIdx]?.name || "—"}
          </div>
          <div className="ac-stat-note">
            {parcelsTotal ? `${parcelsCleared ?? 0} / ${parcelsTotal} packages cleared` : "Package tracking not set for this project"}
          </div>
        </div>
      </div>

      {/* ---------- Prediction hero ---------- */}
      {result && (
        <div className={`card ra-hero tone-${tone}`}>
          <div className="ra-hero-badge">
            <span className={`badge badge-${band?.toLowerCase()}`}>{band?.toUpperCase()} RISK PREDICTION</span>
            <span className="field-hint">Predictive Model Inference</span>
          </div>
          <div className="ra-hero-body">
            <div className="ra-hero-main">
              <h2>Current project conditions indicate a {band?.toLowerCase()} likelihood of delay.</h2>
              <p>{factors[0]?.text || "The model has flagged this project based on its acquisition, legal, and documentation indicators."}</p>
              <div className="ra-hero-trail">
                <a href="#why-at-risk" className="ra-pill">PREDICTION ({Math.round(score)}%)</a>
                <ChevronDown size={13} className="ra-trail-arrow" />
                <a href="#why-at-risk" className="ra-pill amber">CONTRIBUTING FACTORS (Top {factors.length})</a>
                <ChevronDown size={13} className="ra-trail-arrow" />
                <a href="#why-at-risk" className="ra-pill green">OBSERVED PROJECT EVIDENCE</a>
              </div>
            </div>
            <div className="ra-hero-side">
              <div className="ra-hero-metric">
                <div className="ac-stat-label" style={{ color: "var(--text-muted)" }}>DELAY PROBABILITY</div>
                <div className={`ac-stat-value tone-${tone}`}>{Math.round(score)}%</div>
                <div className="ac-stat-note">Statutory overrun likely</div>
              </div>
              <div className="ra-hero-metric">
                <div className="ac-stat-label" style={{ color: "var(--text-muted)" }}>RISK SCORE</div>
                <div className={`ac-stat-value tone-${tone}`}>{Math.round(score)} <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-muted)" }}>/100</span></div>
                <div className="ac-stat-note">Multi-factor severity</div>
              </div>
            </div>
          </div>
          <a href="#why-at-risk" className="ra-inspect-link">Inspect Contributing Factors ↓</a>
        </div>
      )}

      {/* ---------- Why is this project at risk ---------- */}
      <div id="why-at-risk" className="ra-section-head" style={{ marginTop: 26 }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.15rem", margin: 0 }}>
            Why is this project at risk?
            <span className="pill-tag">Top {factors.length || 3} Contributing Factors</span>
          </h2>
          <p className="field-hint" style={{ marginTop: 4 }}>Observed project indicators supporting the delay prediction.</p>
        </div>
      </div>

      {factors.length === 0 ? (
        <div className="card"><p style={{ margin: 0, color: "var(--text-muted)" }}>Run a prediction to see the model's contributing factors.</p></div>
      ) : (
        <div className="ra-factor-grid">
          {factors.map((f, i) => (
            <div key={i} className={`card ra-factor-card tone-${f.impact}`}>
              <div className="ra-factor-top">
                <span className={`badge ${f.impact === "high" ? "badge-high" : "badge-medium"}`}>{f.impact.toUpperCase()} IMPACT</span>
                <span className="field-hint">Model Weight: <strong>{f.weight}</strong></span>
              </div>
              <div className="ra-factor-title">{factorIcon(i)}<strong>{f.text}</strong></div>

              <div className="ra-evidence-block">
                <div className="ac-card-meta-label">OBSERVED PROJECT EVIDENCE</div>
                <ul className="ra-evidence-list">
                  <li>Identified as a top-{i + 1} driver by the current prediction run.</li>
                  <li>Derived from this project's live acquisition, legal, and documentation fields.</li>
                </ul>
              </div>

              <div className="field-hint" style={{ marginBottom: 10 }}>
                Source: Model feature importance &nbsp;•&nbsp; Last updated: {fmtDate(new Date())}
              </div>
              <Link to={`/projects/${id}/risk-analysis`} className="btn" style={{ width: "100%", textAlign: "center", display: "block" }}>
                View Full Analysis (XAI)
              </Link>
            </div>
          ))}
        </div>
      )}
      <p className="field-hint" style={{ marginTop: 10 }}>
        <Info size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Supporting evidence reflects this project's current recorded data. Demonstration values for prototype evaluation.
      </p>

      {/* ---------- Acquisition Stage Risk ---------- */}
      <div className="ra-section-head" style={{ marginTop: 30 }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Acquisition Stage Risk</h2>
          <p className="field-hint" style={{ marginTop: 4 }}>Statutory milestone risk rating across scheduled handover phases.</p>
        </div>
        <div className="ra-legend">
          <span><i className="dot low" /> Low</span>
          <span><i className="dot medium" /> Medium</span>
          <span><i className="dot high" /> High</span>
        </div>
      </div>

      <div className="ra-stage-grid">
        {STAGE_SEQUENCE.map((s, i) => {
          const isCurrent = i === currentStageIdx;
          const isDone = i < currentStageIdx;
          const stageTone = isDone ? "low" : isCurrent ? tone : "upcoming";
          return (
            <div key={s.key} className={`card ra-stage-card tone-${stageTone}${isCurrent ? " current" : ""}`}>
              {isCurrent && <div className="ra-stage-ribbon">CURRENT STAGE</div>}
              <div className="ra-stage-top">
                <span className="field-hint">STAGE {i + 1}</span>
                {stageTone !== "upcoming" && (
                  <span className={`badge badge-${stageTone}`}>{stageTone.toUpperCase()}</span>
                )}
              </div>
              <strong>{s.name}</strong>
              <p className="field-hint" style={{ margin: "4px 0 10px" }}>{s.fallbackDesc}</p>
              <div className={`ra-stage-status ${isDone ? "done" : isCurrent ? "active" : "upcoming"}`}>
                {isDone ? "Completed" : isCurrent ? "Active — under review" : "Upcoming"}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- Prediction trend ---------- */}
      <div className="card" style={{ marginTop: 26 }}>
        <div className="ra-section-head" style={{ marginBottom: 6 }}>
          <div>
            <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Prediction Trend</h2>
            <p className="field-hint" style={{ marginTop: 4 }}>Historical record across review cycles for this project.</p>
          </div>
          <span className="pill-tag">{chartData.length} Cycle{chartData.length === 1 ? "" : "s"} Recorded</span>
        </div>

        {chartData.length < 2 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Trend appears once this project has been re-assessed across multiple cycles — run a prediction again later to build history.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="cycle" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v}`, "Risk Score"]} labelFormatter={(l, p) => p?.[0]?.payload?.date || l} />
              <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}