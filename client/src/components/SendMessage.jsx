import { useState } from "react";
import { apiBase, apiFetch } from "../lib/api.js";

export default function SendMessage({ eventId, onSent }) {
  const [messageTemplate, setMessageTemplate] = useState(
    "שלום {{שם}}, נשמח לאישור הגעתך לאירוע {{אירוע}}. לאישור מהיר לחצו כאן: {{לינק}}"
  );
  const [channel, setChannel] = useState("sms");
  const [imageFile, setImageFile] = useState(null);
  const [invitationImageUrl, setInvitationImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [failures, setFailures] = useState([]);

  const handleUploadImage = async () => {
    if (!imageFile) return null;
    const formData = new FormData();
    formData.append("invitationImage", imageFile);

    const response = await fetch(`${apiBase}/events/${eventId}/message-assets`, {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "שגיאה בהעלאת תמונה");
    return data.imageUrl;
  };

  const saveAndSend = async () => {
    try {
      setLoading(true);
      setFailures([]);
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

      setStatusText(`נשלחו ${sendResult.sent} הודעות בהצלחה. נכשלו ${sendResult.failed}.`);
      setFailures(sendResult.failures || []);
      onSent?.();
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h3>שליחת הודעות</h3>
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
