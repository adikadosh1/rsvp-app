import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SendMessage from "../components/SendMessage.jsx";
import { apiFetch } from "../lib/api.js";
import Papa from "papaparse";
import { useToast } from "../components/ToastProvider.jsx";
import { guestsToCsvFile, parseVcfToGuests, pickGuestsFromContacts } from "../utils/contactsImport.js";

export default function UploadGuests() {
  const { eventId } = useParams();
  const toast = useToast();
  const [csvFile, setCsvFile] = useState(null);
  const [previewGuests, setPreviewGuests] = useState([]);
  const [resultText, setResultText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importMode, setImportMode] = useState(null); // add | replace
  const [needsChoice, setNeedsChoice] = useState(false);
  const [dupInFile, setDupInFile] = useState(0);
  const [invalidPhones, setInvalidPhones] = useState(null);
  const [invalidLoading, setInvalidLoading] = useState(false);

  const storageKey = `hkham-upload-preview:${eventId}`;

  function detectDelimiter(firstLine) {
    const line = String(firstLine || "").replace(/^\uFEFF/, "");
    const commas = (line.match(/,/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
  }

  const clearList = () => {
    setCsvFile(null);
    setPreviewGuests([]);
    setResultText("");
    setImportMode(null);
    setNeedsChoice(false);
    setDupInFile(0);
    try {
      localStorage.removeItem(storageKey);
    } catch (_e) {
      // ignore
    }
  };

  // restore preview on refresh (once per eventId)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.previewGuests)) {
        setPreviewGuests(parsed.previewGuests);
        setResultText(parsed.resultText || "");
        setImportMode(parsed.importMode || null);
        setNeedsChoice(Boolean(parsed.needsChoice));
        setDupInFile(Number(parsed.dupInFile) || 0);
      }
    } catch (_e) {
      // ignore
    }
  }, [storageKey]);

  const decodeCsvFile = async (file) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);

    const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const looksBroken = utf8.includes("\uFFFD");
    if (!looksBroken) return utf8;

    // Hebrew Windows encoding
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

    if (parsed.errors?.length) {
      throw new Error(parsed.errors[0]?.message || "שגיאה בפירסור CSV");
    }

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

  const loadPreviewFromFile = async (file) => {
    // ensure previous list is cleared before loading new
    setPreviewGuests([]);
    setResultText("");
    setImportMode(null);
    setNeedsChoice(false);
    const text = await decodeCsvFile(file);
    const { guests, dupInFile: dupCount } = parseCsvText(text);
    setDupInFile(dupCount);
    setPreviewGuests(guests.slice(0, 500)); // safety cap for preview
    const baseMsg = guests.length ? `נטענו ${guests.length} אורחים לתצוגה לפני אישור.` : "לא נמצאו שורות תקינות.";
    const dupMsg = dupCount > 0 ? ` זוהו ${dupCount} כפילויות טלפון בקובץ (תוצג השורה הראשונה לכל מספר).` : "";

    // Decide whether we must ask replace/add (only if event already has guests)
    let nextNeedsChoice = false;
    let nextMode = null;
    try {
      const meta = await apiFetch(`/guests/${eventId}/meta`);
      if (meta.count > 0) {
        nextNeedsChoice = true;
        nextMode = null;
      } else {
        nextNeedsChoice = false;
        nextMode = "add";
      }
    } catch (_e) {
      // If meta fails, default to add and let backend dedupe.
      nextNeedsChoice = false;
      nextMode = "add";
    }

    setNeedsChoice(nextNeedsChoice);
    setImportMode(nextMode);
    setResultText(
      nextNeedsChoice
        ? `${baseMsg}${dupMsg} לאירוע כבר קיימים אורחים — בחר האם להחליף או להוסיף.`
        : `${baseMsg}${dupMsg}`
    );

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          previewGuests: guests.slice(0, 500),
          resultText:
            nextNeedsChoice
              ? `${baseMsg}${dupMsg} לאירוע כבר קיימים אורחים — בחר האם להחליף או להוסיף.`
              : `${baseMsg}${dupMsg}`,
          importMode: nextMode,
          needsChoice: nextNeedsChoice,
          dupInFile: dupCount
        })
      );
    } catch (_e) {
      // ignore
    }
  };

  const importFromContacts = async () => {
    try {
      clearList();
      const { guests, dupInPick } = await pickGuestsFromContacts();
      if (!guests.length) {
        setResultText("לא נבחרו אנשי קשר עם טלפון.");
        return;
      }

      const file = guestsToCsvFile(guests, "contacts.csv");
      setCsvFile(file);
      setDupInFile(dupInPick);
      setPreviewGuests(guests.slice(0, 500));

      const baseMsg = `נטענו ${guests.length} אורחים מאנשי קשר לתצוגה לפני אישור.`;
      const dupMsg = dupInPick > 0 ? ` דולגו ${dupInPick} כפילויות טלפון בבחירה.` : "";

      // Decide whether we must ask replace/add (only if event already has guests)
      let nextNeedsChoice = false;
      let nextMode = null;
      try {
        const meta = await apiFetch(`/guests/${eventId}/meta`);
        if (meta.count > 0) {
          nextNeedsChoice = true;
          nextMode = null;
        } else {
          nextNeedsChoice = false;
          nextMode = "add";
        }
      } catch (_e) {
        nextNeedsChoice = false;
        nextMode = "add";
      }

      setNeedsChoice(nextNeedsChoice);
      setImportMode(nextMode);
      setResultText(
        nextNeedsChoice
          ? `${baseMsg}${dupMsg} לאירוע כבר קיימים אורחים — בחר האם להחליף או להוסיף.`
          : `${baseMsg}${dupMsg}`
      );

      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            previewGuests: guests.slice(0, 500),
            resultText:
              nextNeedsChoice
                ? `${baseMsg}${dupMsg} לאירוע כבר קיימים אורחים — בחר האם להחליף או להוסיף.`
                : `${baseMsg}${dupMsg}`,
            importMode: nextMode,
            needsChoice: nextNeedsChoice,
            dupInFile: dupInPick
          })
        );
      } catch (_e) {
        // ignore
      }
    } catch (e) {
      toast.push({ tone: "warning", title: "ייבוא אנשי קשר לא זמין", message: e.message });
      setResultText(e.message);
    }
  };

  const importFromVcf = async (file) => {
    try {
      clearList();
      if (!file) return;
      const text = await file.text();
      const { guests, dupInPick } = parseVcfToGuests(text);
      if (!guests.length) {
        setResultText("לא נמצאו אנשי קשר בקובץ.");
        return;
      }
      const csv = guestsToCsvFile(guests, "contacts.vcf.csv");
      setCsvFile(csv);
      setDupInFile(dupInPick);
      setPreviewGuests(guests.slice(0, 500));
      setResultText(`נטענו ${guests.length} אנשי קשר מתוך קובץ VCF לתצוגה לפני אישור.`);
      setNeedsChoice(true);
      setImportMode(null);
    } catch (e) {
      toast.push({ tone: "warning", title: "ייבוא VCF נכשל", message: e.message });
      setResultText(e.message);
    }
  };

  const importGuests = async () => {
    try {
      setLoading(true);
      if (!csvFile) {
        setResultText("נא לבחור קובץ CSV לפני העלאה.");
        return;
      }

      if (!importMode) {
        setResultText("נא לבחור האם להחליף את הרשימה הקיימת או להוסיף אליה.");
        return;
      }

      const form = new FormData();
      form.append("eventId", eventId);
      form.append("csv", csvFile);
      form.append("mode", importMode || "add");

      const data = await apiFetch("/guests/upload-file", {
        method: "POST",
        body: form
      });
      const skipped = typeof data.skipped === "number" ? data.skipped : 0;
      if (data.count === 0) {
        setResultText(
          skipped > 0
            ? `לא נוספו רשומות חדשות. דולגו ${skipped} מספרים שכבר קיימים באירוע.`
            : "לא נוספו אורחים."
        );
      } else {
        setResultText(
          skipped > 0
            ? `נשמרו בהצלחה ${data.count} אורחים. דולגו ${skipped} כפילויות מול הרשימה הקיימת.`
            : `נשמרו בהצלחה ${data.count} אורחים.`
        );
      }
      clearList();
      toast.push({
        tone: "success",
        title: "אורחים נשמרו",
        message: `נוספו ${data.count || 0} | דולגו ${data.skipped || 0}`
      });
    } catch (error) {
      setResultText(error.message);
      toast.push({ tone: "danger", title: "שמירת אורחים נכשלה", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchInvalidPhones = async () => {
    try {
      setInvalidLoading(true);
      const data = await apiFetch(`/guests/${eventId}/invalid-phones?limit=200`);
      setInvalidPhones(data);
      toast.push({ tone: "info", title: "בדיקה הושלמה", message: `נמצאו ${data.invalidCount || 0} טלפונים בעייתיים` });
    } catch (e) {
      toast.push({ tone: "warning", title: "בדיקה נכשלה", message: e.message });
    } finally {
      setInvalidLoading(false);
    }
  };

  const fixPhones = async () => {
    try {
      setInvalidLoading(true);
      const data = await apiFetch(`/guests/${eventId}/fix-phones`, { method: "POST" });
      toast.push({
        tone: "success",
        title: "תיקון טלפונים הושלם",
        message: `תוקנו ${data.updated || 0} | דולגו ${data.skipped || 0}`
      });
      await fetchInvalidPhones();
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

  return (
    <div className="grid manage-page">
      <nav className="breadcrumb" aria-label="מיקום">
        <Link to="/dashboard">מסך ראשי</Link>
        <span className="sep">/</span>
        <Link to={`/events/${eventId}`}>דשבורד אירוע</Link>
        <span className="sep">/</span>
        <span>העלאת אורחים</span>
      </nav>
      <section className="card">
        <h2>העלאת אורחים (CSV)</h2>
        <p className="banner banner-info">התצוגה המקדימה נשמרת בדפדפן (טיוטה) עד שמירה או “נקה רשימה”.</p>
        <p className="hint">בחר קובץ CSV או גרור אותו לכאן. העמודות יכולות להיות: name,phone או שם,טלפון (גם מפריד `;` וקידוד Windows-1255)</p>

        <div className="actions" style={{ marginBottom: 10 }}>
          <button type="button" className="btn" onClick={clearList} disabled={loading && previewGuests.length === 0 && !csvFile}>
            נקה רשימה
          </button>
          <button type="button" className="btn btn-accent" onClick={importFromContacts} disabled={loading}>
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

        <div
          className={`dropzone dropzone-pro ${isDragging ? "dragging" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            clearList();
            setCsvFile(file);
            await loadPreviewFromFile(file);
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              clearList();
              setCsvFile(file);
              await loadPreviewFromFile(file);
            }}
          />
          <div className="dropzone-content">
            <div className="dropzone-title">{csvFile ? `נבחר קובץ: ${csvFile.name}` : "גרור קובץ CSV לכאן או לחץ Browse"}</div>
            <div className="dropzone-sub">לאחר טעינה תופיע תצוגה מקדימה לפני שמירה.</div>
          </div>
        </div>

        {previewGuests.length > 0 && (
          <div className="preview-box">
            <h3>תצוגה לפני אישור ({previewGuests.length} שורות)</h3>
            {dupInFile > 0 && (
              <p className="hint" role="status">
                זוהו {dupInFile} מופעים כפולים של אותו טלפון בקובץ — בעת השמירה יישמר רק המופע הראשון לכל מספר.
              </p>
            )}
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

        {(previewGuests.length > 0 || csvFile) && (
          <div className="actions">
            {needsChoice && (
              <>
                <button
                  className={`btn ${importMode === "replace" ? "btn-gold" : ""}`}
                  type="button"
                  onClick={() => setImportMode("replace")}
                  disabled={loading}
                >
                  החלף רשימה
                </button>
                <button
                  className={`btn ${importMode === "add" ? "btn-gold" : ""}`}
                  type="button"
                  onClick={() => setImportMode("add")}
                  disabled={loading}
                >
                  הוסף לרשימה
                </button>
              </>
            )}
            <button className="btn btn-gold" type="button" onClick={importGuests} disabled={loading || !csvFile || (!importMode && needsChoice)}>
              {loading ? "מעלה ושומר..." : "אשר ושמור אורחים"}
            </button>
          </div>
        )}
        {resultText && <p className="status">{resultText}</p>}
        <div className="actions" style={{ marginTop: 12 }}>
          <Link className="btn" to={`/events/${eventId}`}>
            מעבר לדשבורד האירוע
          </Link>
        </div>
      </section>

      <section className="card">
        <h3>בדיקת טלפונים</h3>
        <p className="hint">מוצא מספרים שאינם בפורמט בינלאומי, ומאפשר תיקון אוטומטי.</p>
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
            נמצאו <strong>{invalidPhones.invalidCount}</strong> טלפונים בעייתיים מתוך {invalidPhones.totalChecked}.
          </p>
        )}
      </section>

      <SendMessage eventId={eventId} onSent={() => setResultText("שליחת הזמנות הושלמה.")} />
    </div>
  );
}
