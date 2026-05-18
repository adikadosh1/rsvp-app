import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import GuestTable from "../components/GuestTable.jsx";
import ProgressRing from "../components/ProgressRing.jsx";
import { RSVPDonut, ResponsesByHour, RecentResponses } from "../components/DashboardCharts.jsx";
import CountdownFlip from "../components/CountdownFlip.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { apiFetch } from "../lib/api.js";
import { getBrowserSupabase } from "../lib/supabaseBrowser.js";
import { statusLabel } from "../utils/rsvpDisplay.js";

export default function EventDashboard() {
  const { eventId } = useParams();
  const toast = useToast();
  const prevAnsweredRef = useRef(0);
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const guestIdSetRef = useRef(new Set());
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | מגיעים | לא מגיעים | לא יודעים | לא ענו
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
    let mode = "poll10"; // poll10 | poll60
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
      // Realtime refresh on guest/response changes.
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
      // Keep a slow safety refresh even on realtime (upgraded/downgraded by status above).
      setIntervalMode("poll60");
    } else {
      setRt({ enabled: false, status: "off", lastUpdate: new Date().toISOString() });
      // Fallback polling when client supabase creds are not configured.
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
        // Works for any share link by using it as a query; also works for non-google URLs (best effort).
        return mkEmbed(raw);
      }
      // Plain address / venue / "lat,lng"
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
    if (responseRate >= 33) return "var(--gold)";
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

  return (
    <div className="grid">
      <PageHeader
        title="דשבורד אירוע"
        subtitle={loading ? "טוען..." : event?.event_name || "—"}
        breadcrumbs={[
          { label: "מסך ראשי", to: "/dashboard" },
          { label: "אירוע" }
        ]}
        actions={
          <>
            <span className={`rt-pill ${rt.status}`} role="status" aria-live="polite">
              {rt.enabled
                ? rt.status === "on"
                  ? "מחובר בזמן אמת"
                  : rt.status === "error"
                    ? "Realtime לא זמין"
                    : "מתחבר..."
                : "Polling"}
            </span>
            <Link className="btn btn-primary" to={`/manage/${eventId}`}>
              העלאה ושליחה
            </Link>
            <Link className="btn" to="/dashboard">
              חזרה
            </Link>
          </>
        }
      />

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

      <section className="card">
        <div className="dashboard-grid">
          <div className="dashboard-main">
            <div className="widget" style={{ marginBottom: 20 }}>
              <div className="widget-title">ספירה לאחור לאירוע</div>
              <CountdownFlip eventDate={event?.event_date || event?.date} eventName={event?.event_name} />
            </div>
            <div className="widgets-row">
              <div className="widget">
                <RSVPDonut stats={stats} />
              </div>
              <div className="widget">
                <ResponsesByHour items={responsesByHour} />
              </div>
            </div>
          </div>
          <aside className="dashboard-aside">
            <div className="card" style={{ padding: 20, marginBottom: 16, textAlign: "center" }}>
              <div className="widget-title" style={{ marginBottom: 12 }}>
                אחוז מענה
              </div>
              <ProgressRing
                value={responseRate}
                max={100}
                size={120}
                stroke={10}
                color={ringColor}
                label={`${responseRate}% מענה`}
              />
              <p className="hint" style={{ marginTop: 12 }}>
                {stats.total - stats.notAnswered} מתוך {stats.total} ענו
              </p>
            </div>
            <RecentResponses items={timeline?.recent || []} />
          </aside>
        </div>
      </section>

      {mapSrc && (
        <section className="card">
          <div className="actions-row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>מפה</h3>
            {mapHref && (
              <a className="btn" href={mapHref} target="_blank" rel="noreferrer">
                פתח בגוגל מפס
              </a>
            )}
          </div>
          <div className="map-wrap">
            <iframe title="מפת האירוע" src={mapSrc} loading="lazy" />
          </div>
        </section>
      )}

      {!loading && (
        <section className="card">
          <div className="stats-subrow">
            <div className="pill-chip">לא יודעים: <strong>{stats.uncertain}</strong></div>
            <div className="pill-chip">סה״כ סועדים: <strong>{stats.totalDiners}</strong></div>
            <div className="pill-chip">מנות צמחוניות: <strong>{stats.totalVeg}</strong></div>
            <div className="pill-chip">מנות ילדים: <strong>{stats.totalKids}</strong></div>
          </div>
        </section>
      )}

      <section className="card">
        <h3>חיפוש וסינון</h3>
        <div className="actions">
          <label className="field" style={{ minWidth: 220 }}>
            <span>חיפוש</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="שם / טלפון" />
          </label>
          <label className="field" style={{ minWidth: 220 }}>
            <span>פילטר</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">הכל</option>
              <option value="מגיעים">מגיעים</option>
              <option value="לא מגיעים">לא מגיעים</option>
              <option value="לא יודעים">לא יודעים</option>
              <option value="לא ענו">לא ענו</option>
            </select>
          </label>
          <button className="btn" type="button" onClick={() => load().catch((e) => setNotice(e.message))}>
            רענן
          </button>
        </div>
        {notice && <p className="status">{notice}</p>}
      </section>

      {loading ? (
        <section className="card">
          <div className="skeleton" style={{ height: 180 }} />
        </section>
      ) : (
        <GuestTable guests={filteredGuests} eventId={eventId} />
      )}
    </div>
  );
}
