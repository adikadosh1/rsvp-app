import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [lastEventId, setLastEventId] = useState(null);
  const [eventForm, setEventForm] = useState({
    eventName: "",
    eventDate: "",
    venueName: "",
    mapsUrl: "",
    parkingInfo: "",
    contactPhone: ""
  });
  const [notice, setNotice] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  useEffect(() => {
    try {
      setLastEventId(localStorage.getItem("hkham:lastEventId"));
    } catch (_e) {
      setLastEventId(null);
    }

    setEventsLoading(true);
    apiFetch("/events")
      .then((list) => setEvents(Array.isArray(list) ? list : []))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, []);

  const createEvent = async (e) => {
    e.preventDefault();
    try {
      setNotice("");
      setIsCreatingEvent(true);
      const data = await apiFetch("/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...eventForm,
          eventDate: new Date(eventForm.eventDate).toISOString()
        })
      });
      toast.push({ tone: "success", title: "אירוע נוצר", message: "הועברת לדשבורד האירוע." });
      navigate(`/events/${data.id}`);
    } catch (error) {
      setNotice(error.message || "יצירת אירוע נכשלה");
      toast.push({ tone: "danger", title: "יצירת אירוע נכשלה", message: error.message });
    } finally {
      setIsCreatingEvent(false);
    }
  };

  return (
    <div className="grid">
      {lastEventId ? (
        <section className="card">
          <div className="actions-row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0 }}>כניסה מהירה</h2>
              <p className="hint" style={{ marginTop: 8 }}>
                חזרה לפאנל של האירוע האחרון שפתחת (כולל סטטיסטיקות בזמן אמת).
              </p>
            </div>
            <div className="actions">
              <button className="btn btn-accent" type="button" onClick={() => navigate(`/events/${lastEventId}`)}>
                פאנל האירוע
              </button>
              <button className="btn btn-gold" type="button" onClick={() => navigate(`/manage/${lastEventId}`)}>
                העלאה ושליחה
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="actions-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>Self‑Serve לבעל אירוע</h2>
            <p className="hint" style={{ marginTop: 8 }}>
              צור קישור אישי לבעל האירוע — והוא ימלא פרטים ויעלה מוזמנים לבד.
            </p>
          </div>
          <div className="actions">
            <button className="btn btn-gold" type="button" onClick={() => navigate("/start")}>
              צור קישור לבעל אירוע
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="actions-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>אירועים אחרונים</h2>
            <p className="hint" style={{ marginTop: 8 }}>
              כניסה מהירה לדשבורד או לשליחה.
            </p>
          </div>
          <div className="actions">
            <button
              className="btn"
              type="button"
              onClick={() => {
                setEventsLoading(true);
                apiFetch("/events")
                  .then((list) => setEvents(Array.isArray(list) ? list : []))
                  .catch(() => setEvents([]))
                  .finally(() => setEventsLoading(false));
              }}
            >
              רענן
            </button>
          </div>
        </div>

        {eventsLoading ? (
          <div className="event-cards">
            {[1, 2, 3].map((i) => (
              <div key={i} className="event-card">
                <div className="skeleton" style={{ height: 18, width: "70%", marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 12, width: "45%", marginBottom: 14 }} />
                <div className="actions">
                  <div className="skeleton" style={{ height: 36, width: 120 }} />
                  <div className="skeleton" style={{ height: 36, width: 120 }} />
                </div>
              </div>
            ))}
          </div>
        ) : events.length ? (
          <div className="event-cards">
            {events.slice(0, 6).map((ev) => (
              <div key={ev.id} className="event-card">
                <div className="event-card-title">{ev.event_name || "אירוע"}</div>
                <div className="event-card-sub">
                  {ev.event_date ? new Date(ev.event_date).toLocaleString("he-IL") : "תאריך לא מוגדר"}
                </div>
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-accent" type="button" onClick={() => navigate(`/events/${ev.id}`)}>
                    לדשבורד
                  </button>
                  <button className="btn btn-gold" type="button" onClick={() => navigate(`/manage/${ev.id}`)}>
                    העלאה ושליחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">עדיין אין אירועים. צור אירוע חדש כדי להתחיל.</div>
        )}
      </section>

      <section className="card">
        <h2>יצירת אירוע חדש</h2>
        <form className="form-grid" onSubmit={createEvent}>
          <label className="field">
            <span>שם האירוע</span>
            <input
              required
              value={eventForm.eventName}
              onChange={(e) => setEventForm((prev) => ({ ...prev, eventName: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>תאריך ושעה</span>
            <input
              type="datetime-local"
              required
              value={eventForm.eventDate}
              onChange={(e) => setEventForm((prev) => ({ ...prev, eventDate: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>שם המקום</span>
            <input
              value={eventForm.venueName}
              onChange={(e) => setEventForm((prev) => ({ ...prev, venueName: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>קישור ניווט</span>
            <input
              value={eventForm.mapsUrl}
              onChange={(e) => setEventForm((prev) => ({ ...prev, mapsUrl: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>מידע חניה</span>
            <input
              value={eventForm.parkingInfo}
              onChange={(e) => setEventForm((prev) => ({ ...prev, parkingInfo: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>טלפון ליצירת קשר</span>
            <input
              value={eventForm.contactPhone}
              onChange={(e) => setEventForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
            />
          </label>
          <button className="btn btn-gold" type="submit" disabled={isCreatingEvent}>
            {isCreatingEvent ? "יוצר אירוע..." : "צור אירוע"}
          </button>
        </form>
        {notice && <p className="status">{notice}</p>}
      </section>
    </div>
  );
}
