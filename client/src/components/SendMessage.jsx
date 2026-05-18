import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageCircle, Smartphone, Upload } from "lucide-react";
import { apiFetch } from "../lib/api.js";
import { useToast } from "./ToastProvider.jsx";

const TEMPLATE_CHIPS = [
  { token: "{{שם}}", label: "שם" },
  { token: "{{לינק}}", label: "קישור" },
  { token: "{{אירוע}}", label: "אירוע" }
];

const MAX_CHARS = 900;

export default function SendMessage({ eventId, onSent }) {
  const toast = useToast();
  const textareaRef = useRef(null);
  const [messageTemplate, setMessageTemplate] = useState(
    "שלום {{שם}}, נשמח לאישור הגעתך לאירוע {{אירוע}}. לאישור מהיר לחצו כאן: {{לינק}}"
  );
  const [channel, setChannel] = useState("sms");
  const [imageFile, setImageFile] = useState(null);
  const [invitationImageUrl, setInvitationImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [sendPhase, setSendPhase] = useState("idle"); // idle | loading | success
  const [statusText, setStatusText] = useState("");
  const [failures, setFailures] = useState([]);
  const [skippedList, setSkippedList] = useState([]);
  const [preflight, setPreflight] = useState(null);
  const [dragging, setDragging] = useState(false);

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

  const insertToken = (token) => {
    const el = textareaRef.current;
    if (!el) {
      setMessageTemplate((t) => `${t}${token}`);
      return;
    }
    const start = el.selectionStart ?? messageTemplate.length;
    const end = el.selectionEnd ?? start;
    const next = messageTemplate.slice(0, start) + token + messageTemplate.slice(end);
    setMessageTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleUploadImage = async () => {
    if (!imageFile) return invitationImageUrl || null;
    setUploadPct(8);
    const formData = new FormData();
    formData.append("invitationImage", imageFile);
    const data = await apiFetch(`/events/${eventId}/message-assets`, {
      method: "POST",
      body: formData
    });
    setUploadPct(100);
    return data.imageUrl;
  };

  const saveAndSend = async () => {
    try {
      setLoading(true);
      setSendPhase("loading");
      setFailures([]);
      setSkippedList([]);
      setStatusText("שומר ומכין שליחה...");

      let imageUrl = invitationImageUrl;
      if (imageFile) {
        setStatusText("מעלה תמונה...");
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
      setSendPhase("success");
      toast.push({
        tone: failed > 0 ? "warning" : "success",
        title: "סיכום שליחה",
        message: `נשלחו ${sent} | נכשלו ${failed} | דולגו ${skipped}`
      });
      onSent?.();
    } catch (error) {
      setStatusText(error.message);
      setSendPhase("idle");
      toast.push({ tone: "danger", title: "שליחה נכשלה", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const previewText = useMemo(() => {
    return messageTemplate
      .replace(/\{\{שם\}\}/g, "ישראל ישראלי")
      .replace(/\{\{אירוע\}\}/g, "החתונה שלנו")
      .replace(/\{\{לינק\}\}/g, "https://rsvp.example/abc");
  }, [messageTemplate]);

  const previewUrl = imageFile ? URL.createObjectURL(imageFile) : invitationImageUrl || "";
  const charCount = messageTemplate.length;

  const onPickFile = (file) => {
    if (!file) return;
    setImageFile(file);
    setUploadPct(0);
  };

  return (
    <section className="card send-message-pro">
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
              חסר שולח SMS בשרת: הגדרו <code>TWILIO_SMS_FROM</code> או <code>TWILIO_MESSAGING_SERVICE_SID</code>.
            </div>
          )}
          {channel === "whatsapp" && !preflight.twilioWhatsappFromSet && <div>חסר TWILIO_WHATSAPP_FROM בסביבת השרת.</div>}
        </div>
      )}

      <span className="field-help" style={{ display: "block", marginBottom: 8 }}>
        ערוץ שליחה
      </span>
      <div className="channel-picker">
        <button
          type="button"
          className={`channel-option sms ${channel === "sms" ? "selected" : ""}`}
          onClick={() => setChannel("sms")}
        >
          {channel === "sms" ? <span className="channel-check" aria-hidden="true">✓</span> : null}
          <Smartphone size={28} />
          <span>SMS</span>
        </button>
        <button
          type="button"
          className={`channel-option whatsapp ${channel === "whatsapp" ? "selected" : ""}`}
          onClick={() => setChannel("whatsapp")}
        >
          {channel === "whatsapp" ? <span className="channel-check" aria-hidden="true">✓</span> : null}
          <MessageCircle size={28} />
          <span>WhatsApp</span>
        </button>
      </div>

      <label className="field">
        <span>נוסח הודעה</span>
        <div className="template-chips">
          {TEMPLATE_CHIPS.map((c) => (
            <button key={c.token} type="button" className="template-chip" onClick={() => insertToken(c.token)}>
              {c.label}
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="message-editor"
          value={messageTemplate}
          rows={5}
          maxLength={MAX_CHARS}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder="אפשר להשתמש ב-{{שם}}, {{לינק}}, {{אירוע}}"
        />
        <div className="char-counter">
          {charCount} / {MAX_CHARS}
        </div>
      </label>

      <div className="send-preview-grid">
        <div className="wa-preview" aria-label="תצוגה מקדימה WhatsApp">
          <div className="wa-preview-header">
            <span className="wa-preview-avatar" aria-hidden="true">
              ה
            </span>
            <span>הושבה כיד המלך</span>
          </div>
          <div className="wa-preview-body">
            <div className="wa-bubble">
              {previewText}
              {previewUrl ? (
                <div className="chat-bubble-image">
                  <img src={previewUrl} alt="" />
                </div>
              ) : null}
              <div className="wa-bubble-time">{new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
        </div>
      </div>

      <label className="field">
        <span>תמונת הזמנה (אופציונלי)</span>
        <div
          className={`dropzone dropzone-pro ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onPickFile(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            type="file"
            accept="image/*"
            hidden
            id="invite-image-upload"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          />
          <label htmlFor="invite-image-upload" className="dropzone-content" style={{ cursor: "pointer" }}>
            <Upload className="dropzone-pro-icon" size={32} />
            <div className="dropzone-title">{imageFile ? imageFile.name : "גרור תמונה לכאן או לחץ לבחירה"}</div>
            <div className="dropzone-sub">PNG / JPG עד 8MB</div>
          </label>
          {previewUrl && (
            <div className="dropzone-preview">
              <img src={previewUrl} alt="תצוגה מקדימה" />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setImageFile(null);
                  setUploadPct(0);
                }}
              >
                הסרה
              </button>
            </div>
          )}
          {uploadPct > 0 && uploadPct < 100 && (
            <div className="upload-progress" role="progressbar" aria-valuenow={uploadPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="upload-progress-fill" style={{ width: `${uploadPct}%` }} />
            </div>
          )}
        </div>
      </label>

      <button
        type="button"
        className={`btn btn-send-gradient ${sendPhase === "success" ? "is-success" : ""}`}
        style={{ width: "100%", marginTop: 8 }}
        onClick={saveAndSend}
        disabled={loading || sendPhase === "success"}
      >
        {sendPhase === "success" ? (
          <>
            <Check size={18} /> נשלח בהצלחה
          </>
        ) : loading ? (
          "שולח..."
        ) : channel === "whatsapp" ? (
          <>
            <MessageCircle size={18} /> שמור ושלח ב-WhatsApp
          </>
        ) : (
          <>
            <Smartphone size={18} /> שמור ושלח ב-SMS
          </>
        )}
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
