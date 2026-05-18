import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Minus, Plus } from "lucide-react";
import { apiFetch } from "../lib/api.js";
import { Icon } from "../components/Icons.jsx";
import Spinner from "../components/Spinner.jsx";
import { fireConfetti } from "../lib/confetti.js";

const steps = ["סטטוס הגעה", "כמות מגיעים", "מנות מיוחדות", "סיום"];

function eventTitle(ev) {
  return ev?.event_name ?? ev?.name ?? "אירוע";
}

function formatEventWhen(ev) {
  const raw = ev?.event_date ?? ev?.date;
  if (!raw) return null;
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "long", timeStyle: "short" }).format(new Date(raw));
  } catch (_e) {
    return String(raw);
  }
}

function buildMapLinks({ mapsUrl, venueName, fallbackEventName }) {
  const venue = (venueName || fallbackEventName || "").trim();
  const raw = (mapsUrl || "").trim();

  const googleSearch = (q) =>
    q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
  const wazeSearch = (q) => (q ? `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes` : null);

  // If we have no explicit URL, fall back to search by venue/event name.
  if (!raw) {
    const query = venue || "";
    return { google: googleSearch(query), waze: wazeSearch(query) };
  }

  // If already Waze link, keep it and also provide a Google fallback by venue (if any).
  if (/waze\.com\/ul/i.test(raw)) {
    return { google: googleSearch(venue), waze: raw };
  }

  // Google Maps share links / "maps.app.goo.gl" should work as-is.
  if (/maps\.app\.goo\.gl/i.test(raw)) {
    return { google: raw, waze: wazeSearch(venue) };
  }

  // If an iframe/embed snippet was saved, extract the src.
  if (raw.includes("<iframe")) {
    const m = raw.match(/src=["']([^"']+)["']/i);
    const src = m?.[1] || "";
    return { google: src || googleSearch(venue), waze: wazeSearch(venue) };
  }

  // If it's a full URL (Google Maps, short links, etc.), use as Google.
  if (/^https?:\/\//i.test(raw)) {
    // If it's a Google "search" URL, it will still open fine.
    return { google: raw, waze: wazeSearch(venue) };
  }

  // Otherwise treat it as a plain address text.
  return { google: googleSearch(raw), waze: wazeSearch(raw) };
}

