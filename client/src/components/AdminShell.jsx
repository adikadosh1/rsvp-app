import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { clearToken } from "../lib/auth.js";
import { apiFetch } from "../lib/api.js";

function CrownMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M10 46h44v6H10v-6Zm4-24 10 12 8-14 8 14 10-12 6 18H8l6-18Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M16 16a4 4 0 1 0 0.001 0ZM32 10a4 4 0 1 0 0.001 0ZM48 16a4 4 0 1 0 0.001 0Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
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

  return (
    <div className="admin-shell">
      <div className="gold-line" aria-hidden="true" />
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-eyebrow">RSVP PREMIUM</div>
          <div className="logo-row">
            <CrownMark />
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

