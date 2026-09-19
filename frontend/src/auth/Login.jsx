import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Landmark } from "lucide-react";
import api from "../api/axios";
import highwayImg from "../assets/highway.jpg";

export default function Login() {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login/", form);

      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);

      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data
        ? Object.values(err.response.data).flat().join(" ")
        : "Invalid username or password.";

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      {/* ---------- Left hero panel ---------- */}
      <div className="auth-hero" style={{
        backgroundImage: `linear-gradient(160deg, rgba(11,21,38,0.82) 0%, rgba(17,29,51,0.75) 100%), url(${highwayImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>
        <div className="brand">
          <div className="icon-box">
            <Landmark size={20} color="white" />
          </div>

          <div>
            <div className="brand-row">
              <span className="brand-title">InfraSight</span>
              <span className="badge-prototype">
                SIH 2026 PROTOTYPE
              </span>
            </div>

            <div className="brand-subtitle">
              Predictive Decision Support System
            </div>
          </div>
        </div>

        <div>
          <h1>
            Predictive Intelligence for
            <br />
            Land Acquisition
          </h1>

          <p className="tagline">
            AI-powered early warning and decision support for land
            acquisition delays.
          </p>
        </div>

        <div className="footer-note">
          Smart India Hackathon 2026 Initiative
        </div>
      </div>

      {/* ---------- Right form panel ---------- */}
      <div className="auth-panel">
        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Welcome back</h2>

          <p className="sub">
            Sign in to continue to your workspace
          </p>

          {error && <p className="error">{error}</p>}

          <label>Username</label>

          <input
            name="username"
            type="text"
            placeholder="Enter your username"
            value={form.username}
            onChange={handleChange}
            required
          />

          <label>Password</label>

          <input
            name="password"
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="switch-link">
            New here?{" "}
            <Link to="/register">
              Create an account
            </Link>
          </p>
        </form>

        <div className="auth-footer-note">
          SIH 2026 Prototype &bull; Land Acquisition AI
        </div>
      </div>
    </div>
  );
}