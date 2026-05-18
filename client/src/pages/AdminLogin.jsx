import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { apiFetch } from "../lib/api.js";
import { setToken } from "../lib/auth.js";
import BrandMark from "../components/BrandMark.jsx";
import BrandWordmark from "../components/BrandWordmark.jsx";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setNotice("");
      const data = await apiFetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      setToken(data.token);
      navigate("/dashboard");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <section className="card login-card">
        <Link to="/" className="login-back-link">
          <ArrowRight size={16} aria-hidden="true" />
          חזרה לדף הבית
        </Link>
        <div className="login-brand">
          <BrandMark size="lg" />
          <BrandWordmark eyebrow="PREMIUM RSVP" subtitle="פאנל ניהול" compact />
        </div>
        <h2 className="login-title">התחברות מנהל</h2>
        <p className="hint">כדי לנהל אירועים, העלאות ושליחות—נדרשת התחברות.</p>
        <form onSubmit={submit} className="form-grid">
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>סיסמה</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn btn-gold" type="submit" disabled={loading}>
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </form>
        {notice && <p className="status">{notice}</p>}
      </section>
    </div>
  );
}

