import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Landmark } from "lucide-react";

import api from "../api/axios";
import highwayImg from "../assets/highway.jpg";

export default function Register() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "officer",
    department: "",
    password: "",
    confirm_password: "",
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

    // -----------------------------
    // Frontend validation
    // -----------------------------

    if (!form.full_name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // -----------------------------------------
      // Generate username from email
      // -----------------------------------------

      const username = form.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "");

      // -----------------------------------------
      // Registration
      // -----------------------------------------

      const registerResponse = await api.post(
        "/auth/register/",
        {
          username: username,
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          password: form.password,
          role: form.role,
          department: form.department.trim(),
        }
      );

      console.log(
        "Registration successful:",
        registerResponse.data
      );

      // -----------------------------------------
      // Login after successful registration
      // -----------------------------------------

      const loginResponse = await api.post(
        "/auth/login/",
        {
          username: username,
          password: form.password,
        }
      );

      // -----------------------------------------
      // Save JWT tokens
      // -----------------------------------------

      localStorage.setItem(
        "access",
        loginResponse.data.access
      );

      localStorage.setItem(
        "refresh",
        loginResponse.data.refresh
      );

      // -----------------------------------------
      // Go to dashboard
      // -----------------------------------------

      navigate("/dashboard");

    } catch (err) {
      console.error(
        "Registration/Login error:",
        err.response?.data || err
      );

      // -----------------------------------------
      // Show actual backend error
      // -----------------------------------------

      if (err.response?.data) {
        const backendError = err.response.data;

        if (typeof backendError === "string") {
          setError(backendError);
        } else {
          const messages = [];

          Object.entries(backendError).forEach(
            ([field, value]) => {
              if (Array.isArray(value)) {
                messages.push(
                  `${field}: ${value.join(" ")}`
                );
              } else {
                messages.push(
                  `${field}: ${value}`
                );
              }
            }
          );

          setError(
            messages.length
              ? messages.join(" ")
              : "Registration failed."
          );
        }
      } else {
        setError(
          "Unable to connect to the server."
        );
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">

      {/* ================================
          LEFT HERO
      ================================= */}

      <div className="auth-hero" style={{
        backgroundImage: `linear-gradient(160deg, rgba(11,21,38,0.82) 0%, rgba(17,29,51,0.75) 100%), url(${highwayImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>

        <div className="brand">

          <div className="icon-box">
            <Landmark
              size={20}
              color="white"
            />
          </div>

          <div>

            <div className="brand-row">

              <span className="brand-title">
                InfraSight
              </span>

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
            AI-powered early warning and decision
            support for land acquisition delays.
          </p>

        </div>

        <div className="footer-note">
          Smart India Hackathon 2026 Initiative
        </div>

      </div>


      {/* ================================
          RIGHT FORM
      ================================= */}

      <div className="auth-panel">

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <h2>
            Create your account
          </h2>

          <p className="sub">
            Enter your essential account details
          </p>


          {/* ERROR */}

          {error && (
            <div className="error">
              {error}
            </div>
          )}


          {/* FULL NAME */}

          <label>
            Full Name
          </label>

          <input
            name="full_name"
            placeholder="Officer R. Sharma"
            value={form.full_name}
            onChange={handleChange}
            required
          />


          {/* EMAIL */}

          <label>
            Email
          </label>

          <input
            name="email"
            type="email"
            placeholder="officer.sharma@landacq.gov.in"
            value={form.email}
            onChange={handleChange}
            required
          />


          {/* ROLE */}

          <label>
            Role
          </label>

          <select
            name="role"
            value={form.role}
            onChange={handleChange}
          >

            <option value="officer">
              Land Acquisition Officer
            </option>

            <option value="policymaker">
              Policymaker
            </option>

            <option value="admin">
              Administrator
            </option>

          </select>


          {/* DEPARTMENT */}

          <label>
            Department
          </label>

          <input
            name="department"
            placeholder="Land Acquisition Department"
            value={form.department}
            onChange={handleChange}
          />


          {/* PASSWORD */}

          <div className="form-row">

            <div>

              <label>
                Password
              </label>

              <input
                name="password"
                type="password"
                placeholder="Min. 8 chars"
                value={form.password}
                onChange={handleChange}
                minLength={8}
                required
              />

            </div>


            <div>

              <label>
                Confirm Password
              </label>

              <input
                name="confirm_password"
                type="password"
                placeholder="Confirm"
                value={form.confirm_password}
                onChange={handleChange}
                required
              />

            </div>

          </div>


          {/* SUBMIT */}

          <button
            type="submit"
            disabled={loading}
          >

            {loading
              ? "Creating account..."
              : "Create Account"}

          </button>


          {/* LOGIN */}

          <p className="switch-link">

            Already have an account?{" "}

            <Link to="/login">
              Sign In
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