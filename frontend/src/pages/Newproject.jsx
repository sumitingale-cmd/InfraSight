import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Save, X, ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import api from "../api/axios";
import highwayImg from "../assets/highway.jpg";

const DRAFT_KEY = "infrasight:new-project-draft";

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Location" },
  { id: 3, label: "Acquisition" },
  { id: 4, label: "Timeline" },
  { id: 5, label: "Compensation" },
  { id: 6, label: "Legal / Approval" },
  { id: 7, label: "Review" },
];

const STAGE_OPTIONS = [
  { value: "notification", label: "Stage 01: Preliminary Notification (Sec 11)" },
  { value: "survey", label: "Stage 02: Social Impact Assessment / Survey" },
  { value: "declaration", label: "Stage 03: Declaration (Sec 19)" },
  { value: "award", label: "Stage 04: Compensation Award Declaration (Sec 19 Publication)" },
  { value: "compensation", label: "Stage 05: Compensation Disbursement" },
  { value: "possession", label: "Stage 06: Possession Handover" },
  { value: "rehabilitation", label: "Stage 07: Rehabilitation & Resettlement" },
  { value: "completed", label: "Stage 08: Completed" },
];

const EMPTY_FORM = {
  // Step 1 - Basic Info
  name: "",
  project_type: "highway",
  corridor_section: "",
  // Step 2 - Location
  district: "",
  state: "",
  latitude: "",
  longitude: "",
  // Step 3 - Acquisition & Parcel Metrics
  land_area_hectares: "",          // Total Required
  acquired_to_date_hectares: "",   // Acquired to date
  total_parcels: "",
  parcels_acquired: "",
  current_stage: "notification",
  government_land_pct: "",
  private_land_pct: "",
  forest_land_pct: "",
  // Step 4 - Timeline
  started_on: "",
  target_completion: "",
  approval_delay_days: "0",
  // Step 5 - Compensation
  compensation_disbursed_pct: "0",
  affected_families: "",
  rehabilitation_progress_pct: "0",
  // Step 6 - Legal / Approval
  legal_disputes_count: "0",
  possession_status_pct: "0",
  stakeholder_responsiveness_score: "5",
};

