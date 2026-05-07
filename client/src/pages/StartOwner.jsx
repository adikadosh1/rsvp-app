import { useState } from "react";
import { apiFetch } from "../lib/api.js";
import { useToast } from "../components/ToastProvider.jsx";
import BrandHeader from "../components/BrandHeader.jsx";

export default function StartOwner() {
  const toast = useToast();
  const [form, setForm] = useState({
    eventName: "",
    eventDate: "",
    venueName: "",
    mapsUrl: "",
    parkingInfo: "",
    contactPhone: ""
  });
  const [loading, setLoading] = useState(false);
  const [ownerUrl, setOwnerUrl] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setNotice("");
      setOwnerUrl("");
      const data = await apiFetch("/public/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          eventDate: new Date(form.eventDate).toISOString()
        })
      });
      setOwnerUrl(data.ownerUrl);
      if (Array.isArray(data.warnings) && data.warnings.length) {
        setNotice(
          `${data.warnings[0]}\n\nSQL להרצה ב‑Supabase SQL Editor:\n` +
            "alter table public.events add column if not exists venue_name text;\n" +
            "alter table public.events add column if not exists maps_url text;\n" +
            "alter table public.events add column if not exists parking_info text;\n" +
            "alter table public.events add column if not exists contact_phone text;\n"
        );
        toast.push({ tone: "warning", title: "שימו לב", message: "חסרות עמודות בסופאבייס לשמירת פרטי המקום." });
      }
      toast.push({ tone: "success", title: "נוצר קישור לבעל האירוע", message: "אפשר להעתיק ולשלוח לבעל האירוע." });
    } catch (err) {
      setNotice(err.message);
      toast.push({ tone: "danger", title: "יצירה נכשלה", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <BrandHeader />
      <div className="grid">
        <section className="hero card">
          <div className="hero-inner">
            <div className="hero-kicker">SELF‑SERVE PORTAL</div>
            <h1 className="hero-title">
              יוצרים לבעל האירוע <span>קישור אישי</span> ומסיימים עבודה
            </h1>
            <p className="hero-sub">
              בעל האירוע ימלא פרטי אירוע, יעלה מוזמנים, יבצע תצוגה מקדימה וישלח הודעות — בלי שתצטרך ללוות אותו ידנית.
            </p>
            <div className="hero-steps">
              <div className="hero-step">
                <div className="hero-step-num">1</div>
                <div className="hero-step-txt">פרטי אירוע</div>
              </div>
              <div className="hero-step">
                <div className="hero-step-num">2</div>
                <div className="hero-step-txt">מוזמנים CSV</div>
              </div>
              <div className="hero-step">
                <div className="hero-step-num">3</div>
                <div className="hero-step-txt">הודעה + תמונה</div>
              </div>
              <div className="hero-step">
                <div className="hero-step-num">4</div>
                <div className="hero-step-txt">שליחה + תזכורות</div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>פרטי אירוע בסיסיים</h2>
          <p className="hint">אלו הפרטים הראשוניים ליצירת הקישור. בעל האירוע יוכל לערוך הכל בפורטל.</p>
          <form className="form-grid" onSubmit={submit}>
            <label className="field">
              <span>שם האירוע</span>
              <input required value={form.eventName} onChange={(e) => setForm((p) => ({ ...p, eventName: e.target.value }))} />
            </label>
            <label className="field">
              <span>תאריך ושעה</span>
              <input
                type="datetime-local"
                required
                value={form.eventDate}
                onChange={(e) => setForm((p) => ({ ...p, eventDate: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>שם המקום</span>
              <input value={form.venueName} onChange={(e) => setForm((p) => ({ ...p, venueName: e.target.value }))} />
            </label>
            <label className="field">
              <span>קישור ניווט / כתובת</span>
              <input value={form.mapsUrl} onChange={(e) => setForm((p) => ({ ...p, mapsUrl: e.target.value }))} />
            </label>
            <label className="field">
              <span>מידע חניה</span>
              <input value={form.parkingInfo} onChange={(e) => setForm((p) => ({ ...p, parkingInfo: e.target.value }))} />
            </label>
            <label className="field">
              <span>טלפון ליצירת קשר (יופיע לאורחים)</span>
              <input value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} />
            </label>
            <button className="btn btn-gold" type="submit" disabled={loading}>
              {loading ? "יוצר קישור..." : "צור קישור לבעל האירוע"}
            </button>
          </form>
          {notice && <p className="status">{notice}</p>}
        </section>

        {ownerUrl && (
          <section className="card">
            <h3>הקישור לבעל האירוע</h3>
            <p className="hint">שלח את הקישור הזה לבעל האירוע. זה הקישור היחיד שהוא צריך.</p>
            <div className="share-box share-box-hero">
              <input value={ownerUrl} readOnly />
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(ownerUrl);
                    toast.push({ tone: "success", title: "הועתק", message: "הקישור הועתק ללוח." });
                  } catch (_e) {
                    toast.push({ tone: "warning", title: "לא הועתק", message: "הדפדפן חסם העתקה. העתק ידנית." });
                  }
                }}
              >
                העתק
              </button>
              <a className="btn btn-accent" href={ownerUrl} target="_blank" rel="noreferrer">
                פתח פורטל
              </a>
            </div>
          </section>
        )}
      </div>

      <footer className="footer-mini" role="contentinfo">
        <span>© {new Date().getFullYear()} הושבה כיד המלך</span>
        <span className="actions">
          <a href="/privacy">פרטיות</a>
          <a href="/terms">תנאי שימוש</a>
        </span>
      </footer>
    </div>
  );
}

