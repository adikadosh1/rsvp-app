import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api.js";

export default function Dashboard() {
  const navigate = useNavigate();
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
      navigate(`/events/${data.id}`);
    } catch (error) {
      setNotice(error.message || "יצירת אירוע נכשלה");
    } finally {
      setIsCreatingEvent(false);
    }
  };

  return (
    <div className="grid">
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
