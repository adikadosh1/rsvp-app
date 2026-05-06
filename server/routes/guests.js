import express from "express";
import multer from "multer";
import crypto from "crypto";
import Papa from "papaparse";
import iconv from "iconv-lite";
import { supabase } from "../services/supabase.js";

const router = express.Router();
const upload = multer();

function normalizePhone(raw) {
  if (!raw) return "";
  return String(raw).trim().replace(/\s|-/g, "");
}

function pickRowValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] != null && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

function decodeCsvBuffer(buffer) {
  // Try UTF-8 first; if it looks like mojibake, fall back to Windows-1255.
  const utf8 = buffer.toString("utf8");
  const hasReplacement = utf8.includes("\uFFFD");
  if (!hasReplacement) return utf8;

  // Windows-1255 (Hebrew)
  const win1255 = iconv.decode(buffer, "windows-1255");
  return win1255;
}

function parseCsvToRows(csvContent) {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => String(h || "").trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v)
  });

  if (result.errors?.length) {
    const msg = result.errors[0]?.message || "CSV parse error";
    throw new Error(`שגיאה בפירסור CSV: ${msg}`);
  }

  return result.data || [];
}

async function insertGuestsWithSchemaFallback(guestsToInsert) {
  // First try new schema (full_name + invite_token). If it fails due to missing columns, retry legacy (name + token).
  let { data, error } = await supabase.from("guests").insert(guestsToInsert).select("*");
  if (!error) return data;

  const missingColumnMatch = error.message?.match(/Could not find the '([^']+)' column/);
  const missingColumn = missingColumnMatch?.[1];
  const isNewSchemaMissing = missingColumn === "full_name" || missingColumn === "invite_token";

  if (!isNewSchemaMissing) {
    throw error;
  }

  const legacyGuests = guestsToInsert.map((g) => ({
    event_id: g.event_id,
    name: g.full_name,
    phone: g.phone,
    token: g.invite_token
  }));

  ({ data, error } = await supabase.from("guests").insert(legacyGuests).select("*"));
  if (error) throw error;
  return data;
}

function normalizeGuestRow(row) {
  return {
    id: row.id,
    event_id: row.event_id,
    full_name: row.full_name ?? row.name ?? "",
    phone: row.phone ?? "",
    invite_token: row.invite_token ?? row.token ?? "",
    created_at: row.created_at
  };
}

router.get("/:eventId/meta", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { count, error } = await supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (error) {
    console.error("Fetch guests meta failed:", error);
    res.status(500).json({ error: "שליפת נתונים נכשלה." });
  }
});

// Legacy endpoint: accepts csvContent in JSON (kept for backward compatibility).
router.post("/upload", async (req, res) => {
  try {
    const { eventId, csvContent } = req.body;

    if (!eventId || !csvContent) {
      return res.status(400).json({ error: "eventId ו-csvContent הם שדות חובה." });
    }

    const rows = parseCsvToRows(csvContent);

    const guestsToInsert = rows.map((row) => ({
      event_id: eventId,
      full_name: pickRowValue(row, ["full_name", "name", "שם", "אורח", "guest", "Guest"]),
      phone: normalizePhone(pickRowValue(row, ["phone", "טלפון", "נייד", "mobile", "טלפון נייד"])),
      invite_token: crypto.randomUUID()
    }));

    if (guestsToInsert.some((guest) => !guest.full_name || !guest.phone)) {
      return res.status(400).json({ error: "פורמט CSV לא תקין. יש לכלול עמודות שם וטלפון." });
    }

    const data = await insertGuestsWithSchemaFallback(guestsToInsert);

    res.status(201).json({ count: data.length, guests: data.map(normalizeGuestRow) });
  } catch (error) {
    console.error("Guest upload failed:", error);
    res.status(500).json({ error: "ייבוא האורחים נכשל.", details: error?.message || "Unknown error" });
  }
});

