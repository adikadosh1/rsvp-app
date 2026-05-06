import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api.js";

const steps = ["סטטוס הגעה", "כמות מגיעים", "מנות מיוחדות", "סיום"];

export default function RSVPPage() {
  const { token } = useParams();
  const [step, setStep] = useState(0);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    status: "מגיע",
    attendeesCount: 1,
    vegetarianCount: 0,
    kidsMealsCount: 0
  });

  useEffect(() => {
    apiFetch(`/rsvp/${token}`)
      .then((data) => {
        setContext(data);
        if (data.response) {
          setForm({
            status: data.response.status,
            attendeesCount: data.response.attendees_count,
            vegetarianCount: data.response.vegetarian_count,
            kidsMealsCount: data.response.kids_meals_count
          });
        }
      })
      .catch((error) => setNotice(error.message));
  }, [token]);

  const maxMealCount = useMemo(() => Number(form.attendeesCount || 0), [form.attendeesCount]);

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    try {
      setLoading(true);
      setNotice("");
      await apiFetch(`/rsvp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      setStep(3);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rsvp-page">
      <section className="card">
        <h2>אישור הגעה לאירוע</h2>
        <p className="hint">
          {context?.guest?.full_name ? `${context.guest.full_name}, שמחים להזמין אותך` : "טוען הזמנה..."}
        </p>
        <div className="steps-indicator">
          {steps.map((label, index) => (
            <span key={label} className={index === step ? "active" : ""}>
              {label}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="step-box">
            <h3>האם תגיעו לאירוע?</h3>
            <div className="choice-row">
              {["מגיע", "לא מגיע", "לא יודע"].map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`pill ${form.status === status ? "selected" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, status }))}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="step-box">
            <h3>כמה אורחים מגיעים?</h3>
            <input
              type="number"
              min="1"
              max="20"
              value={form.attendeesCount}
              onChange={(e) => setForm((prev) => ({ ...prev, attendeesCount: Number(e.target.value) || 1 }))}
            />
            <p className="hint">ניתן להזין גם מעל 10 לפי הצורך.</p>
          </div>
        )}

        {step === 2 && (
          <div className="step-box">
            <h3>מנות מיוחדות</h3>
            <label className="field">
              <span>כמות מנות צמחוניות</span>
              <input
                type="number"
                min="0"
                max={maxMealCount}
                value={form.vegetarianCount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    vegetarianCount: Math.min(maxMealCount, Number(e.target.value) || 0)
                  }))
                }
              />
            </label>
            <label className="field">
              <span>כמות מנות ילדים</span>
              <input
                type="number"
                min="0"
                max={maxMealCount}
                value={form.kidsMealsCount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    kidsMealsCount: Math.min(maxMealCount, Number(e.target.value) || 0)
                  }))
                }
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="step-box success-box">
            <h3>תודה! תשובתכם נשמרה בהצלחה</h3>
            <div className="actions">
              <a className="btn btn-gold" href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(context?.guest?.events?.event_name || "אירוע")}`} target="_blank" rel="noreferrer">
                הוסף ליומן
              </a>
              {context?.guest?.events?.maps_url && (
                <a className="btn" href={context.guest.events.maps_url} target="_blank" rel="noreferrer">
                  נווט לאירוע
                </a>
              )}
            </div>
          </div>
        )}

        <div className="actions">
          {step > 0 && step < 3 && (
            <button className="btn" type="button" onClick={prev}>
              חזרה
            </button>
          )}
          {step < 2 && (
            <button className="btn btn-gold" type="button" onClick={next}>
              המשך
            </button>
          )}
          {step === 2 && (
            <button className="btn btn-gold" type="button" onClick={submit} disabled={loading}>
              {loading ? "שומר..." : "שליחת אישור"}
            </button>
          )}
        </div>
        {notice && <p className="status">{notice}</p>}
      </section>

      {context?.guest?.events && (
        <section className="card">
          <h3>פרטי הגעה ויצירת קשר</h3>
          <p>מיקום: {context.guest.events.venue_name || "יעודכן בהמשך"}</p>
          <p>חניה: {context.guest.events.parking_info || "פרטי חניה יישלחו בהמשך"}</p>
          <p>יצירת קשר: {context.guest.events.contact_phone || "אין מספר זמין"}</p>
          {context.guest.events.maps_url && (
            <a href={context.guest.events.maps_url} target="_blank" rel="noreferrer">
              פתיחת המפה
            </a>
          )}
        </section>
      )}
    </div>
  );
}
