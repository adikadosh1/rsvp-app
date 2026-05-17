import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { clearToken } from "../lib/auth.js";
import { apiFetch } from "../lib/api.js";

function BrandMark() {
  return <img className="logo-mark" src="/brand/logo-mark.svg" alt="" aria-hidden="true" />;
}

function NavItem({ to, icon, label }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== "/dashboard" && loc.pathname.startsWith(to));
  return (
    <Link className={`nav-item ${active ? "active" : ""}`} to={to}>
      <span className="nav-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export default function AdminShell() {
  const [events, setEvents] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const lastEventId = useMemo(() => {
    try {
      return localStorage.getItem("hkham:lastEventId");
    } catch (_e) {
      return null;
    }
  }, []);

  useEffect(() => {
    apiFetch("/events")
      .then((list) => setEvents(Array.isArray(list) ? list : []))
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  // Close drawer on route change
  const loc = useLocation();
  useEffect(() => {
    setMobileNavOpen(false);
  }, [loc.pathname]);

  return (
    <div className="admin-shell">
      <div className="gold-line" aria-hidden="true" />
      <header className="admin-topbar" role="banner">
        <button
          type="button"
          className="menu-btn"
          aria-label={mobileNavOpen ? "סגור תפריט" : "פתח תפריט"}
          aria-expanded={mobileNavOpen ? "true" : "false"}
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          <span className="menu-ic" aria-hidden="true" />
        </button>
        <Link className="topbar-brand" to="/dashboard" aria-label="מעבר לדשבורד">
          <BrandMark />
          <span className="topbar-title">הושבה כיד המלך</span>
        </Link>
      </header>

      {mobileNavOpen ? <div className="sidebar-backdrop" onMouseDown={() => setMobileNavOpen(false)} aria-hidden="true" /> : null}

      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`} aria-label="תפריט ניהול">
        <div className="logo">
          <div className="logo-eyebrow">RSVP PREMIUM</div>
          <div className="logo-row">
            <BrandMark />
            <div className="logo-text">
              הושבה <span>כיד המלך</span>
            </div>
          </div>
          <div className="logo-sub">פאנל ניהול יוקרתי</div>
        </div>

        <div className="nav-section">ניהול</div>
        <NavItem to="/dashboard" icon="✦" label="יצירת אירוע" />
        <NavItem to="/start" icon="⧉" label="קישור לבעל אירוע (Self‑Serve)" />

        {lastEventId && (
          <>
            <div className="nav-section">מהיר</div>
            <NavItem to={`/events/${lastEventId}`} icon="⟲" label="חזרה לאירוע האחרון" />
            <NavItem to={`/manage/${lastEventId}`} icon="✉" label="העלאת אורחים ושליחה" />
          </>
        )}

        {events.length > 0 && (
          <>
            <div className="nav-section">אירועים אחרונים</div>
            {events.slice(0, 5).map((ev) => (
              <Link key={ev.id} className="nav-item" to={`/events/${ev.id}`}>
                <span className="nav-icon" aria-hidden="true">
                  ◈
                </span>
                <span className="nav-ev">
                  <span className="nav-ev-name">{ev.event_name || "אירוע"}</span>
                  {ev.event_date && <span className="nav-ev-date">{new Date(ev.event_date).toLocaleDateString("he-IL")}</span>}
                </span>
              </Link>
            ))}
          </>
        )}

        <div className="sidebar-footer">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              clearToken();
              window.location.href = "/login";
            }}
          >
            יציאה
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

