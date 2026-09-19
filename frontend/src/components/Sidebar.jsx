import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  ShieldAlert,
  BrainCircuit,
  Bell,
  PlusCircle,
  Landmark,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const [modelStatus, setModelStatus] = useState({ version: "—", active: false });
  const [openActionCount, setOpenActionCount] = useState(0);

  // Are we anywhere under /projects/:id ? -> show the project-scoped links
  // Exclude reserved words so /projects/new (legacy redirect) never counts as an ID.
  const rawProjectId = params.id || (location.pathname.match(/^\/projects\/([^/]+)/) || [])[1];
  const projectId = rawProjectId && rawProjectId !== "new" ? rawProjectId : null;

  useEffect(() => {
    api.get("/risk/ml/model-status/")
      .then((res) => setModelStatus(res.data))
      .catch(() => setModelStatus({ version: "v6.2", active: true })); // fallback, adjust endpoint if different
  }, []);

  useEffect(() => {
    api.get("/risk/action-center/?status=open")
      .then((res) => setOpenActionCount(res.data.length ?? res.data.count ?? 0))
      .catch(() => setOpenActionCount(0));
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate("/login"); };
  const initials = user?.username?.slice(0, 2).toUpperCase() || "?";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="icon-box"><Landmark size={18} color="white" /></div>
        <div>
          <div className="name">InfraSight</div>
          <div className="subtitle">Predictive Decision Support</div>
        </div>
      </div>

      <div className={`model-status-badge${modelStatus.active ? " active" : ""}`}>
        <span className="dot" />
        Predictive Model {modelStatus.version} {modelStatus.active ? "(Active)" : "(Inactive)"}
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
          <LayoutDashboard size={17} /> Dashboard
        </NavLink>

        <NavLink to="/projects" end className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
          <FolderKanban size={17} /> Projects
        </NavLink>

        {/* Project-scoped links: only appear once a project is open */}
        {projectId && (
          <div className="sidebar-subgroup">
            <NavLink
              to={`/projects/${projectId}`}
              end
              className={({ isActive }) => `sidebar-link sub${isActive ? " active" : ""}`}
            >
              <FileText size={17} /> Project Details
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/risk-assessment`}
              className={({ isActive }) => `sidebar-link sub${isActive ? " active" : ""}`}
            >
              <ShieldAlert size={17} /> Risk Assessment
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/risk-analysis`}
              className={({ isActive }) => `sidebar-link sub${isActive ? " active" : ""}`}
            >
              <BrainCircuit size={17} /> Risk Analysis (XAI)
            </NavLink>
          </div>
        )}

        <NavLink to="/action-center" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
          <Bell size={17} /> Action Center
          {openActionCount > 0 && <span className="nav-count-badge">{openActionCount}</span>}
        </NavLink>

        <NavLink to="/new-project" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
          <PlusCircle size={17} /> New Project
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="avatar">{initials}</div>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.username}</div>
              <div className="role">{user.role}</div>
            </div>
          </div>
        )}
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Log out
        </button>
      </div>
    </aside>
  );
}