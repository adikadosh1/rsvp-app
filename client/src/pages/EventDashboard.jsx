import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, MapPin, Upload, LayoutDashboard, Users, UserCheck, UserX, Clock } from "lucide-react";
import GuestTable from "../components/GuestTable.jsx";
import ProgressRing from "../components/ProgressRing.jsx";
import { RSVPDonut, ResponsesByHour, RecentResponses } from "../components/DashboardCharts.jsx";
import CountdownFlip from "../components/CountdownFlip.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { apiFetch } from "../lib/api.js";
import { getBrowserSupabase } from "../lib/supabaseBrowser.js";
import { statusLabel } from "../utils/rsvpDisplay.js";

function formatEventDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export default function EventDashboard() {
  const { eventId } = useParams();
  const toast = useToast();
  const prevAnsweredRef = useRef(0);
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const guestIdSetRef = useRef(new Set());
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [timeline, setTimeline] = useState({ byHour: [], recent: [] });
  const [rt, setRt] = useState({ enabled: false, status: "off", lastUpdate: null });

  const load = async () => {
    const [eventData, guestsData, timelineData] = await Promise.all([
      apiFetch(`/events/${eventId}`),
      apiFetch(`/guests/${eventId}`),
      apiFetch(`/events/${eventId}/response-timeline`)
    ]);
    setEvent(eventData);
    setGuests(guestsData);
    setTimeline(timelineData);
    guestIdSetRef.current = new Set((guestsData || []).map((g) => g.id).filter(Boolean));
    setRt((prev) => ({ ...prev, lastUpdate: new Date().toISOString() }));
  };

  useEffect(() => {
    try {
      localStorage.setItem("hkham:lastEventId", eventId);
    } catch (_e) {
      // ignore
    }
    setNotice("");
    setLoading(true);
    load()
      .catch((e) => setNotice(e.message))
      .finally(() => setLoading(false));

    const sb = getBrowserSupabase();
    let channel = null;
    let t = null;
    let raf = null;
    let pending = false;
    let mode = "poll10";
    const kick = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(() => {
        pending = false;
        load().catch(() => undefined);
      });
    };

    const setIntervalMode = (next) => {
      mode = next;
      if (t) clearInterval(t);
      t = setInterval(() => load().catch(() => undefined), mode === "poll10" ? 10000 : 60000);
    };

    const affectsThisEvent = (payload) => {
      const gid = payload?.new?.guest_id ?? payload?.old?.guest_id ?? null;
      if (!gid) return false;
      return guestIdSetRef.current.has(gid);
    };

    if (sb) {
      setRt({ enabled: true, status: "connecting", lastUpdate: new Date().toISOString() });
      channel = sb
        .channel(`event-${eventId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
          () => kick()
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, (payload) => {
          if (affectsThisEvent(payload)) kick();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "rsvp_responses" }, (payload) => {
          if (affectsThisEvent(payload)) kick();
        })
        .subscribe((status) => {
          const s = status === "SUBSCRIBED" ? "on" : status === "CHANNEL_ERROR" ? "error" : "connecting";
          setRt((prev) => ({ ...prev, enabled: true, status: s }));
          if (s === "on") setIntervalMode("poll60");
          if (s === "error") setIntervalMode("poll10");
        });
      setIntervalMode("poll60");
    } else {
      setRt({ enabled: false, status: "off", lastUpdate: new Date().toISOString() });
      setIntervalMode("poll10");
    }

    return () => {
      if (t) clearInterval(t);
      if (raf) cancelAnimationFrame(raf);
      if (channel) sb.removeChannel(channel);
    };
  }, [eventId]);

  const stats = useMemo(() => {
    const total = guests.length;
    const arrived = guests.filter((g) => statusLabel(g) === "מגיע").length;
    const notArrived = guests.filter((g) => statusLabel(g) === "לא מגיע").length;
    const uncertain = guests.filter((g) => statusLabel(g) === "לא יודע").length;
    const notAnswered = guests.filter((g) => statusLabel(g) === "טרם ענה").length;
    let totalDiners = 0;
    let totalVeg = 0;
    let totalKids = 0;
    for (const g of guests) {
      if (statusLabel(g) !== "מגיע") continue;
      const r = g.latestResponse;
      const n = Number(r?.attendees_count ?? r?.guest_count ?? 0);
      if (Number.isFinite(n)) totalDiners += n;
      const v = Number(r?.vegetarian_count ?? 0);
      const k = Number(r?.kids_meals_count ?? 0);
      if (Number.isFinite(v)) totalVeg += v;
      if (Number.isFinite(k)) totalKids += k;
    }
    return { total, arrived, notArrived, uncertain, notAnswered, totalDiners, totalVeg, totalKids };
  }, [guests]);

  const responseRate = useMemo(() => {
    if (!stats.total) return 0;
    const answered = stats.total - stats.notAnswered;
    return Math.round((answered / stats.total) * 100);
  }, [stats]);

  useEffect(() => {
    const answered = stats.total - stats.notAnswered;
    if (answered > prevAnsweredRef.current && prevAnsweredRef.current > 0) {
      toast.push({
        tone: "success",
        title: "תשובה חדשה",
        message: "אורח עדכן את אישור ההגעה בזמן אמת"
      });
    }
    prevAnsweredRef.current = answered;
  }, [stats.total, stats.notAnswered, toast]);

  const responsesByHour = useMemo(() => timeline?.byHour || [], [timeline]);

  const mapSrc = useMemo(() => {
    const raw = String(event?.maps_url || event?.venue_name || "").trim();
    if (!raw) return null;

    const extractIframeSrc = (s) => {
      const m = s.match(/src\s*=\s*["']([^"']+)["']/i);
      return m?.[1] ? String(m[1]).trim() : "";
    };

    const mkEmbed = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;

    try {
      if (raw.startsWith("<iframe")) {
        const src = extractIframeSrc(raw);
        return src || null;
      }
      if (raw.includes("output=embed")) return raw;
      if (/^https?:\/\//i.test(raw)) {
        if (raw.includes("google.com/maps/embed")) return raw;
        return mkEmbed(raw);
      }
      return mkEmbed(raw);
    } catch (_e) {
      return null;
    }
  }, [event?.maps_url, event?.venue_name]);

  const mapHref = useMemo(() => {
    const raw = String(event?.maps_url || event?.venue_name || "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://www.google.com/maps?q=${encodeURIComponent(raw)}`;
  }, [event?.maps_url, event?.venue_name]);

  const sparkSeries = useMemo(() => (timeline?.byHour || []).map((h) => h.count || 0), [timeline]);

  const ringColor = useMemo(() => {
    if (responseRate >= 66) return "var(--ok)";
    if (responseRate >= 33) return "var(--amber)";
    return "var(--danger)";
  }, [responseRate]);

  const filteredGuests = useMemo(() => {
    const q = query.trim();
    return guests
      .filter((g) => {
        const s = statusLabel(g);
        if (filter === "מגיעים") return s === "מגיע";
        if (filter === "לא מגיעים") return s === "לא מגיע";
        if (filter === "לא יודעים") return s === "לא יודע";
        if (filter === "לא ענו") return s === "טרם ענה";
        return true;
      })
      .filter((g) => {
        if (!q) return true;
        const hay = `${g.full_name || ""} ${g.phone || ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
  }, [guests, filter, query]);

  const eventDateLabel = formatEventDate(event?.event_date || event?.date);
  const venueLabel = String(event?.venue_name || "").trim() || null;

  const rtLabel =
    rt.enabled
      ? rt.status === "on"
        ? "מחובר בזמן אמת"
        : rt.status === "error"
          ? "Realtime לא זמין"
          : "מתחבר..."
      : "עדכון אוטומטי";

  return (
    <div className="event-panel page-fade">
      <PageHeader
        title="פאנל אירוע"
        breadcrumbs={[
          { label: "מסך ראשי", to: "/dashboard" },
          { label: event?.event_name || "אירוע" }
        ]}
        actions={
          <Link className="btn btn-ghost" to="/dashboard">
            <LayoutDashboard size={16} aria-hidden="true" />
            כל האירועים
          </Link>
        }
      />

      <header className="event-hero card">
        <div className="event-hero-body">
          <p className="event-hero-eyebrow">ניהול אירוע</p>
          <h1 className="event-hero-title">{loading ? "טוען..." : event?.event_name || "אירוע"}</h1>
          <div className="event-hero-meta">
            {eventDateLabel ? (
              <span className="event-meta-chip">
                <CalendarDays size={15} aria-hidden="true" />
                {eventDateLabel}
              </span>
            ) : null}
            {venueLabel ? (
              <span className="event-meta-chip">
                <MapPin size={15} aria-hidden="true" />
                {venueLabel}
              </span>
            ) : null}
            <span className={`rt-pill ${rt.status}`} role="status" aria-live="polite">
              {rtLabel}
            </span>
          </div>
        </div>
        <div className="event-hero-actions">
          <Link className="btn btn-primary" to={`/manage/${eventId}`}>
            <Upload size={16} aria-hidden="true" />
            העלאה ושליחה
          </Link>
          <button className="btn btn-ghost" type="button" onClick={() => load().catch((e) => setNotice(e.message))}>
            רענון נתונים
          </button>
        </div>
      </header>

      {loading ? (
        <div className="stats-hero">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card-hero skeleton" style={{ height: 120 }} />
          ))}
        </div>
      ) : (
        <div className="stats-hero">
          <StatCard label="סה״כ אורחים" value={stats.total} icon={Users} spark={sparkSeries} />
          <StatCard
            label="מגיעים"
            value={stats.arrived}
            icon={UserCheck}
            trendUp
            trend={`${stats.total ? Math.round((stats.arrived / stats.total) * 100) : 0}%`}
            spark={sparkSeries}
          />
          <StatCard label="לא ענו" value={stats.notAnswered} icon={Clock} trend={String(stats.notAnswered)} trendUp={false} spark={sparkSeries} />
          <StatCard label="לא מגיעים" value={stats.notArrived} icon={UserX} trend={String(stats.notArrived)} trendUp={false} spark={sparkSeries} />
        </div>
      )}

      <section className="card event-panel-section" aria-labelledby="event-insights-heading">
        <div className="event-section-head">
          <div>
            <h2 id="event-insights-heading" className="event-section-title">
              תמונת מצב
            </h2>
            <p className="event-section-sub">ספירה לאחור, גרפים ותשובות אחרונות</p>
          </div>
        </div>

        <div className="event-countdown-panel">
          <div className="event-countdown-label">ספירה לאחור לאירוע</div>
          <CountdownFlip eventDate={event?.event_date || event?.date} eventName={event?.event_name} />
        </div>

        <div className="dashboard-grid event-dashboard-grid">
          <div className="event-dashboard-main">
            <div className="event-charts-row">
              <RSVPDonut stats={stats} />
              <ResponsesByHour items={responsesByHour} />
            </div>

            {!loading && (
              <div className="event-metrics-strip" aria-label="סיכום מנות וסטטוסים">
                <div className="event-metric-pill">
                  <span className="event-metric-label">לא יודעים</span>
                  <strong className="event-metric-value">{stats.uncertain}</strong>
                </div>
                <div className="event-metric-pill">
                  <span className="event-metric-label">סה״כ סועדים</span>
                  <strong className="event-metric-value">{stats.totalDiners}</strong>
                </div>
                <div className="event-metric-pill">
                  <span className="event-metric-label">מנות צמחוניות</span>
                  <strong className="event-metric-value">{stats.totalVeg}</strong>
                </div>
                <div className="event-metric-pill">
                  <span className="event-metric-label">מנות ילדים</span>
                  <strong className="event-metric-value">{stats.totalKids}</strong>
                </div>
              </div>
            )}
          </div>

          <aside className="event-dashboard-aside">
            <div className="event-aside-card event-response-ring">
              <h3 className="event-aside-title">אחוז מענה</h3>
              <ProgressRing
                value={responseRate}
                max={100}
                size={112}
                stroke={10}
                color={ringColor}
                label={`${responseRate}%`}
              />
              <p className="event-aside-caption">
                {stats.total - stats.notAnswered} מתוך {stats.total} ענו
              </p>
            </div>
            <RecentResponses items={timeline?.recent || []} />
          </aside>
        </div>
      </section>

      {mapSrc && (
        <section className="card event-panel-section event-map-section" aria-labelledby="event-map-heading">
          <div className="event-section-head event-section-head--row">
            <div>
              <h2 id="event-map-heading" className="event-section-title">
                מיקום האירוע
              </h2>
              {venueLabel ? <p className="event-section-sub">{venueLabel}</p> : null}
            </div>
            {mapHref && (
              <a className="btn btn-accent" href={mapHref} target="_blank" rel="noreferrer">
                פתח במפות
              </a>
            )}
          </div>
          <div className="map-wrap event-map-wrap">
            <iframe title="מפת האירוע" src={mapSrc} loading="lazy" />
          </div>
        </section>
      )}

      <section className="card event-panel-section event-guests-section" aria-labelledby="event-guests-heading">
        <header className="event-guests-toolbar">
          <div>
            <h2 id="event-guests-heading" className="event-section-title">
              אורחים ותשובות
            </h2>
            <p className="event-section-sub">
              {loading ? "טוען..." : `${filteredGuests.length} מתוך ${guests.length} מוצגים`}
            </p>
          </div>
          <div className="event-guests-filters">
            <label className="field event-filter-field">
              <span>חיפוש</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="שם או טלפון" />
            </label>
            <label className="field event-filter-field">
              <span>סינון</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">הכל</option>
                <option value="מגיעים">מגיעים</option>
                <option value="לא מגיעים">לא מגיעים</option>
                <option value="לא יודעים">לא יודעים</option>
                <option value="לא ענו">לא ענו</option>
              </select>
            </label>
          </div>
        </header>

        {notice ? <p className="banner banner-info event-notice">{notice}</p> : null}

        {loading ? (
          <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
        ) : (
          <GuestTable guests={filteredGuests} eventId={eventId} embedded />
        )}
      </section>
    </div>
  );
}