const REQUIRED_BY_STEP = {
  1: ["name", "project_type"],
  2: ["district", "state", "latitude", "longitude"],
  3: ["land_area_hectares", "acquired_to_date_hectares", "total_parcels", "parcels_acquired"],
  4: [],
  5: ["affected_families"],
  6: [],
  7: [],
};

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function NewProject() {
  const navigate = useNavigate();
  const draftOnLoad = useRef(loadDraft());

  const [form, setForm] = useState(draftOnLoad.current?.form || EMPTY_FORM);
  const [step, setStep] = useState(draftOnLoad.current?.step || 1);
  const [packageCode] = useState(
    draftOnLoad.current?.packageCode || `PKG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(draftOnLoad.current ? new Date() : null);
  const [, forceTick] = useState(0); // re-render every 30s to refresh the "saved Xs ago" label

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // ---- Autosave: debounce writes to localStorage whenever form/step changes ----
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step, packageCode }));
        setLastSavedAt(new Date());
      } catch {
        // storage full or unavailable - not fatal, just skip autosave
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, step]);

  // Refresh the relative "auto-saved Xs ago" text periodically
  useEffect(() => {
    const i = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(i);
  }, []);

  const savedAgoLabel = useMemo(() => {
    if (!lastSavedAt) return null;
    const seconds = Math.max(0, Math.round((Date.now() - lastSavedAt.getTime()) / 1000));
    if (seconds < 10) return "Draft auto-saved just now";
    if (seconds < 60) return `Draft auto-saved ${seconds}s ago`;
    const mins = Math.round(seconds / 60);
    return `Draft auto-saved ${mins} minute${mins > 1 ? "s" : ""} ago`;
  }, [lastSavedAt]);

  // ---- Derived values ----
  const totalRequired = Number(form.land_area_hectares) || 0;
  const acquired = Number(form.acquired_to_date_hectares) || 0;
  const remaining = Math.max(0, totalRequired - acquired);
  const acquisitionPct = totalRequired > 0 ? Math.min(100, Math.round((acquired / totalRequired) * 1000) / 10) : 0;

  const totalParcels = Number(form.total_parcels) || 0;
  const parcelsAcquired = Number(form.parcels_acquired) || 0;
  const pendingParcels = Math.max(0, totalParcels - parcelsAcquired);

  const gisVerified = form.latitude !== "" && form.longitude !== "";

  const saveDraftNow = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step, packageCode }));
      setLastSavedAt(new Date());
    } catch {
      setError("Could not save draft (browser storage unavailable).");
    }
  };

  const discardProject = () => {
    if (!window.confirm("Discard this project? All entered data will be lost.")) return;
    localStorage.removeItem(DRAFT_KEY);
    navigate("/projects");
  };

  const validateStep = (s) => {
    const missing = (REQUIRED_BY_STEP[s] || []).filter((field) => form[field] === "" || form[field] === null);
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ").replace(/_/g, " ")}`);
      return false;
    }
    setError("");
    return true;
  };

  const goToStep = (target) => {
    // Only allow jumping to a completed step or the current one directly;
    // moving forward past the current step must go through Continue's validation.
    if (target <= step) {
      setStep(target);
      setError("");
    }
  };

  const handleBack = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const handleContinue = () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length) setStep((s) => s + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    // Validate every step before final submit, not just the review step
    for (const s of STEPS.map((st) => st.id)) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        district: form.district,
        state: form.state,
        project_type: form.project_type,
        corridor_section: form.corridor_section,
        land_area_hectares: totalRequired,
        acquired_to_date_hectares: acquired,
        total_parcels: totalParcels,
        parcels_acquired: parcelsAcquired,
        current_stage: form.current_stage,
        government_land_pct: Number(form.government_land_pct) || 0,
        private_land_pct: Number(form.private_land_pct) || 0,
        forest_land_pct: Number(form.forest_land_pct) || 0,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        affected_families: Number(form.affected_families) || 0,
        compensation_disbursed_pct: Number(form.compensation_disbursed_pct) || 0,
        rehabilitation_progress_pct: Number(form.rehabilitation_progress_pct) || 0,
        legal_disputes_count: Number(form.legal_disputes_count) || 0,
        approval_delay_days: Number(form.approval_delay_days) || 0,
        possession_status_pct: Number(form.possession_status_pct) || 0,
        stakeholder_responsiveness_score: Number(form.stakeholder_responsiveness_score) || 5,
      };
      if (form.started_on) payload.started_on = form.started_on;
      if (form.target_completion) payload.target_completion = form.target_completion;

      const { data } = await api.post("/risk/projects/create/", payload);
      localStorage.removeItem(DRAFT_KEY);
      navigate(`/projects/${data.id}`);
    } catch (err) {
      const msg = err.response?.data
        ? Object.values(err.response.data).flat().join(" ")
        : "Could not create project. Please check the fields.";
      setError(msg);
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  const progressPct = Math.round((step / STEPS.length) * 100);

  return (
    <>
      {/* ---------- Page header ---------- */}
      <div className="page-header">
        <div>
          <h1>New Land Acquisition Project</h1>
          <p>Create and validate a land acquisition project record.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn" onClick={saveDraftNow}>
            <Save size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Save Draft
          </button>
          <button type="button" className="btn btn-danger-outline" onClick={discardProject}>
            <X size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Discard Project
          </button>
        </div>
      </div>

      {/* ---------- Project summary card ---------- */}
      <div className="card project-summary-card">
        <div className="project-summary-thumb">
          <img src={highwayImg} alt="Land acquisition corridor" className="project-summary-thumb-img" />
          <span className={`badge ${gisVerified ? "badge-low" : "badge-medium"} gis-badge`}>
            {gisVerified ? "GIS Verified" : "GIS Pending"}
          </span>
        </div>
        <div className="project-summary-main">
          <div className="project-summary-tags">
            <span className="eyebrow">PROJECT LOCATION / LAND PARCEL CORRIDOR</span>
            {form.corridor_section && <span className="badge badge-demo">{form.corridor_section}</span>}
          </div>
          <h2>{form.name || "Untitled Project"}</h2>
          <p className="project-summary-meta">
            State: {form.state || "—"} &nbsp;•&nbsp; District: {form.district || "—"} &nbsp;•&nbsp;
            Total RoW Footprint: {totalRequired.toFixed(2)} Ha
          </p>
        </div>
        <div className="project-summary-code">{packageCode}</div>
      </div>

      {/* ---------- Stepper ---------- */}
      <div className="card wizard-stepper-card">
        <div className="wizard-stepper-head">
          <div>
            <Check size={15} className="step-check-icon" />
            <strong>Step {step} of {STEPS.length}: {STEPS[step - 1].label}</strong>
          </div>
          <div className="wizard-progress-label">
            Progress: <strong>{progressPct}%</strong>
            <span className="wizard-progress-track">
              <span className="wizard-progress-fill" style={{ width: `${progressPct}%` }} />
            </span>
          </div>
        </div>

        <div className="wizard-tabs">
          {STEPS.map((s) => {
            const status = s.id < step ? "completed" : s.id === step ? "current" : "upcoming";
            return (
              <button
                type="button"
                key={s.id}
                className={`wizard-tab ${status}`}
                onClick={() => goToStep(s.id)}
                disabled={status === "upcoming"}
              >
                <span className="wizard-tab-num">{status === "completed" ? <Check size={13} /> : s.id}</span>
                <span className="wizard-tab-text">
                  <span className="wizard-tab-label">{s.label}</span>
                  <span className="wizard-tab-status">
                    {status === "completed" ? "Completed" : status === "current" ? "Current Step" : "Upcoming"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="error" style={{ margin: "14px 0 0" }}>{error}</p>}

      {/* ---------- Step content ---------- */}
      <div className="wizard-step-body">
        {step === 1 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Basic Info</h3>
            <label>Project Name</label>
            <input name="name" value={form.name} onChange={handleChange} style={inputStyle} required />

            <div className="form-row">
              <div>
                <label>Project Type</label>
                <select name="project_type" value={form.project_type} onChange={handleChange} style={inputStyle}>
                  <option value="highway">Highway</option>
                  <option value="railway">Railway</option>
                  <option value="irrigation">Irrigation</option>
                  <option value="industrial">Industrial Corridor</option>
                  <option value="urban">Urban Infrastructure</option>
                </select>
              </div>
              <div>
                <label>Corridor Section (optional)</label>
                <input name="corridor_section" placeholder="e.g. Section B-4" value={form.corridor_section} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Location</h3>
            <div className="form-row">
              <div>
                <label>District</label>
                <input name="district" value={form.district} onChange={handleChange} style={inputStyle} required />
              </div>
              <div>
                <label>State</label>
                <input name="state" value={form.state} onChange={handleChange} style={inputStyle} required />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>Latitude</label>
                <input name="latitude" type="number" step="any" value={form.latitude} onChange={handleChange} style={inputStyle} required />
              </div>
              <div>
                <label>Longitude</label>
                <input name="longitude" type="number" step="any" value={form.longitude} onChange={handleChange} style={inputStyle} required />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="two-col">
            <div className="card">
              <div className="section-card-head">
                <h3>Land Extent</h3>
                <span className="pill-tag">Metric: Hectares (Ha)</span>
              </div>
              <div className="form-row">
                <div>
                  <label>Total Required *</label>
                  <input name="land_area_hectares" type="number" step="0.01" value={form.land_area_hectares} onChange={handleChange} style={inputStyle} required />
                  <div className="field-hint">Alignment boundary</div>
                </div>
                <div>
                  <label>Acquired to Date *</label>
                  <input name="acquired_to_date_hectares" type="number" step="0.01" value={form.acquired_to_date_hectares} onChange={handleChange} style={inputStyle} required />
                  <div className="field-hint">Sec 19 declared</div>
                </div>
              </div>
              <label>Land Remaining <span className="pill-tag" style={{ marginLeft: 6 }}>Auto-Derived</span></label>
              <div className="derived-box">{remaining.toFixed(2)} Ha</div>
              <div className="field-hint" style={{ marginBottom: 16 }}>Pending acquisition</div>

              <div className="acquisition-progress-block">
                <div className="acquisition-progress-label">
                  <span>Acquisition Progress</span>
                  <strong>{acquisitionPct}% Completed</strong>
                </div>
                <div className="wizard-progress-track wide">
                  <span className="wizard-progress-fill" style={{ width: `${acquisitionPct}%` }} />
                </div>
                <div className="acquisition-progress-foot">
                  <span>{acquired.toFixed(2)} Ha vested</span>
                  <span>{totalRequired.toFixed(2)} Ha target</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-card-head">
                <h3>Parcel Information</h3>
                <span className="pill-tag">Gat / Survey Ledger</span>
              </div>
              <div className="form-row">
                <div>
                  <label>Total Parcels *</label>
                  <input name="total_parcels" type="number" step="1" value={form.total_parcels} onChange={handleChange} style={inputStyle} required />
                  <div className="field-hint">Total surveyed units</div>
                </div>
                <div>
                  <label>Parcels Acquired *</label>
                  <input name="parcels_acquired" type="number" step="1" value={form.parcels_acquired} onChange={handleChange} style={inputStyle} required />
                  <div className="field-hint">Award announced</div>
                </div>
              </div>
              <label>Pending Parcels <span className="pill-tag" style={{ marginLeft: 6 }}>Auto-Derived</span></label>
              <div className="derived-box">{pendingParcels}</div>
              <div className="field-hint" style={{ marginBottom: 16 }}>Balance in schedule</div>

              <label>Current Acquisition Stage *</label>
              <select name="current_stage" value={form.current_stage} onChange={handleChange} style={inputStyle}>
                {STAGE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <div className="field-hint">Select active procedural milestone per RFCTLARR 2013</div>
            </div>

            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ marginTop: 0 }}>Land Classification Breakdown</h3>
              <p className="field-hint" style={{ marginBottom: 14 }}>Approximate share of total land by category (%).</p>
              <div className="form-row three-col">
                <div>
                  <label>Government Land %</label>
                  <input name="government_land_pct" type="number" step="0.1" value={form.government_land_pct} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label>Private Land %</label>
                  <input name="private_land_pct" type="number" step="0.1" value={form.private_land_pct} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label>Forest Land %</label>
                  <input name="forest_land_pct" type="number" step="0.1" value={form.forest_land_pct} onChange={handleChange} style={inputStyle} />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Timeline</h3>
            <div className="form-row">
              <div>
                <label>Started On</label>
                <input name="started_on" type="date" value={form.started_on} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label>Target Completion</label>
                <input name="target_completion" type="date" value={form.target_completion} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
            <label>Approval Delay (days)</label>
            <input name="approval_delay_days" type="number" step="1" value={form.approval_delay_days} onChange={handleChange} style={inputStyle} />
            <div className="field-hint">Cumulative delay against statutory approval timelines, if any.</div>
          </div>
        )}

        {step === 5 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Compensation</h3>
            <div className="form-row">
              <div>
                <label>Compensation Disbursed %</label>
                <input name="compensation_disbursed_pct" type="number" step="0.1" value={form.compensation_disbursed_pct} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label>Affected Families *</label>
                <input name="affected_families" type="number" step="1" value={form.affected_families} onChange={handleChange} style={inputStyle} required />
              </div>
            </div>
            <label>Rehabilitation Progress %</label>
            <input name="rehabilitation_progress_pct" type="number" step="0.1" value={form.rehabilitation_progress_pct} onChange={handleChange} style={inputStyle} />
          </div>
        )}

        {step === 6 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Legal / Approval</h3>
            <div className="form-row">
              <div>
                <label>Legal Disputes</label>
                <input name="legal_disputes_count" type="number" step="1" value={form.legal_disputes_count} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label>Possession Status %</label>
                <input name="possession_status_pct" type="number" step="0.1" value={form.possession_status_pct} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
            <label>Stakeholder Responsiveness Score (0-10)</label>
            <input name="stakeholder_responsiveness_score" type="number" step="0.1" min="0" max="10" value={form.stakeholder_responsiveness_score} onChange={handleChange} style={inputStyle} />
          </div>
        )}

        {step === 7 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Review</h3>
            <p className="field-hint" style={{ marginBottom: 16 }}>
              Check the details below, then create the project. You can jump back to any completed step to fix something.
            </p>
            <ReviewGroup title="Basic Info" onEdit={() => setStep(1)} rows={[
              ["Project Name", form.name],
              ["Project Type", form.project_type],
              ["Corridor Section", form.corridor_section || "—"],
            ]} />
            <ReviewGroup title="Location" onEdit={() => setStep(2)} rows={[
              ["District", form.district],
              ["State", form.state],
              ["Coordinates", `${form.latitude}, ${form.longitude}`],
            ]} />
            <ReviewGroup title="Acquisition" onEdit={() => setStep(3)} rows={[
              ["Total Required", `${totalRequired.toFixed(2)} Ha`],
              ["Acquired to Date", `${acquired.toFixed(2)} Ha`],
              ["Remaining", `${remaining.toFixed(2)} Ha`],
              ["Parcels", `${parcelsAcquired} / ${totalParcels} acquired (${pendingParcels} pending)`],
              ["Current Stage", STAGE_OPTIONS.find((s) => s.value === form.current_stage)?.label],
            ]} />
            <ReviewGroup title="Timeline" onEdit={() => setStep(4)} rows={[
              ["Started On", form.started_on || "—"],
              ["Target Completion", form.target_completion || "—"],
              ["Approval Delay", `${form.approval_delay_days || 0} days`],
            ]} />
            <ReviewGroup title="Compensation" onEdit={() => setStep(5)} rows={[
              ["Compensation Disbursed", `${form.compensation_disbursed_pct || 0}%`],
              ["Affected Families", form.affected_families || "—"],
              ["Rehabilitation Progress", `${form.rehabilitation_progress_pct || 0}%`],
            ]} />
            <ReviewGroup title="Legal / Approval" onEdit={() => setStep(6)} rows={[
              ["Legal Disputes", form.legal_disputes_count || 0],
              ["Possession Status", `${form.possession_status_pct || 0}%`],
              ["Stakeholder Score", form.stakeholder_responsiveness_score],
            ]} last />
          </div>
        )}
      </div>

      {/* ---------- Sticky footer ---------- */}
      <div className="wizard-footer">
        <div className="wizard-footer-left">
          <button type="button" className="btn" onClick={saveDraftNow}>
            <Save size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Save Draft
          </button>
          {savedAgoLabel && <span className="wizard-autosave-note"><span className="dot-ok" />{savedAgoLabel}</span>}
        </div>
        <div className="wizard-footer-right">
          <button type="button" className="btn" onClick={handleBack} disabled={step === 1}>
            <ArrowLeft size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Back{step > 1 ? `: Step ${step - 1} ${STEPS[step - 2].label}` : ""}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleContinue} disabled={submitting}>
            {step < STEPS.length ? (
              <>Continue: Step {step + 1} {STEPS[step].label} <ArrowRight size={15} style={{ verticalAlign: "-2px", marginLeft: 6 }} /></>
            ) : submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </>
  );
}

function ReviewGroup({ title, rows, onEdit, last }) {
  return (
    <div className={`review-group${last ? "" : " with-border"}`}>
      <div className="review-group-head">
        <strong>{title}</strong>
        <button type="button" className="review-edit-link" onClick={onEdit}>Edit</button>
      </div>
      <div className="review-group-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="review-row">
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
          </div>
        ))}
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