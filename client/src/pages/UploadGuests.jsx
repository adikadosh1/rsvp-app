import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SendMessage from "../components/SendMessage.jsx";
import { apiFetch } from "../lib/api.js";
import Papa from "papaparse";

export default function UploadGuests() {
  const { eventId } = useParams();
  const [csvFile, setCsvFile] = useState(null);
  const [previewGuests, setPreviewGuests] = useState([]);
  const [resultText, setResultText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importMode, setImportMode] = useState(null); // add | replace
  const [needsChoice, setNeedsChoice] = useState(false);

  const storageKey = `hkham-upload-preview:${eventId}`;

  const clearList = () => {
    setCsvFile(null);
    setPreviewGuests([]);
    setResultText("");
    setImportMode(null);
    setNeedsChoice(false);
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

  const parseCsvText = async (text) => {
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
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

    return guests;
  };

  const loadPreviewFromFile = async (file) => {
    // ensure previous list is cleared before loading new
    setPreviewGuests([]);
    setResultText("");
    setImportMode(null);
    setNeedsChoice(false);
    const text = await decodeCsvFile(file);
    const guests = await parseCsvText(text);
    setPreviewGuests(guests.slice(0, 500)); // safety cap for preview
    const baseMsg = guests.length ? `נטענו ${guests.length} אורחים לתצוגה לפני אישור.` : "לא נמצאו שורות תקינות.";

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
        ? `${baseMsg} לאירוע כבר קיימים אורחים — בחר האם להחליף או להוסיף.`
        : baseMsg
    );

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          previewGuests: guests.slice(0, 500),
          resultText:
            nextNeedsChoice
              ? `${baseMsg} לאירוע כבר קיימים אורחים — בחר האם להחליף או להוסיף.`
              : baseMsg,
          importMode: nextMode,
          needsChoice: nextNeedsChoice
        })
      );
    } catch (_e) {
      // ignore
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
      if (data.count === 0) {
        setResultText(`לא נוספו אורחים (ייתכן שכולם כבר קיימים).`);
      } else {
        setResultText(`הועלו ${data.count} אורחים בהצלחה.`);
      }
      clearList();
    } catch (error) {
      setResultText(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <section className="card">
        <h2>העלאת אורחים (CSV)</h2>
        <p className="hint">בחר קובץ CSV או גרור אותו לכאן. העמודות יכולות להיות: name,phone או שם,טלפון</p>

        <div className="actions" style={{ marginBottom: 10 }}>
          <button type="button" className="btn" onClick={clearList} disabled={loading && previewGuests.length === 0 && !csvFile}>
            נקה רשימה
          </button>
        </div>

        <div
          className={`dropzone ${isDragging ? "dragging" : ""}`}
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
      </section>

      <SendMessage eventId={eventId} onSent={() => setResultText("שליחת הזמנות הושלמה.")} />
    </div>
  );
}