function googleCalendarUrl(title, startIso) {
  const text = encodeURIComponent(title);
  if (!startIso) return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}`;
  try {
    const d = new Date(startIso);
    const pad = (n) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const start = `${y}${m}${day}T${hh}${mm}00`;
    const endDate = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    const end = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}`;
  } catch (_e) {
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}`;
  }
}

export default function RSVPPage() {
  const { token } = useParams();
  const [step, setStep] = useState(0);
  const [context, setContext] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [fullInviteOpen, setFullInviteOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    status: "מגיע",
    attendeesCount: 1,
    vegetarianCount: 0,
    kidsMealsCount: 0
  });
  const [customQty, setCustomQty] = useState(false);

  useEffect(() => {
    setPageLoading(true);
    apiFetch(`/rsvp/${token}`)
      .then((data) => {
        setContext(data);
        if (data.response) {
          const r = data.response;
          setForm({
            status: r.status || "מגיע",
            attendeesCount: Number(r.attendees_count ?? r.guest_count ?? 1) || 1,
            vegetarianCount: Number(r.vegetarian_count ?? 0) || 0,
            kidsMealsCount: Number(r.kids_meals_count ?? 0) || 0
          });
        }
      })
      .catch((error) => setNotice(error.message))
      .finally(() => setPageLoading(false));
  }, [token]);

  useEffect(() => {
    if (!fullInviteOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setFullInviteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullInviteOpen]);

  const guestName = context?.guest?.full_name || "";
  const ev = context?.guest?.events;
  const maxMealCount = useMemo(() => Number(form.attendeesCount || 0), [form.attendeesCount]);

  const mapLinks = useMemo(() => {
    return buildMapLinks({
      mapsUrl: ev?.maps_url,
      venueName: ev?.venue_name,
      fallbackEventName: ev?.event_name || ev?.name
    });
  }, [ev]);

  const invitationImageUrl = ev?.invitation_image_url || null;

  const submitAll = async () => {
    try {
      setLoading(true);
      setNotice("");
      setFieldErrors({});
      const attending = form.status === "מגיע";
      const payload = {
        status: form.status,
        attendeesCount: form.status === "לא מגיע" ? 0 : Number(form.attendeesCount || 1),
        vegetarianCount: attending ? Number(form.vegetarianCount || 0) : 0,
        kidsMealsCount: attending ? Number(form.kidsMealsCount || 0) : 0
      };
      const saved = await apiFetch(`/rsvp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (saved?.warnings?.length) {
        const first = saved.warnings[0];
        if (first?.message) setNotice(first.message);
      }
      setStep(3);
      void fireConfetti();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (step === 0 && form.status === "לא מגיע") {
      void submitAll();
      return;
    }
    if (step === 1) {
      const n = Number(form.attendeesCount);
      if (!Number.isFinite(n) || n < 1) {
        setFieldErrors({ attendeesCount: "נא להזין כמות מגיעים תקינה (לפחות 1)." });
        return;
      }
      setNotice("");
      setFieldErrors({});
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  useEffect(() => {
    if (step === 3) void fireConfetti();
  }, [step]);

  if (pageLoading) {
    return (
      <div className="rsvp-premium-bg">
        <div className="rsvp-shell">
          <Spinner label="טוען את ההזמנה..." />
        </div>
      </div>
    );
  }

  const eventWhen = formatEventWhen(ev);

  return (
    <div className="rsvp-premium-bg">
      <div className="rsvp-shell">
        <article className="rsvp-glass-card">
          <header className={invitationImageUrl ? "rsvp-invite-hero" : "rsvp-invite-hero rsvp-invite-hero--plain"}>
            {invitationImageUrl ? (
              <>
                <img src={invitationImageUrl} alt="" loading="lazy" />
                <div className="rsvp-invite-overlay">
                  {guestName ? <span className="rsvp-guest-chip">{guestName}</span> : null}
                  <h1>{eventTitle(ev)}</h1>
                  {eventWhen ? <p className="rsvp-meta-line">{eventWhen}</p> : null}
                  {ev?.venue_name ? <p className="rsvp-meta-line">{ev.venue_name}</p> : null}
                </div>
              </>
            ) : (
              <div className="rsvp-invite-overlay" style={{ position: "relative", minHeight: 160 }}>
                {guestName ? <span className="rsvp-guest-chip">{guestName}</span> : null}
                <h1>{eventTitle(ev)}</h1>
                <p className="rsvp-meta-line">{guestName ? `${guestName}, נשמח לאישור הגעה` : "אישור הגעה"}</p>
              </div>
            )}
          </header>

          <section className="rsvp-card-inner">
            <div className="rsvp-progress" aria-hidden="true">
              {steps.map((_, index) => (
                <span key={index} className={`rsvp-progress-seg ${index <= step ? "done" : ""}`} />
              ))}
            </div>

            {step === 0 && (
              <div key="step-0" className="rsvp-step-panel">
                <h3 className="rsvp-step-title">האם תגיעו לאירוע?</h3>
                <div className="rsvp-status-cards">
                  {[
                    { status: "מגיע", cls: "yes", emoji: "✅", sub: "נשמח לראותכם" },
                    { status: "לא מגיע", cls: "no", emoji: "❌", sub: "מצטערים שלא תגיעו" },
                    { status: "לא יודע", cls: "maybe", emoji: "❓", sub: "עדיין לא בטוחים" }
                  ].map(({ status, cls, emoji, sub }) => (
                    <button
                      key={status}
                      type="button"
                      className={`rsvp-status-card ${cls} ${form.status === status ? "selected" : ""}`}
                      onClick={() => setForm((prev) => ({ ...prev, status }))}
                    >
                      <span className="rsvp-status-emoji" aria-hidden="true">{emoji}</span>
                      <span>
                        <strong>{status}</strong>
                        <span className="hint" style={{ display: "block", marginTop: 4 }}>{sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="hint">אם בחרת &quot;לא מגיע&quot;, נשמור את התשובה מיד.</p>
              </div>
            )}

            {step === 1 && (
              <div key="step-1" className="rsvp-step-panel">
                <h3 className="rsvp-step-title">כמה אורחים מגיעים?</h3>
                <p className="hint" style={{ marginBottom: 12 }}>בחרו מספר או הזינו יותר מ-10</p>
                <div className="rsvp-qty-grid">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rsvp-qty-btn ${!customQty && form.attendeesCount === n ? "selected" : ""}`}
                      onClick={() => {
                        setCustomQty(false);
                        setForm((p) => ({ ...p, attendeesCount: n }));
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label className="field" style={{ marginTop: 14 }}>
                  <span>יותר מ-10</span>
                  <input
                    type="number"
                    min="11"
                    max="99"
                    value={customQty ? form.attendeesCount : ""}
                    placeholder="הזינו מספר"
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setCustomQty(true);
                      setForm((p) => ({ ...p, attendeesCount: Math.min(99, Math.max(11, n)) }));
                    }}
                  />
                </label>
                {fieldErrors.attendeesCount ? <div className="field-error">{fieldErrors.attendeesCount}</div> : null}
              </div>
            )}

            {step === 2 && (
              <div key="step-2" className="rsvp-step-panel">
                <h3 className="rsvp-step-title">מנות מיוחדות</h3>
                {form.status !== "מגיע" ? (
                  <p className="hint">לא נדרשות מנות מיוחדות לפי הסטטוס שבחרת.</p>
                ) : (
                  <div className="meal-cards meal-cards-premium">
                    <div className="meal-card meal-card-veg">
                      <span className="meal-card-emoji">🌿</span>
                      <span className="meal-card-label">צמחוני</span>
                      <div className="qty-stepper meal-qty">
                        <button type="button" className="qty-btn-round" onClick={() => setForm((p) => ({ ...p, vegetarianCount: Math.max(0, p.vegetarianCount - 1) }))} aria-label="הפחת צמחוני"><Minus size={18} /></button>
                        <span className="qty-value">{form.vegetarianCount}</span>
                        <button type="button" className="qty-btn-round" onClick={() => setForm((p) => ({ ...p, vegetarianCount: Math.min(maxMealCount, p.vegetarianCount + 1) }))} aria-label="הוסף צמחוני"><Plus size={18} /></button>
                      </div>
                    </div>
                    <div className="meal-card meal-card-kids">
                      <span className="meal-card-emoji">🧒</span>
                      <span className="meal-card-label">מנות ילדים</span>
                      <div className="qty-stepper meal-qty">
                        <button type="button" className="qty-btn-round" onClick={() => setForm((p) => ({ ...p, kidsMealsCount: Math.max(0, p.kidsMealsCount - 1) }))} aria-label="הפחת ילדים"><Minus size={18} /></button>
                        <span className="qty-value">{form.kidsMealsCount}</span>
                        <button type="button" className="qty-btn-round" onClick={() => setForm((p) => ({ ...p, kidsMealsCount: Math.min(maxMealCount, p.kidsMealsCount + 1) }))} aria-label="הוסף ילדים"><Plus size={18} /></button>
                      </div>
                    </div>
                  </div>
                )}
                {form.status === "מגיע" && (
                  <p className="rsvp-meal-summary hint">
                    סיכום: {form.attendeesCount} אורחים · {form.vegetarianCount} צמחוני · {form.kidsMealsCount} ילדים
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div key="step-3" className="rsvp-step-panel rsvp-success success-box">
                <div className="rsvp-success-check">
                  <Check size={36} strokeWidth={3} />
                </div>
                <h3 className="success-title">תודה{guestName ? ` ${guestName}` : ""}! אישרתם הגעה</h3>
                {form.status === "מגיע" && (
                  <p className="hint">
                    {form.attendeesCount} אורחים · {form.vegetarianCount} מנות צמחוניות · {form.kidsMealsCount} מנות ילדים
                  </p>
                )}
                <div className="rsvp-gadgets">
                  <a className="btn btn-gold" href={googleCalendarUrl(eventTitle(ev), ev?.event_date ?? ev?.date)} target="_blank" rel="noreferrer">📅 הוסף ליומן</a>
                  {mapLinks?.waze && <a className="btn" href={mapLinks.waze} target="_blank" rel="noreferrer">🔵 Waze</a>}
                  {mapLinks?.google && <a className="btn btn-accent" href={mapLinks.google} target="_blank" rel="noreferrer">🗺️ Google Maps</a>}
                </div>
              </div>
            )}

            <div className="rsvp-footer-actions">
              {step > 0 && step < 3 && (
                <button className="btn" type="button" onClick={prev} disabled={loading}>חזרה</button>
              )}
              {step === 0 && (
                <button className="btn btn-accent btn-ripple" type="button" onClick={next} disabled={loading}>
                  {form.status === "לא מגיע" ? (loading ? "שומר..." : "שמירת תשובה") : "המשך"}
                </button>
              )}
              {step === 1 && (
                <button className="btn btn-accent btn-ripple" type="button" onClick={next} disabled={loading}>המשך</button>
              )}
              {step === 2 && (
                <button className="btn btn-gold btn-ripple" type="button" onClick={submitAll} disabled={loading}>
                  {loading ? "שומר..." : "שליחת אישור"}
                </button>
              )}
            </div>
            {notice && <p className="status">{notice}</p>}
          </section>
        </article>

      {ev && (
        <section className="rsvp-glass-card rsvp-details" style={{ marginTop: 16 }}>
          <div className="details-head">
            <div>
              <h3 style={{ margin: 0 }}>פרטי הגעה</h3>
              <p className="hint" style={{ marginTop: 8 }}>
                כל מה שצריך ליום האירוע — במקום אחד.
              </p>
            </div>
            <div className="details-actions">
              <a className="btn btn-gold" href={googleCalendarUrl(eventTitle(ev), ev?.event_date ?? ev?.date)} target="_blank" rel="noreferrer">
                הוסף ליומן
              </a>
              {mapLinks?.google ? (
                <a className="btn btn-accent" href={mapLinks.google} target="_blank" rel="noreferrer">
                  גוגל מפות
                </a>
              ) : null}
              {mapLinks?.waze ? (
                <a className="btn" href={mapLinks.waze} target="_blank" rel="noreferrer">
                  Waze
                </a>
              ) : null}
            </div>
          </div>

          <div className="details-grid">
            <div className="info-row">
              <div className="info-icon" aria-hidden="true">
                <Icon name="sparkle" size={18} />
              </div>
              <div className="info-body">
                <div className="info-label">שם האירוע</div>
                <div className="info-value">{eventTitle(ev)}</div>
              </div>
            </div>

            <div className="info-row">
              <div className="info-icon" aria-hidden="true">
                <Icon name="pin" size={18} />
              </div>
              <div className="info-body">
                <div className="info-label">מיקום</div>
                <div className="info-value">{ev.venue_name || "יעודכן בהמשך"}</div>
              </div>
            </div>

            <div className="info-row">
              <div className="info-icon" aria-hidden="true">
                <Icon name="parking" size={18} />
              </div>
              <div className="info-body">
                <div className="info-label">חניה</div>
                <div className="info-value">{ev.parking_info || "פרטי חניה יישלחו בהמשך"}</div>
              </div>
            </div>

            <div className="info-row">
              <div className="info-icon" aria-hidden="true">
                <Icon name="phone" size={18} />
              </div>
              <div className="info-body">
                <div className="info-label">יצירת קשר</div>
                <div className="info-value">{ev.contact_phone || "אין מספר זמין"}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className="footer-mini" role="contentinfo">
        <span>© {new Date().getFullYear()} הושבה כיד המלך</span>
        <span className="actions">
          <a href="/privacy">פרטיות</a>
          <a href="/terms">תנאי שימוש</a>
        </span>
      </footer>

      {invitationImageUrl && fullInviteOpen && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="תצוגה מלאה של תמונת ההזמנה" onMouseDown={() => setFullInviteOpen(false)}>
          <div className="lightbox-inner" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="lightbox-close" onClick={() => setFullInviteOpen(false)} aria-label="סגור">
              ×
            </button>
            <img src={invitationImageUrl} alt="תמונת הזמנה בגודל מלא" />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
