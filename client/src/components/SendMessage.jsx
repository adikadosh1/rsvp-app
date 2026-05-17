import { useEffect, useState } from "react";
import { apiBase, apiFetch } from "../lib/api.js";
import { useToast } from "./ToastProvider.jsx";

export default function SendMessage({ eventId, onSent }) {
  const toast = useToast();
  const [messageTemplate, setMessageTemplate] = useState(
    "שלום {{שם}}, נשמח לאישור הגעתך לאירוע {{אירוע}}. לאישור מהיר לחצו כאן: {{לינק}}"
  );
  const [channel, setChannel] = useState("sms");
  const [imageFile, setImageFile] = useState(null);
  const [invitationImageUrl, setInvitationImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [failures, setFailures] = useState([]);
  const [skippedList, setSkippedList] = useState([]);
  const [preflight, setPreflight] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/events/${eventId}/send-preflight`)
      .then((data) => {
        if (!cancelled) setPreflight(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleUploadImage = async () => {
    if (!imageFile) return null;
    const formData = new FormData();
    formData.append("invitationImage", imageFile);
    const data = await apiFetch(`/events/${eventId}/message-assets`, {
      method: "POST",
      body: formData
    });
    return data.imageUrl;
  };

  const saveAndSend = async () => {
    try {
      setLoading(true);
      setFailures([]);
      setSkippedList([]);
      setStatusText("שומר ומכין שליחה...");

      let imageUrl = invitationImageUrl;
      if (imageFile) {
        imageUrl = await handleUploadImage();
        setInvitationImageUrl(imageUrl);
      }

      await apiFetch(`/events/${eventId}/message-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageTemplate, invitationImageUrl: imageUrl, channel })
      });

      setStatusText("שולח הודעות לכל האורחים...");
      const sendResult = await apiFetch(`/events/${eventId}/send-invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, invitationImageUrl: imageUrl })
      });

      const skipped = Number(sendResult.skipped || 0);
      const failed = Number(sendResult.failed || 0);
      const sent = Number(sendResult.sent || 0);
      setSkippedList(sendResult.skippedList || []);
      setFailures(sendResult.failures || []);

      setStatusText(
        `נשלחו ${sent} הודעות. נכשלו ${failed}. דולגו ${skipped}.${sendResult.sandboxHint ? ` ${sendResult.sandboxHint}` : ""}`
      );
      toast.push({
        tone: failed > 0 ? "warning" : "success",
        title: "סיכום שליחה",
        message: `נשלחו ${sent} | נכשלו ${failed} | דולגו ${skipped}`
      });
      onSent?.();
    } catch (error) {
      setStatusText(error.message);
      toast.push({ tone: "danger", title: "שליחה נכשלה", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h3>שליחת הודעות</h3>

      {preflight && (
        <div className="banner banner-info" role="status">
          <div>אורחים באירוע: {preflight.guestCount}</div>
          {preflight.invalidPhone > 0 && <div>מספרי טלפון לא תקינים: {preflight.invalidPhone}</div>}
          {preflight.missingToken > 0 && <div>חסר טוקן אישי: {preflight.missingToken}</div>}
          {!preflight.hasMessageTemplate && <div>נדרש לשמור נוסח הודעה לפני שליחה.</div>}
          {!preflight.publicAppUrlSet && <div>שים לב: חסר PUBLIC_APP_URL בשרת — הלינקים בהודעה עלולים להיות שגויים.</div>}
          {channel === "sms" && !preflight.twilioSmsFromSet && (
            <div>
              חסר שולח SMS בשרת: הגדרו <code>TWILIO_SMS_FROM</code> (מספר Twilio ל-SMS) או <code>TWILIO_MESSAGING_SERVICE_SID</code>. מספר Sandbox של
              WhatsApp לא שולח SMS רגיל.
            </div>
          )}
          {channel === "whatsapp" && !preflight.twilioWhatsappFromSet && <div>חסר TWILIO_WHATSAPP_FROM בסביבת השרת.</div>}
        </div>
      )}

      <label className="field">
        <span>ערוץ שליחה</span>
        <select value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </label>
      <label className="field">
        <span>נוסח הודעה</span>
        <textarea
          value={messageTemplate}
          rows={5}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder="אפשר להשתמש ב-{{שם}}, {{לינק}}, {{אירוע}}"
        />
      </label>
      <label className="field">
        <span>תמונת הזמנה (אופציונלי)</span>
        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
      </label>
      <button type="button" className="btn btn-gold" onClick={saveAndSend} disabled={loading}>
        {loading ? "מבצע שליחה..." : "שמור ושלח לכל האורחים"}
      </button>
      {statusText && <p className="status">{statusText}</p>}

      {skippedList.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4>דולגו (לדוגמה)</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>טלפון</th>
                  <th>סיבה</th>
                </tr>
              </thead>
              <tbody>
                {skippedList.map((f) => (
                  <tr key={f.guestId}>
                    <td>{f.name || "-"}</td>
                    <td>{f.phone || "-"}</td>
                    <td>{f.error || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {failures.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4>שגיאות שליחה (דוגמה)</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>טלפון</th>
                  <th>סיבה</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.guestId}>
                    <td>{f.name || "-"}</td>
                    <td>{f.phone || "-"}</td>
                    <td>{f.error || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">אם אתה ב-Twilio Sandbox, רק מספרים שהצטרפו לסנדבוקס יקבלו הודעות.</p>
        </div>
      )}
    </section>
  );
}
