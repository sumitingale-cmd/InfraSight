import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import Login from "./auth/Login";
import Register from "./auth/Register";
import ProtectedRoute from "./auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ProjectList from "./pages/ProjectList";
import ProjectDetail from "./pages/ProjectDetail";
import NewProject from "./pages/Newproject";
import ActionCenter from "./pages/Actioncenter";
import RiskAssessment from "./pages/Riskassessment";
import RiskAnalysisXAI from "./pages/Riskanalysis";

function Layout({ children, crumb }) {
  const location = useLocation();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="topbar">
          <span>InfraSight</span> &nbsp;›&nbsp; <strong>{crumb}</strong>
        </div>
        <div className="content page-fade" key={location.pathname}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Layout crumb="Dashboard"><Dashboard /></Layout></ProtectedRoute>
          } />

          <Route path="/projects" element={
            <ProtectedRoute><Layout crumb="Projects"><ProjectList /></Layout></ProtectedRoute>
          } />
          <Route path="/new-project" element={
            <ProtectedRoute><Layout crumb="New Project"><NewProject /></Layout></ProtectedRoute>
          } />
          <Route path="/projects/new" element={<Navigate to="/new-project" replace />} />
          <Route path="/project-details" element={<Navigate to="/projects" replace />} />
          <Route path="/projects/:id" element={
            <ProtectedRoute><Layout crumb="Project Details"><ProjectDetail /></Layout></ProtectedRoute>
          } />
          <Route path="/projects/:id/risk-assessment" element={
            <ProtectedRoute><Layout crumb="Risk Assessment"><RiskAssessment /></Layout></ProtectedRoute>
          } />
          <Route path="/projects/:id/risk-analysis" element={
            <ProtectedRoute><Layout crumb="Risk Analysis (XAI)"><RiskAnalysisXAI /></Layout></ProtectedRoute>
          } />

          <Route path="/action-center" element={
            <ProtectedRoute><Layout crumb="Action Center"><ActionCenter /></Layout></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}