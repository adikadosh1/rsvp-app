import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api.js";
import { setToken } from "../lib/auth.js";

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
        <div className="login-eyebrow">ניהול</div>
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

