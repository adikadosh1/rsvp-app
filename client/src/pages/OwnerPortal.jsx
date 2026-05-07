import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Papa from "papaparse";
import { apiFetch } from "../lib/api.js";
import { useToast } from "../components/ToastProvider.jsx";
import BrandHeader from "../components/BrandHeader.jsx";
import { guestsToCsvFile, parseVcfToGuests, pickGuestsFromContacts } from "../utils/contactsImport.js";

const wizardSteps = ["פרטי אירוע", "מוזמנים", "הודעה ותמונה", "שליחה"];

export default function OwnerPortal() {
  const { ownerToken } = useParams();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  const [csvFile, setCsvFile] = useState(null);
  const [previewGuests, setPreviewGuests] = useState([]);
  const [dupInFile, setDupInFile] = useState(0);
  const [importMode, setImportMode] = useState("add");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");

  // Messaging
  const [channel, setChannel] = useState("sms");
  const [messageTemplate, setMessageTemplate] = useState(
    "שלום {{שם}}, נשמח לאישור הגעתך לאירוע {{אירוע}}. לאישור מהיר לחצו כאן: {{לינק}}"
  );
  const [imageFile, setImageFile] = useState(null);
  const [invitationImageUrl, setInvitationImageUrl] = useState("");
  const [preflight, setPreflight] = useState(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendStatusText, setSendStatusText] = useState("");
  const [failures, setFailures] = useState([]);
  const [skippedList, setSkippedList] = useState([]);
  const [reminderText, setReminderText] = useState("נשמח לאישור הגעה בהקדם");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPick, setPreviewPick] = useState("first"); // first | random | guest_id
  const [sampleGuests, setSampleGuests] = useState([]);
  const [invalidPhones, setInvalidPhones] = useState(null);
  const [invalidLoading, setInvalidLoading] = useState(false);

  const form = useMemo(() => {
    if (!event) return null;
    const d = event.event_date ? new Date(event.event_date) : null;
    const pad = (n) => String(n).padStart(2, "0");
    const dtLocal =
      d && Number.isFinite(d.getTime())
        ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        : "";
    return {
      eventName: event.event_name || "",
      eventDate: dtLocal,
      venueName: event.venue_name || "",
      mapsUrl: event.maps_url || "",
      parkingInfo: event.parking_info || "",
      contactPhone: event.contact_phone || ""
    };
  }, [event]);

  const [edit, setEdit] = useState(null);

  useEffect(() => {
    setEdit(form);
  }, [form]);

  useEffect(() => {
    setLoading(true);
    setNotice("");
    apiFetch(`/public/owner/${ownerToken}`)
      .then((data) => setEvent(data.event))
      .catch((e) => setNotice(e.message))
      .finally(() => setLoading(false));
  }, [ownerToken]);

  useEffect(() => {
    if (!event) return;
    setChannel(event.default_channel || "sms");
    setMessageTemplate(event.message_template || messageTemplate);
    setInvitationImageUrl(event.invitation_image_url || "");
  }, [event]);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/public/owner/${ownerToken}/send-preflight`)
      .then((data) => {
        if (!cancelled) setPreflight(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ownerToken]);

  useEffect(() => {
    apiFetch(`/public/owner/${ownerToken}/guests-sample?limit=20`)
      .then((list) => setSampleGuests(Array.isArray(list) ? list : []))
      .catch(() => setSampleGuests([]));
  }, [ownerToken]);

  const readiness = useMemo(() => {
    const missing = [];
    if (!event?.event_name) missing.push("שם אירוע");
    if (!event?.event_date) missing.push("תאריך ושעה");
    if ((preflight?.guestCount || 0) === 0) missing.push("רשימת מוזמנים (CSV)");
    if (!messageTemplate?.trim()) missing.push("נוסח הודעה");
    if (channel === "sms" && preflight && !preflight.twilioSmsFromSet) missing.push("TWILIO_SMS_FROM בשרת");
    if (channel === "whatsapp" && preflight && !preflight.twilioWhatsappFromSet) missing.push("TWILIO_WHATSAPP_FROM בשרת");
    if (preflight && !preflight.publicAppUrlSet) missing.push("PUBLIC_APP_URL בשרת");
    return {
      missing,
      ok: missing.length === 0
    };
  }, [event, preflight, messageTemplate, channel]);

  const next = () => setStep((s) => Math.min(s + 1, wizardSteps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const saveEvent = async () => {
    try {
      setSaving(true);
      setNotice("");
      const payload = {
        eventName: edit.eventName,
        eventDate: edit.eventDate ? new Date(edit.eventDate).toISOString() : null,
        venueName: edit.venueName,
        mapsUrl: edit.mapsUrl,
        parkingInfo: edit.parkingInfo,
        contactPhone: edit.contactPhone
      };
      const data = await apiFetch(`/public/owner/${ownerToken}/event`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setEvent(data.event);
      toast.push({ tone: "success", title: "נשמר", message: "פרטי האירוע עודכנו." });
    } catch (e) {
      setNotice(e.message);
      toast.push({ tone: "danger", title: "שמירה נכשלה", message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const detectDelimiter = (firstLine) => {
    const line = String(firstLine || "").replace(/^\uFEFF/, "");
    const commas = (line.match(/,/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
  };

  const decodeCsvFile = async (file) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const looksBroken = utf8.includes("\uFFFD");
    if (!looksBroken) return utf8;
    return new TextDecoder("windows-1255", { fatal: false }).decode(bytes);
  };

  const parseCsvText = (text) => {
    const withoutBom = String(text || "").replace(/^\uFEFF/, "");
    const firstNl = withoutBom.indexOf("\n");
    const firstLine = firstNl >= 0 ? withoutBom.slice(0, firstNl) : withoutBom;
    const delimiter = detectDelimiter(firstLine);
    const parsed = Papa.parse(withoutBom, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      transformHeader: (h) => String(h || "").trim(),
      transform: (v) => (typeof v === "string" ? v.trim() : v)
    });
    if (parsed.errors?.length) throw new Error(parsed.errors[0]?.message || "שגיאה בפירסור CSV");
    const rows = parsed.data || [];
    const guests = rows
      .map((row) => {
        const name = row.full_name || row.name || row["שם"] || row["אורח"] || "";
        const phone = (row.phone || row["טלפון"] || row["נייד"] || "").toString().replace(/\s|-/g, "");
        return { name: String(name).trim(), phone: String(phone).trim() };
      })
      .filter((g) => g.name && g.phone);
    const seen = new Set();
    let dups = 0;
    for (const g of guests) {
      if (seen.has(g.phone)) dups += 1;
      seen.add(g.phone);
    }
    return { guests, dupInFile: dups };
  };

  const loadPreview = async (file) => {
    setPreviewGuests([]);
    setImportResult("");
    setCsvFile(file);
    const text = await decodeCsvFile(file);
    const { guests, dupInFile: d } = parseCsvText(text);
    setDupInFile(d);
    setPreviewGuests(guests.slice(0, 500));
  };

  const importFromContacts = async () => {
    try {
      setPreviewGuests([]);
      setImportResult("");
      setCsvFile(null);
      const { guests, dupInPick } = await pickGuestsFromContacts();
      if (!guests.length) {
        setImportResult("לא נבחרו אנשי קשר עם טלפון.");
        return;
      }
      setDupInFile(dupInPick);
      setPreviewGuests(guests.slice(0, 500));
      const file = guestsToCsvFile(guests, "contacts.csv");
      setCsvFile(file);
      toast.push({ tone: "success", title: "נטען", message: `נטענו ${guests.length} אנשי קשר לתצוגה.` });
    } catch (e) {
      toast.push({ tone: "warning", title: "ייבוא אנשי קשר לא זמין", message: e.message });
      setImportResult(e.message);
    }
  };

  const importFromVcf = async (file) => {
    try {
      setPreviewGuests([]);
      setImportResult("");
      setCsvFile(null);
      if (!file) return;
      const text = await file.text();
      const { guests, dupInPick } = parseVcfToGuests(text);
      if (!guests.length) {
        setImportResult("לא נמצאו אנשי קשר בקובץ.");
        return;
      }
      setDupInFile(dupInPick);
      setPreviewGuests(guests.slice(0, 500));
      const csv = guestsToCsvFile(guests, "contacts.vcf.csv");
      setCsvFile(csv);
      toast.push({ tone: "success", title: "נטען", message: `נטענו ${guests.length} אנשי קשר מקובץ VCF לתצוגה.` });
    } catch (e) {
      toast.push({ tone: "warning", title: "ייבוא VCF נכשל", message: e.message });
      setImportResult(e.message);
    }
  };
  const importGuests = async () => {
    try {
      if (!csvFile) return;
      setImporting(true);
      setImportResult("");
      const fd = new FormData();
      fd.append("csv", csvFile);
      fd.append("mode", importMode);
      const data = await apiFetch(`/public/owner/${ownerToken}/guests/upload-file`, { method: "POST", body: fd });
      setImportResult(`נוספו ${data.count || 0} | דולגו ${data.skipped || 0}`);
      toast.push({ tone: "success", title: "אורחים נשמרו", message: `נוספו ${data.count || 0} | דולגו ${data.skipped || 0}` });
    } catch (e) {
      setImportResult(e.message);
      toast.push({ tone: "danger", title: "שמירה נכשלה", message: e.message });
    } finally {
      setImporting(false);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return "";
    const fd = new FormData();
    fd.append("invitationImage", imageFile);
    const data = await apiFetch(`/public/owner/${ownerToken}/message-assets`, { method: "POST", body: fd });
    return data.imageUrl;
  };

  const saveMessageConfig = async (imageUrl) => {
    const data = await apiFetch(`/public/owner/${ownerToken}/message-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageTemplate, invitationImageUrl: imageUrl, channel })
    });
    setEvent(data.event);
    if (Array.isArray(data.warnings) && data.warnings.length) {
      toast.push({
        tone: "warning",
        title: "שימו לב",
        message: "התמונה/הודעה לא נשמרו בסופאבייס. כנראה שחסרות עמודות בטבלת events."
      });
    }
  };

  const sendInvitations = async () => {
    try {
      setSendLoading(true);
      setFailures([]);
      setSkippedList([]);
      setSendStatusText("שומר ומכין שליחה...");
      let imageUrl = invitationImageUrl;
      if (imageFile) {
        imageUrl = await uploadImage();
        setInvitationImageUrl(imageUrl);
      }
      await saveMessageConfig(imageUrl);
      setSendStatusText("שולח הודעות לכל האורחים...");
      const sendResult = await apiFetch(`/public/owner/${ownerToken}/send-invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, invitationImageUrl: imageUrl })
      });
      const skipped = Number(sendResult.skipped || 0);
      const failed = Number(sendResult.failed || 0);
      const sent = Number(sendResult.sent || 0);
      setSkippedList(sendResult.skippedList || []);
      setFailures(sendResult.failures || []);
      setSendStatusText(
        `נשלחו ${sent} הודעות. נכשלו ${failed}. דולגו ${skipped}.${sendResult.sandboxHint ? ` ${sendResult.sandboxHint}` : ""}`
      );
      toast.push({
        tone: failed > 0 ? "warning" : "success",
        title: "סיכום שליחה",
        message: `נשלחו ${sent} | נכשלו ${failed} | דולגו ${skipped}`
      });
    } catch (e) {
      setSendStatusText(e.message);
      toast.push({ tone: "danger", title: "שליחה נכשלה", message: e.message });
    } finally {
      setSendLoading(false);
    }
  };

  const sendReminders = async () => {
    try {
      setSendLoading(true);
      setSendStatusText("שולח תזכורות למי שלא ענה...");
      const data = await apiFetch(`/public/owner/${ownerToken}/send-reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, reminderText })
      });
      setSendStatusText(`נשלחו ${data.reminded || 0} תזכורות. נכשלו ${data.failed || 0}. דולגו ${data.skipped || 0}.`);
      toast.push({
        tone: Number(data.failed || 0) > 0 ? "warning" : "success",
        title: "סיכום תזכורות",
        message: `נשלחו ${data.reminded || 0} | נכשלו ${data.failed || 0} | דולגו ${data.skipped || 0}`
      });
    } catch (e) {
      setSendStatusText(e.message);
      toast.push({ tone: "danger", title: "תזכורות נכשלו", message: e.message });
    } finally {
      setSendLoading(false);
    }
  };

  const loadMessagePreview = async () => {
    try {
      setPreviewLoading(true);
      const q = previewPick ? `?pick=${encodeURIComponent(previewPick)}` : "";
      const data = await apiFetch(`/public/owner/${ownerToken}/message-preview${q}`);
      setPreview(data);
    } catch (e) {
      setPreview(null);
      toast.push({ tone: "warning", title: "אין תצוגה מקדימה", message: e.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchInvalidPhones = async () => {
    try {
      setInvalidLoading(true);
      const data = await apiFetch(`/public/owner/${ownerToken}/invalid-phones?limit=200`);
      setInvalidPhones(data);
    } catch (e) {
      setInvalidPhones(null);
      toast.push({ tone: "warning", title: "בדיקה נכשלה", message: e.message });
    } finally {
      setInvalidLoading(false);
    }
  };

  const fixPhones = async () => {
    try {
      setInvalidLoading(true);
      const data = await apiFetch(`/public/owner/${ownerToken}/fix-phones`, { method: "POST" });
      toast.push({
        tone: "success",
        title: "תיקון טלפונים הושלם",
        message: `תוקנו ${data.updated || 0} | דולגו ${data.skipped || 0}`
      });
      // Refresh preflight + invalid list
      const pf = await apiFetch(`/public/owner/${ownerToken}/send-preflight`);
      setPreflight(pf);
      const inv = await apiFetch(`/public/owner/${ownerToken}/invalid-phones?limit=200`);
      setInvalidPhones(inv);
    } catch (e) {
      toast.push({ tone: "danger", title: "תיקון נכשל", message: e.message });
    } finally {
      setInvalidLoading(false);
    }
  };

  const downloadInvalidCsv = () => {
    const rows = invalidPhones?.invalid || [];
    const header = "name,phone";
    const csv = [header, ...rows.map((r) => `${JSON.stringify(r.name || "")},${JSON.stringify(r.phone || "")}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "invalid-phones.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (loading) {
    return (
      <div className="container">
        <section className="card">
          <div className="skeleton" style={{ height: 22, width: "60%", marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 220 }} />
        </section>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container">
        <section className="card">
          <h2>פורטל בעל אירוע</h2>
          <p className="status">{notice || "הקישור לא תקין."}</p>
          <Link className="btn" to="/start">
            חזרה למסך יצירת קישור
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container">
      <BrandHeader
        rightSlot={
          <a className="btn" href="/start">
            יצירת קישור חדש
          </a>
        }
      />
      <div className="grid">
        <section className="hero card">
          <div className="hero-inner">
            <div className="hero-kicker">EVENT OWNER</div>
            <h1 className="hero-title">
              פורטל <span>בעל האירוע</span>
            </h1>
            <p className="hero-sub">
              עובדים לפי שלבים: ממלאים פרטים, מעלים מוזמנים, בודקים תצוגה מקדימה ואז שולחים. הכל בעברית, RTL, ועם דוחות ברורים.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="actions-row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0 }}>התקדמות</h2>
              <p className="hint" style={{ marginTop: 8 }}>
                השלימו את השלבים לפי הסדר — ובסוף שלחו הודעות לאורחים.
              </p>
            </div>
            <div className="wizard-actions">
              {step > 0 && (
                <button className="btn" type="button" onClick={prev}>
                  חזרה
                </button>
              )}
              {step < wizardSteps.length - 1 ? (
                <button className="btn btn-accent" type="button" onClick={next}>
                  המשך
                </button>
              ) : (
                <span className={`ready-pill ${readiness.ok ? "ok" : "warn"}`}>
                  {readiness.ok ? "מוכן לשליחה" : `חסרים ${readiness.missing.length} פרטים`}
                </span>
              )}
            </div>
          </div>

          <div className="steps-indicator" style={{ marginTop: 12 }}>
            {wizardSteps.map((label, idx) => (
              <span key={label} className={idx === step ? "active" : ""}>
                {label}
              </span>
            ))}
          </div>

          {!readiness.ok && step === 3 && (
            <div className="banner banner-info" role="status" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 900 }}>כדי לשלוח, חסר:</div>
              <ul style={{ margin: "8px 18px 0 0" }}>
                {readiness.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {step === 0 && (
          <section className="card">
            <h3>פרטי אירוע</h3>
            <div className="form-grid">
              <label className="field">
                <span>שם האירוע</span>
                <input value={edit?.eventName || ""} onChange={(e) => setEdit((p) => ({ ...p, eventName: e.target.value }))} />
              </label>
              <label className="field">
                <span>תאריך ושעה</span>
                <input
                  type="datetime-local"
                  value={edit?.eventDate || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, eventDate: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>שם המקום</span>
                <input value={edit?.venueName || ""} onChange={(e) => setEdit((p) => ({ ...p, venueName: e.target.value }))} />
              </label>
              <label className="field">
                <span>קישור ניווט / כתובת</span>
                <input value={edit?.mapsUrl || ""} onChange={(e) => setEdit((p) => ({ ...p, mapsUrl: e.target.value }))} />
              </label>
              <label className="field">
                <span>מידע חניה</span>
                <input value={edit?.parkingInfo || ""} onChange={(e) => setEdit((p) => ({ ...p, parkingInfo: e.target.value }))} />
              </label>
              <label className="field">
                <span>טלפון ליצירת קשר (יופיע לאורחים)</span>
                <input value={edit?.contactPhone || ""} onChange={(e) => setEdit((p) => ({ ...p, contactPhone: e.target.value }))} />
              </label>
            </div>

            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn-gold" type="button" onClick={saveEvent} disabled={saving}>
                {saving ? "שומר..." : "שמור פרטי אירוע"}
              </button>
            </div>
            {notice && <p className="status">{notice}</p>}
          </section>
        )}

        {step === 1 && (
          <section className="card">
            <h3>מוזמנים (CSV)</h3>
            <p className="hint">
              אורחים קיימים: <strong>{preflight?.guestCount ?? "—"}</strong>
            </p>
            <div className="actions" style={{ marginBottom: 10 }}>
              <label className="field" style={{ minWidth: 220 }}>
                <span>מצב</span>
                <select value={importMode} onChange={(e) => setImportMode(e.target.value)} disabled={importing}>
                  <option value="add">הוסף לרשימה (ללא כפילויות)</option>
                  <option value="replace">החלף רשימה (מוחק ומעלה מחדש)</option>
                </select>
              </label>
            </div>
            <div className="dropzone">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await loadPreview(file);
                }}
              />
              <div className="dropzone-content">
                <div className="dropzone-title">{csvFile ? `נבחר קובץ: ${csvFile.name}` : "בחר קובץ CSV"}</div>
                <div className="dropzone-sub">תוצג תצוגה מקדימה לפני שמירה.</div>
              </div>
            </div>

            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn btn-accent" type="button" onClick={importFromContacts} disabled={importing}>
                ייבוא מאנשי קשר (Android/Chrome)
              </button>
              <label className="btn btn-accent" style={{ cursor: "pointer" }}>
                ייבוא מאנשי קשר (iPhone/VCF)
                <input
                  type="file"
                  accept=".vcf,text/vcard,text/x-vcard"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    await importFromVcf(f);
                  }}
                />
              </label>
            </div>

            {previewGuests.length > 0 && (
              <div className="preview-box">
                <h3>תצוגה לפני אישור ({previewGuests.length} שורות)</h3>
                {dupInFile > 0 && <p className="hint">זוהו {dupInFile} כפילויות טלפון בקובץ.</p>}
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>שם</th>
                        <th>טלפון</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewGuests.map((g, idx) => (
                        <tr key={`${g.phone}-${idx}`}>
                          <td>{g.name}</td>
                          <td>{g.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn-gold" type="button" onClick={importGuests} disabled={importing || !csvFile}>
                {importing ? "שומר..." : "אשר ושמור אורחים"}
              </button>
            </div>
            {importResult && <p className="status">{importResult}</p>}
          </section>
        )}

        {step === 2 && (
          <section className="card">
            <h3>הודעה ותמונה</h3>
            {preflight && (
              <div className="banner banner-info" role="status">
                {preflight.invalidPhone > 0 && <div>מספרי טלפון לא תקינים: {preflight.invalidPhone}</div>}
                {preflight.missingToken > 0 && <div>חסר טוקן אישי: {preflight.missingToken}</div>}
                {!preflight.publicAppUrlSet && <div>חסר PUBLIC_APP_URL בשרת — הלינקים עלולים להיות שגויים.</div>}
              </div>
            )}

            <label className="field">
              <span>ערוץ שליחה</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={sendLoading}>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>

            <label className="field">
              <span>נוסח הודעה</span>
              <textarea
                value={messageTemplate}
                rows={6}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="אפשר להשתמש ב-{{שם}}, {{לינק}}, {{אירוע}}"
                disabled={sendLoading}
              />
            </label>

            <label className="field">
              <span>תמונת הזמנה (אופציונלי)</span>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} disabled={sendLoading} />
            </label>

            {invitationImageUrl && (
              <div className="hint">
                קיים URL לתמונה:{" "}
                <a href={invitationImageUrl} target="_blank" rel="noreferrer">
                  פתיחה
                </a>
              </div>
            )}

            <div className="actions" style={{ marginTop: 10 }}>
              <button
                className="btn btn-gold"
                type="button"
                onClick={async () => {
                  try {
                    setSendLoading(true);
                    setSendStatusText("שומר הודעה...");
                    let imageUrl = invitationImageUrl;
                    if (imageFile) {
                      imageUrl = await uploadImage();
                      setInvitationImageUrl(imageUrl);
                    }
                    await saveMessageConfig(imageUrl);
                    setSendStatusText("נשמר.");
                    toast.push({ tone: "success", title: "נשמר", message: "נוסח הודעה ותמונה נשמרו." });
                  } catch (e) {
                    setSendStatusText(e.message);
                    toast.push({ tone: "danger", title: "שמירה נכשלה", message: e.message });
                  } finally {
                    setSendLoading(false);
                  }
                }}
                disabled={sendLoading}
              >
                שמור הודעה
              </button>
              <label className="field" style={{ minWidth: 220, margin: 0 }}>
                <span>אורח לתצוגה</span>
                <select value={previewPick} onChange={(e) => setPreviewPick(e.target.value)} disabled={previewLoading || sendLoading}>
                  <option value="first">אורח ראשון ברשימה</option>
                  <option value="random">אורח אקראי</option>
                  {sampleGuests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name || "—"} ({g.phone || "—"})
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn" type="button" onClick={loadMessagePreview} disabled={previewLoading || sendLoading}>
                {previewLoading ? "טוען..." : "תצוגה מקדימה"}
              </button>
            </div>
            {sendStatusText && <p className="status">{sendStatusText}</p>}

            {preview && (
              <div className="card" style={{ marginTop: 12 }}>
                <h4>תצוגה מקדימה</h4>
                <p className="hint">
                  אורח לדוגמה: <strong>{preview.guest?.name || "—"}</strong>
                </p>
                <div className="actions" style={{ marginBottom: 10 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(preview.personalLink || "");
                        toast.push({ tone: "success", title: "הועתק", message: "לינק אורח לדוגמה הועתק ללוח." });
                      } catch (_e) {
                        toast.push({ tone: "warning", title: "לא הועתק", message: "הדפדפן חסם העתקה. העתק ידנית." });
                      }
                    }}
                  >
                    העתק לינק אורח לדוגמה
                  </button>
                  <a className="btn btn-gold" href={preview.personalLink} target="_blank" rel="noreferrer">
                    פתח כלינק אורח
                  </a>
                </div>
                <pre className="msg-preview">{preview.renderedBody}</pre>
              </div>
            )}

            <div className="card" style={{ marginTop: 12 }}>
              <h4>בדיקת טלפונים</h4>
              <p className="hint">מוציא רשימה להורדה (עד 200) של מספרים שאינם בפורמט בינלאומי.</p>
              <div className="actions">
                <button className="btn" type="button" onClick={fetchInvalidPhones} disabled={invalidLoading}>
                  {invalidLoading ? "בודק..." : "בדוק טלפונים בעייתיים"}
                </button>
                <button className="btn" type="button" onClick={fixPhones} disabled={invalidLoading}>
                  תקן אוטומטית
                </button>
                <button className="btn btn-gold" type="button" onClick={downloadInvalidCsv} disabled={!invalidPhones?.invalid?.length}>
                  הורד CSV
                </button>
              </div>
              {invalidPhones && (
                <p className="hint" style={{ marginTop: 10 }}>
                  נמצאו <strong>{invalidPhones.invalidCount}</strong> מספרים בעייתיים מתוך {invalidPhones.totalChecked}.
                </p>
              )}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="card">
            <h3>שליחה</h3>
            {preflight && (
              <div className="banner banner-info" role="status">
                <div>אורחים באירוע: {preflight.guestCount}</div>
                {channel === "sms" && !preflight.twilioSmsFromSet && <div>חסר TWILIO_SMS_FROM בסביבת השרת.</div>}
                {channel === "whatsapp" && !preflight.twilioWhatsappFromSet && <div>חסר TWILIO_WHATSAPP_FROM בסביבת השרת.</div>}
                {preflight.sandboxHint && <div className="hint">{preflight.sandboxHint}</div>}
              </div>
            )}

            <div className="actions">
              <button className="btn btn-gold" type="button" onClick={sendInvitations} disabled={sendLoading || !readiness.ok}>
                {sendLoading ? "מבצע שליחה..." : "שלח לכל האורחים"}
              </button>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <h4>תזכורות למי שלא ענה</h4>
              <label className="field">
                <span>טקסט תזכורת</span>
                <input value={reminderText} onChange={(e) => setReminderText(e.target.value)} disabled={sendLoading} />
              </label>
              <button className="btn" type="button" onClick={sendReminders} disabled={sendLoading}>
                שלח תזכורת למי שלא ענה
              </button>
            </div>

            {sendStatusText && <p className="status">{sendStatusText}</p>}

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