// New endpoint: accepts CSV file upload (multipart/form-data) for browse/drag-drop UX.
router.post("/upload-file", upload.single("csv"), async (req, res) => {
  try {
    const eventId = req.body?.eventId;
    const mode = req.body?.mode === "replace" ? "replace" : "add"; // add | replace
    if (!eventId) return res.status(400).json({ error: "eventId הוא שדה חובה." });
    if (!req.file?.buffer) return res.status(400).json({ error: "לא נבחר קובץ CSV." });

    const csvContent = decodeCsvBuffer(req.file.buffer);
    const rows = parseCsvToRows(csvContent);

    const guestsToInsert = rows.map((row) => ({
      event_id: eventId,
      full_name: pickRowValue(row, ["full_name", "name", "שם", "אורח", "guest", "Guest"]),
      phone: normalizePhone(pickRowValue(row, ["phone", "טלפון", "נייד", "mobile", "טלפון נייד"])),
      invite_token: crypto.randomUUID()
    }));

    const valid = guestsToInsert
      .filter((g) => g.full_name && g.phone)
      .map((g) => ({ ...g, phone: normalizePhone(g.phone) }));
    if (valid.length === 0) {
      return res.status(400).json({ error: "לא נמצאו שורות תקינות. ודא שיש עמודות שם וטלפון." });
    }

    // Deduplicate within uploaded file by phone (keep first)
    const seenPhones = new Set();
    const uniqueByPhone = [];
    for (const g of valid) {
      if (seenPhones.has(g.phone)) continue;
      seenPhones.add(g.phone);
      uniqueByPhone.push(g);
    }

    if (mode === "replace") {
      const { error: deleteError } = await supabase.from("guests").delete().eq("event_id", eventId);
      if (deleteError) throw deleteError;
    }

    // Prevent duplicates vs existing guests in DB by phone
    const phones = uniqueByPhone.map((g) => g.phone);
    const { data: existingRows, error: existingError } = await supabase
      .from("guests")
      .select("phone")
      .eq("event_id", eventId)
      .in("phone", phones);
    if (existingError) throw existingError;
    const existingPhones = new Set((existingRows || []).map((r) => normalizePhone(r.phone)));

    const toInsert = uniqueByPhone.filter((g) => !existingPhones.has(g.phone));
    if (toInsert.length === 0) {
      return res.status(200).json({ count: 0, guests: [], skipped: uniqueByPhone.length, mode });
    }

    const data = await insertGuestsWithSchemaFallback(toInsert);
    res.status(201).json({ count: data.length, guests: data.map(normalizeGuestRow) });
  } catch (error) {
    console.error("Guest upload-file failed:", error);
    res.status(500).json({ error: "ייבוא האורחים נכשל.", details: error?.message || "Unknown error" });
  }
});

router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    // Select guest rows without assuming column names
    const { data: guestRows, error: guestError } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (guestError) throw guestError;

    const normalizedGuests = guestRows.map(normalizeGuestRow);
    const guestIds = normalizedGuests.map((g) => g.id).filter(Boolean);

    // Load RSVP responses with fallback between `responses` and `rsvp_responses`
    let responses = [];
    if (guestIds.length > 0) {
      const primary = await supabase
        .from("responses")
        .select("*")
        .in("guest_id", guestIds);

      if (!primary.error) {
        responses = primary.data || [];
      } else {
        const fallback = await supabase
          .from("rsvp_responses")
          .select("*")
          .in("guest_id", guestIds);
        if (!fallback.error) responses = fallback.data || [];
      }
    }

    const latestByGuestId = new Map();
    for (const r of responses) {
      const respondedAt = r.updated_at || r.responded_at || r.created_at || "1970-01-01";
      const prev = latestByGuestId.get(r.guest_id);
      const prevAt = prev ? (prev.updated_at || prev.responded_at || prev.created_at || "1970-01-01") : null;
      if (!prevAt || new Date(respondedAt) > new Date(prevAt)) latestByGuestId.set(r.guest_id, r);
    }

    res.json(
      normalizedGuests.map((g) => ({
        ...g,
        latestResponse: latestByGuestId.get(g.id) || null
      }))
    );
  } catch (error) {
    console.error("Fetch guests failed:", error);
    res.status(500).json({ error: "שליפת אורחים נכשלה." });
  }
});

export default router;
