import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import GuestTable from "../components/GuestTable.jsx";
import { apiFetch } from "../lib/api.js";

function getGuestStatus(guest) {
  return guest.latestResponse?.status || "טרם ענה";
}

export default function EventDashboard() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all"); // all | מגיעים | לא מגיעים | לא ענו
  const [query, setQuery] = useState("");

  const load = async () => {
    const [eventData, guestsData] = await Promise.all([apiFetch(`/events/${eventId}`), apiFetch(`/guests/${eventId}`)]);
    setEvent(eventData);
    setGuests(guestsData);
  };

  useEffect(() => {
    setNotice("");
    load().catch((e) => setNotice(e.message));
    const t = setInterval(() => load().catch(() => undefined), 10000);
    return () => clearInterval(t);
  }, [eventId]);

  const stats = useMemo(() => {
    const total = guests.length;
    const arrived = guests.filter((g) => getGuestStatus(g) === "מגיע").length;
    const notArrived = guests.filter((g) => getGuestStatus(g) === "לא מגיע").length;
    const notAnswered = guests.filter((g) => getGuestStatus(g) === "טרם ענה").length;
    return { total, arrived, notArrived, notAnswered };
  }, [guests]);

  const filteredGuests = useMemo(() => {
    const q = query.trim();
    return guests
      .filter((g) => {
        if (filter === "מגיעים") return getGuestStatus(g) === "מגיע";
        if (filter === "לא מגיעים") return getGuestStatus(g) === "לא מגיע";
        if (filter === "לא ענו") return getGuestStatus(g) === "טרם ענה";
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
      <section className="card actions-row">
        <div>
          <h2>דשבורד אירוע</h2>
          <p className="hint">{event?.event_name || "טוען..."}</p>
        </div>
        <div className="actions">
          <Link className="btn" to={`/manage/${eventId}`}>
            העלאת אורחים ושליחה
          </Link>
          <Link className="btn" to="/dashboard">
            חזרה למסך הראשי
          </Link>
        </div>
      </section>

      <section className="card">
        <h3>סטטיסטיקות</h3>
        <div className="stats-row">
          <div className="stat">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">סה״כ אורחים</div>
          </div>
          <div className="stat">
            <div className="stat-number">{stats.arrived}</div>
            <div className="stat-label">מגיעים</div>
          </div>
          <div className="stat">
            <div className="stat-number">{stats.notArrived}</div>
            <div className="stat-label">לא מגיעים</div>
          </div>
          <div className="stat">
            <div className="stat-number">{stats.notAnswered}</div>
            <div className="stat-label">לא ענו</div>
          </div>
        </div>
      </section>

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
              <option value="לא ענו">לא ענו</option>
            </select>
          </label>
          <button className="btn" type="button" onClick={() => load().catch((e) => setNotice(e.message))}>
            רענן
          </button>
        </div>
        {notice && <p className="status">{notice}</p>}
      </section>

      <GuestTable guests={filteredGuests} />
    </div>
  );
}

