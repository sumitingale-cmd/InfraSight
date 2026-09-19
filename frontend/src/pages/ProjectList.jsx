import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

const STAGE_LABELS = {
  notification:   "Notification",
  survey:         "Survey",
  declaration:    "Declaration",
  award:          "Award",
  compensation:   "Compensation",
  possession:     "Possession",
  rehabilitation: "Rehabilitation",
  completed:      "Completed",
};

/* ─── CSV download utility ─────────────────────────────────── */
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

/* ─── helpers ───────────────────────────────────────────────── */
function getProjectType(type) {
  if (!type) return "—";
  return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function getStage(stage) {
  return STAGE_LABELS[stage] || stage || "—";
}

function getProgress(project) {
  if (project.progress_pct !== undefined) return Number(project.progress_pct);
  const comp  = Number(project.compensation_disbursed_pct  || 0);
  const poss  = Number(project.possession_status_pct        || 0);
  const rehab = Number(project.rehabilitation_progress_pct  || 0);
  return Math.round(((comp + poss + rehab) / 3) * 10) / 10;
}

function getProgressClass(progress) {
  if (progress >= 75) return "progress-high";
  if (progress >= 40) return "progress-medium";
  return "progress-low";
}

/* ─── component ─────────────────────────────────────────────── */
export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    api.get("/projects/")
      .then(res => setProjects(res.data))
      .catch(() => setError("Could not load projects."))
      .finally(() => setLoading(false));
  }, []);

  const filteredProjects = projects.filter(p => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q) ||
      p.district?.toLowerCase().includes(q) ||
      p.project_type?.toLowerCase().includes(q)
    );
  });

  /* Export the currently-filtered project list as CSV */
  const exportProjects = () => {
    const rows = filteredProjects.map((p, i) => ({
      "#":                          i + 1,
      project_id:                   `LA-${String(p.id).padStart(4, "0")}`,
      name:                         p.name,
      project_type:                 p.project_type,
      district:                     p.district,
      state:                        p.state,
      current_stage:                p.current_stage,
      land_area_hectares:           p.land_area_hectares,
      affected_families:            p.affected_families,
      compensation_disbursed_pct:   p.compensation_disbursed_pct,
      possession_status_pct:        p.possession_status_pct,
      rehabilitation_progress_pct:  p.rehabilitation_progress_pct,
      legal_disputes_count:         p.legal_disputes_count,
      approval_delay_days:          p.approval_delay_days,
      stakeholder_responsiveness:   p.stakeholder_responsiveness_score,
      started_on:                   p.started_on,
      target_completion:            p.target_completion,
      progress_pct:                 getProgress(p),
      status:                       p.current_stage === "completed" ? "Completed" : "Active",
      exported_at:                  new Date().toISOString(),
    }));
    downloadCSV(rows, `projects-report-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (loading) {
    return (
      <div className="projects-page">
        <div className="page-header"><div><h1>Projects</h1><p>Loading land acquisition projects...</p></div></div>
        <div className="card"><p>Loading projects...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="projects-page">
        <div className="page-header"><div><h1>Projects</h1><p>Monitor and manage land acquisition projects.</p></div></div>
        <div className="card"><p className="error">{error}</p></div>
      </div>
    );
  }

  return (
    <div className="projects-page">

      {/* HEADER */}
      <div className="page-header projects-header">
        <div>
          <div className="title-row">
            <h1>Projects</h1>
            <span className="badge badge-demo">DEMO / PROTOTYPE DATA</span>
          </div>
          <p>Monitor and manage land acquisition projects across all jurisdictions.</p>
        </div>

        <div className="project-header-actions">
          {/* Export CSV — downloads all currently-filtered projects */}
          <button
            className="secondary-button"
            onClick={exportProjects}
            disabled={!filteredProjects.length}
            title="Download the current project list as a CSV file"
          >
            ↓ Export CSV / Report
          </button>

          <Link to="/new-project" className="primary-button">
            ⊕ Create Project
          </Link>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="project-summary-grid">
        <div className="summary-card">
          <div className="summary-label">TOTAL PROJECTS</div>
          <div className="summary-value">{projects.length}</div>
          <div className="summary-description">Registered land acquisition projects</div>
          <div className="summary-line" />
        </div>

        <div className="summary-card">
          <div className="summary-label high">COMPLETED</div>
          <div className="summary-value">{projects.filter(p => p.current_stage === "completed").length}</div>
          <div className="summary-description">Acquisition completed</div>
        </div>

        <div className="summary-card">
          <div className="summary-label medium">IN PROGRESS</div>
          <div className="summary-value">{projects.filter(p => p.current_stage !== "completed").length}</div>
          <div className="summary-description">Active acquisition projects</div>
        </div>

        <div className="summary-card">
          <div className="summary-label low">AVERAGE PROGRESS</div>
          <div className="summary-value">
            {projects.length
              ? Math.round(projects.reduce((sum, p) => sum + getProgress(p), 0) / projects.length)
              : 0}%
          </div>
          <div className="summary-description">Across registered projects</div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="project-toolbar card">
        <input
          className="project-search"
          type="text"
          placeholder="Search project name, state, district..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="project-count">
          Showing {filteredProjects.length} of {projects.length} projects
        </div>
      </div>

      {/* TABLE */}
      <div className="card project-table-card">
        <div className="table-header">
          <div>
            <h3>Registered Projects</h3>
            <span>{filteredProjects.length} projects</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="project-table">
            <thead>
              <tr>
                <th>PROJECT</th>
                <th>LOCATION</th>
                <th>PROGRESS</th>
                <th>CURRENT STAGE</th>
                <th>LAND AREA</th>
                <th>AFFECTED FAMILIES</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-row">No projects found.</td>
                </tr>
              ) : (
                filteredProjects.map(project => {
                  const progress = getProgress(project);
                  return (
                    <tr key={project.id}>
                      <td>
                        <div className="project-name">{project.name}</div>
                        <div className="project-type">{getProjectType(project.project_type)}</div>
                      </td>
                      <td>
                        <div className="location-main">{project.district}</div>
                        <div className="location-state">{project.state}</div>
                      </td>
                      <td>
                        <div className="progress-container">
                          <div className="progress-top"><span>{progress}%</span></div>
                          <div className="progress-bar">
                            <div
                              className={`progress-fill ${getProgressClass(progress)}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td><span className="stage-badge">{getStage(project.current_stage)}</span></td>
                      <td>{Number(project.land_area_hectares || 0).toLocaleString()} ha</td>
                      <td>{Number(project.affected_families || 0).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${project.current_stage === "completed" ? "completed" : "active"}`}>
                          <span className="status-dot" />
                          {project.current_stage === "completed" ? "Completed" : "Active"}
                        </span>
                      </td>
                      <td>
                        <Link to={`/projects/${project.id}`} className="view-project-button">
                          View Project
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
