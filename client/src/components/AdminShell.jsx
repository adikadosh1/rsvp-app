import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Link2, LayoutDashboard, LogOut, Mail, Menu, Sparkles, Users } from "lucide-react";
import { clearToken } from "../lib/auth.js";
import { apiFetch } from "../lib/api.js";
import DarkModeToggle from "./DarkModeToggle.jsx";

function NavItem({ to, icon: Icon, label }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== "/dashboard" && loc.pathname.startsWith(to));
  return (
    <Link className={`nav-item ${active ? "active" : ""}`} to={to}>
      <span className="nav-icon-wrap" aria-hidden="true">
        <Icon size={16} />
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
          <span className="logo-mark-wrap" aria-hidden="true">
            ✦
          </span>
          <span className="topbar-title">הושבה כיד המלך</span>
        </Link>
      </header>

      {mobileNavOpen ? <div className="sidebar-backdrop" onMouseDown={() => setMobileNavOpen(false)} aria-hidden="true" /> : null}

      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`} aria-label="תפריט ניהול">
        <div className="logo">
          <div className="logo-eyebrow">PREMIUM RSVP</div>
          <div className="logo-row">
            <span className="logo-mark-wrap" aria-hidden="true">
              ✦
            </span>
            <div className="logo-text">
              הושבה <span>כיד המלך</span>
            </div>
          </div>
          <div className="logo-sub">פאנל ניהול יוקרתי</div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar" aria-hidden="true">
            מ
          </div>
          <div>
            <div className="sidebar-user-name">מנהל מערכת</div>
            <span className="plan-badge">Premium Plan</span>
          </div>
        </div>

        <div className="nav-divider" />

        <div className="nav-section">ניהול</div>
        <NavItem to="/dashboard" icon={LayoutDashboard} label="דשבורד ואירועים" />
        <NavItem to="/start" icon={Link2} label="קישור לבעל אירוע" />

        {lastEventId && (
          <>
            <div className="nav-divider" />
            <div className="nav-section">מהיר</div>
            <NavItem to={`/events/${lastEventId}`} icon={Sparkles} label="אירוע אחרון" />
            <NavItem to={`/manage/${lastEventId}`} icon={Mail} label="אורחים ושליחה" />
          </>
        )}

        {events.length > 0 && (
          <>
            <div className="nav-divider" />
            <div className="nav-section">אירועים אחרונים</div>
            {events.slice(0, 5).map((ev) => (
              <Link key={ev.id} className="nav-item" to={`/events/${ev.id}`}>
                <span className="nav-icon-wrap" aria-hidden="true">
                  <CalendarPlus size={16} />
                </span>
                <span className="nav-ev">
                  <span className="nav-ev-name">{ev.event_name || "אירוע"}</span>
                  {ev.event_date && <span className="nav-ev-date">{new Date(ev.event_date).toLocaleDateString("he-IL")}</span>}
                </span>
              </Link>
            ))}
          </>
        )}

        <div className="sidebar-footer" style={{ display: "grid", gap: 10, marginTop: "auto" }}>
          <DarkModeToggle />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              clearToken();
              window.location.href = "/login";
            }}
          >
            <LogOut size={16} style={{ marginLeft: 8 }} />
            יציאה
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav" aria-label="ניווט מהיר">
        <Link className={`bottom-nav-item ${loc.pathname === "/dashboard" ? "active" : ""}`} to="/dashboard">
          <LayoutDashboard size={20} />
          <span>ראשי</span>
        </Link>
        {lastEventId ? (
          <>
            <Link
              className={`bottom-nav-item ${loc.pathname === `/events/${lastEventId}` ? "active" : ""}`}
              to={`/events/${lastEventId}`}
            >
              <Sparkles size={20} />
              <span>אירוע</span>
            </Link>
            <Link
              className={`bottom-nav-item ${loc.pathname === `/manage/${lastEventId}` ? "active" : ""}`}
              to={`/manage/${lastEventId}`}
            >
              <Users size={20} />
              <span>אורחים</span>
            </Link>
          </>
        ) : (
          <Link className={`bottom-nav-item ${loc.pathname === "/start" ? "active" : ""}`} to="/start">
            <Link2 size={20} />
            <span>קישור</span>
          </Link>
        )}
        <button
          type="button"
          className={`bottom-nav-item ${mobileNavOpen ? "active" : ""}`}
          aria-label="תפריט מלא"
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          <Menu size={20} />
          <span>עוד</span>
        </button>
      </nav>
    </div>
  );
}
