import express from "express";
import multer from "multer";
import crypto from "crypto";
import Papa from "papaparse";
import iconv from "iconv-lite";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile } from "fs/promises";
import { supabase } from "../services/supabase.js";
import { uploadInvitationImage } from "../services/supabase.js";
import { normalizeIsraelPhone, sendMessageToGuest, isLikelyE164 } from "../services/twilio.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeEventRow(row) {
  return {
    ...row,
    event_name: row.event_name ?? row.name ?? null,
    event_date: row.event_date ?? row.date ?? null,
    venue_name: row.venue_name ?? null,
    maps_url: row.maps_url ?? null,
    parking_info: row.parking_info ?? null,
    contact_phone: row.contact_phone ?? null,
    invitation_image_url: row.invitation_image_url ?? null,
    default_channel: row.default_channel ?? null,
    message_template: row.message_template ?? null
  };
}

async function insertEventWithSchemaFallback(basePayload) {
  const payload = { ...basePayload };
  const optionalColumns = new Set(["venue_name", "maps_url", "parking_info", "contact_phone", "owner_token"]);
  const dropped = new Set();
  let mappedToLegacyColumns = false;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.from("events").insert(payload).select("*").single();
    if (!error) return { data, droppedColumns: Array.from(dropped), mappedToLegacyColumns };

    const missingColumnMatch = error.message?.match(/Could not find the '([^']+)' column/);
    const missingColumn = missingColumnMatch?.[1];

    if ((missingColumn === "event_name" || missingColumn === "event_date") && !mappedToLegacyColumns) {
      payload.name = payload.event_name;
      payload.date = payload.event_date;
      delete payload.event_name;
      delete payload.event_date;
      mappedToLegacyColumns = true;
      continue;
    }

    if (missingColumn && optionalColumns.has(missingColumn)) {
      dropped.add(missingColumn);
      delete payload[missingColumn];
      continue;
    }

    throw error;
  }

  throw new Error("Failed to insert event due to unresolved schema mismatch.");
}

async function updateEventWithSchemaFallback(eventId, patch) {
  const payload = { ...patch };
  const optionalColumns = new Set([
    "venue_name",
    "maps_url",
    "parking_info",
    "contact_phone",
    "message_template",
    "invitation_image_url",
    "default_channel"
  ]);

  const dropped = new Set();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.from("events").update(payload).eq("id", eventId).select("*").single();
    if (!error) return { data, droppedColumns: Array.from(dropped) };

    const missingColumnMatch = error.message?.match(/Could not find the '([^']+)' column/);
    const missingColumn = missingColumnMatch?.[1];
    if (missingColumn && Object.hasOwn(payload, missingColumn) && optionalColumns.has(missingColumn)) {
      dropped.add(missingColumn);
      delete payload[missingColumn];
      continue;
    }

    // legacy column mapping for title/date updates if needed
    if (missingColumn === "event_name" && Object.hasOwn(payload, "event_name")) {
      payload.name = payload.event_name;
      delete payload.event_name;
      continue;
    }
    if (missingColumn === "event_date" && Object.hasOwn(payload, "event_date")) {
      payload.date = payload.event_date;
      delete payload.event_date;
      continue;
    }

    throw error;
  }
  throw new Error("Failed to update event due to unresolved schema mismatch.");
}

async function getEventByOwnerToken(ownerToken) {
  const token = String(ownerToken || "").trim();
  if (!token) return { event: null, error: null };

  // Try new column first. If schema doesn't have owner_token, this will error.
  const r = await supabase.from("events").select("*").eq("owner_token", token).maybeSingle();
  if (!r.error && r.data) return { event: r.data, error: null };

  // If column doesn't exist, provide a clear error to configure DB.
  if (r.error?.message?.includes("Could not find the 'owner_token' column")) {
    return { event: null, error: new Error("חסר עמודה owner_token בטבלת events. יש להוסיף אותה כדי לאפשר פורטל לבעל האירוע.") };
  }

  return { event: null, error: r.error || null };
}

function formatTwilioErr(err) {
  const code = err?.code ?? err?.status;
  const msg = err?.message || String(err);
  const more = err?.moreInfo || err?.details;
  return [msg, code, more].filter(Boolean).join(" | ");
}

function normalizeGuestRow(row) {
  return {
    ...row,
    full_name: row.full_name ?? row.name ?? "",
    invite_token: row.invite_token ?? row.token ?? ""
  };
}

router.post("/events", async (req, res) => {
  try {
    const { eventName, eventDate, venueName, mapsUrl, parkingInfo, contactPhone } = req.body || {};
    if (!eventName || !eventDate) {
      return res.status(400).json({ error: "שם אירוע ותאריך הם שדות חובה." });
    }

    const ownerToken = crypto.randomUUID();
    const payload = {
      event_name: eventName,
      event_date: eventDate,
      owner_token: ownerToken,
      ...(venueName ? { venue_name: venueName } : {}),
      ...(mapsUrl ? { maps_url: mapsUrl } : {}),
      ...(parkingInfo ? { parking_info: parkingInfo } : {}),
      ...(contactPhone ? { contact_phone: contactPhone } : {})
    };

    const { data, droppedColumns } = await insertEventWithSchemaFallback(payload);

    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:5173";
    res.status(201).json({
      event: normalizeEventRow(data),
      ownerToken,
      ownerUrl: `${publicAppUrl}/owner/${ownerToken}`,
      warnings:
        droppedColumns?.length
          ? [
              "חלק משדות פרטי האירוע לא נשמרו כי חסרות עמודות בטבלת events בסופאבייס. הרץ את ה‑SQL שמופיע במערכת כדי להוסיף אותן."
            ]
          : []
    });
  } catch (error) {
    console.error("public:create event failed:", error);
    res.status(500).json({ error: "יצירת אירוע נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.get("/owner/:ownerToken", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין או שפג תוקף." });
    res.json({ event: normalizeEventRow(event) });
  } catch (error) {
    res.status(500).json({ error: "טעינת אירוע נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.patch("/owner/:ownerToken/event", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const { eventName, eventDate, venueName, mapsUrl, parkingInfo, contactPhone } = req.body || {};
    const patch = {
      ...(eventName ? { event_name: eventName } : {}),
      ...(eventDate ? { event_date: eventDate } : {}),
      ...(venueName != null ? { venue_name: venueName } : {}),
      ...(mapsUrl != null ? { maps_url: mapsUrl } : {}),
      ...(parkingInfo != null ? { parking_info: parkingInfo } : {}),
      ...(contactPhone != null ? { contact_phone: contactPhone } : {})
    };

    const { data: updated, droppedColumns } = await updateEventWithSchemaFallback(event.id, patch);
    res.json({
      event: normalizeEventRow(updated),
      warnings:
        droppedColumns?.length
          ? ["חלק מפרטי האירוע לא נשמרו כי חסרות עמודות בטבלת events בסופאבייס."]
          : []
    });
  } catch (error) {
    console.error("public:update event failed:", error);
    res.status(500).json({ error: "עדכון אירוע נכשל.", details: error?.message || "Unknown error" });
  }
});

router.get("/owner/:ownerToken/send-preflight", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const { data: guests, error: gErr } = await supabase.from("guests").select("*").eq("event_id", event.id);
    if (gErr) throw gErr;

    let invalidPhone = 0;
    let missingToken = 0;
    for (const g of guests || []) {
      const ng = normalizeGuestRow(g);
      if (!ng.invite_token) missingToken += 1;
      if (!isLikelyE164(g.phone)) invalidPhone += 1;
    }

    res.json({
      guestCount: (guests || []).length,
      invalidPhone,
      missingToken,
      hasMessageTemplate: Boolean(event.message_template),
      publicAppUrlSet: Boolean(process.env.PUBLIC_APP_URL),
      twilioSmsFromSet: Boolean(process.env.TWILIO_SMS_FROM),
      twilioWhatsappFromSet: Boolean(process.env.TWILIO_WHATSAPP_FROM),
      sandboxHint:
        "ב-Twilio Sandbox רק מספרים שהצטרפו לסנדבוקס יכולים לקבל הודעות. נדרש גם קוד JOIN מהטלפון של הנמען."
    });
  } catch (error) {
    console.error("public:preflight failed:", error);
    res.status(500).json({ error: "שגיאה בבדיקת מוכנות שליחה.", details: error?.message || "Unknown error" });
  }
});

router.post("/owner/:ownerToken/message-assets", upload.single("invitationImage"), async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    if (!req.file?.buffer) return res.status(400).json({ error: "לא נבחר קובץ תמונה." });

    let imageUrl = null;
    try {
      imageUrl = await uploadInvitationImage(req.file.buffer, event.id, req.file.mimetype);
    } catch (storageError) {
      const ext = (req.file.mimetype || "image/jpeg").split("/")[1] || "jpg";
      const fileName = `${Date.now()}-invitation.${ext}`;
      const uploadsDir = path.join(__dirname, "..", "..", "uploads", String(event.id));
      await mkdir(uploadsDir, { recursive: true });
      const absolutePath = path.join(uploadsDir, fileName);
      await writeFile(absolutePath, req.file.buffer);
      const publicPath = `/uploads/${event.id}/${fileName}`;
      const publicBase = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
      imageUrl = `${publicBase}${publicPath}`;
      console.warn("public:storage failed, used local uploads:", storageError?.message || storageError);
    }

    res.json({ imageUrl });
  } catch (error) {
    console.error("public:upload image failed:", error);
    res.status(500).json({ error: "העלאת תמונת הזמנה נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.patch("/owner/:ownerToken/message-config", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const { messageTemplate, invitationImageUrl, channel } = req.body || {};
    if (!messageTemplate) return res.status(400).json({ error: "תוכן ההודעה הוא שדה חובה." });

    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const patch = {
      message_template: messageTemplate,
      invitation_image_url: invitationImageUrl || null,
      default_channel: channel || "sms"
    };

    const { data: updated, droppedColumns } = await updateEventWithSchemaFallback(event.id, patch);
    res.json({
      event: normalizeEventRow(updated),
      warnings:
        droppedColumns?.length
          ? ["תמונת הזמנה/הגדרות הודעה לא נשמרו כי חסרות עמודות בטבלת events בסופאבייס."]
          : []
    });
  } catch (error) {
    console.error("public:update message config failed:", error);
    res.status(500).json({ error: "עדכון הודעה נכשל.", details: error?.message || "Unknown error" });
  }
});

router.post("/owner/:ownerToken/send-invitations", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const { channel = "sms", invitationImageUrl } = req.body || {};
    const baseUrl = process.env.PUBLIC_APP_URL;
    if (!baseUrl) return res.status(500).json({ error: "חסר PUBLIC_APP_URL בקובץ הסביבה." });

    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const { data: guests, error: gErr } = await supabase.from("guests").select("*").eq("event_id", event.id);
    if (gErr) throw gErr;

    const normalizedEvent = normalizeEventRow(event);
    if (!normalizedEvent.message_template) {
      return res.status(400).json({ error: "יש להגדיר תוכן הודעה לפני שליחה." });
    }

    const effectiveImageUrl = invitationImageUrl || normalizedEvent.invitation_image_url || null;

    const perGuest = await Promise.all(
      (guests || []).map(async (guest) => {
        const g = normalizeGuestRow(guest);
        try {
          if (!isLikelyE164(guest.phone)) {
            return { ok: false, skipped: true, guestId: guest.id, name: g.full_name, phone: guest.phone, error: "מספר טלפון לא תקין (נדרש +972...)" };
          }
          if (!g.invite_token) throw new Error("לא נמצא טוקן אישי לאורח.");

          const personalLink = `${baseUrl}/rsvp/${g.invite_token}`;
          const body = normalizedEvent.message_template
            .replaceAll("{{שם}}", g.full_name)
            .replaceAll("{{לינק}}", personalLink)
            .replaceAll("{{אירוע}}", normalizedEvent.event_name || "האירוע");

          const finalBody = effectiveImageUrl ? `${body}\n\nהזמנה דיגיטלית: ${effectiveImageUrl}` : body;

          const twilioResponse = await sendMessageToGuest({
            phone: guest.phone,
            body: finalBody,
            channel,
            mediaUrl: effectiveImageUrl || null
          });
          return { ok: true, guestId: guest.id, name: g.full_name, phone: guest.phone, sid: twilioResponse.sid, status: twilioResponse.status };
        } catch (err) {
          const msg = formatTwilioErr(err) || err?.message || "Unknown error";
          return { ok: false, guestId: guest.id, name: g.full_name, phone: guest.phone, error: msg };
        }
      })
    );

    const failedItems = perGuest.filter((r) => !r.ok && !r.skipped);
    const skippedItems = perGuest.filter((r) => r.skipped);
    res.json({
      sent: perGuest.filter((r) => r.ok).length,
      failed: failedItems.length,
      skipped: skippedItems.length,
      failures: failedItems.slice(0, 25),
      skippedList: skippedItems.slice(0, 25),
      sandboxHint:
        "אם כל הנמענים נכשלו: ב-Twilio Sandbox יש לוודא שהמספר נרשם ב-join, או לשדרג לחשבון מלא."
    });
  } catch (error) {
    console.error("public:send invitations failed:", error);
    res.status(500).json({ error: "שליחת הזמנות נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.post("/owner/:ownerToken/send-reminders", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const { channel = "sms", reminderText } = req.body || {};
    const baseUrl = process.env.PUBLIC_APP_URL;
    if (!baseUrl) return res.status(500).json({ error: "חסר PUBLIC_APP_URL בקובץ הסביבה." });

    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const { data: guests, error: gErr } = await supabase.from("guests").select("*").eq("event_id", event.id);
    if (gErr) throw gErr;
    const list = guests || [];
    const guestIds = list.map((g) => g.id);

    const responded = new Set();
    if (guestIds.length) {
      const r1 = await supabase.from("responses").select("guest_id").in("guest_id", guestIds);
      if (!r1.error) (r1.data || []).forEach((r) => responded.add(r.guest_id));
      const r2 = await supabase.from("rsvp_responses").select("guest_id").in("guest_id", guestIds);
      if (!r2.error) (r2.data || []).forEach((r) => responded.add(r.guest_id));
    }

    const pendingGuests = list.filter((g) => !responded.has(g.id));
    const perGuest = await Promise.all(
      pendingGuests.map(async (guest) => {
        const g = normalizeGuestRow(guest);
        try {
          if (!g.invite_token) throw new Error("לא נמצא טוקן אישי לאורח.");
          if (!isLikelyE164(guest.phone)) return { ok: false, skipped: true, error: "מספר טלפון לא תקין" };

          await sendMessageToGuest({
            phone: guest.phone,
            channel,
            body: `${reminderText || "נשמח לאישור הגעה בהקדם"}\n${baseUrl}/rsvp/${g.invite_token}`
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: formatTwilioErr(err) || err?.message };
        }
      })
    );

    const ok = perGuest.filter((r) => r.ok).length;
    const fail = perGuest.filter((r) => !r.ok && !r.skipped).length;
    const skip = perGuest.filter((r) => r.skipped).length;
    res.json({ reminded: ok, failed: fail, skipped: skip });
  } catch (error) {
    console.error("public:send reminders failed:", error);
    res.status(500).json({ error: "שליחת תזכורות נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.get("/owner/:ownerToken/message-preview", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const pick = String(req.query?.pick || "").trim(); // "first" | "random" | guest_id
    const baseUrl = process.env.PUBLIC_APP_URL;
    if (!baseUrl) return res.status(500).json({ error: "חסר PUBLIC_APP_URL בקובץ הסביבה." });

    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const normalizedEvent = normalizeEventRow(event);
    if (!normalizedEvent.message_template) {
      return res.status(400).json({ error: "אין נוסח הודעה שמור. שמור הודעה לפני תצוגה מקדימה." });
    }

    const baseQuery = supabase.from("guests").select("*").eq("event_id", event.id);
    let chosen = null;
    if (pick && pick !== "first" && pick !== "random") {
      const r = await baseQuery.eq("id", pick).limit(1);
      if (r.error) throw r.error;
      chosen = r.data?.[0] || null;
    }
    if (!chosen) {
      const { data: guests, error: gErr } = await baseQuery.order("created_at", { ascending: true }).limit(30);
      if (gErr) throw gErr;
      if (!guests?.length) {
        return res.status(400).json({ error: "אין אורחים באירוע. העלה CSV כדי להציג תצוגה מקדימה." });
      }
      if (pick === "random") {
        chosen = guests[Math.floor(Math.random() * guests.length)];
      } else {
        chosen = guests[0];
      }
    }

    if (!chosen) {
      return res.status(400).json({ error: "אין אורחים באירוע. העלה CSV כדי להציג תצוגה מקדימה." });
    }

    const g = normalizeGuestRow(chosen);
    if (!g.invite_token) return res.status(400).json({ error: "לא נמצא טוקן אישי לאורח לדוגמה." });

    const personalLink = `${baseUrl}/rsvp/${g.invite_token}`;
    const body = normalizedEvent.message_template
      .replaceAll("{{שם}}", g.full_name)
      .replaceAll("{{לינק}}", personalLink)
      .replaceAll("{{אירוע}}", normalizedEvent.event_name || "האירוע");

    const effectiveImageUrl = normalizedEvent.invitation_image_url || null;
    const finalBody = effectiveImageUrl ? `${body}\n\nהזמנה דיגיטלית: ${effectiveImageUrl}` : body;

    res.json({
      guest: { id: chosen.id, name: g.full_name, phone: chosen.phone, invite_token: g.invite_token },
      personalLink,
      renderedBody: finalBody,
      invitationImageUrl: effectiveImageUrl
    });
  } catch (error) {
    console.error("public:message preview failed:", error);
    res.status(500).json({ error: "טעינת תצוגה מקדימה נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.get("/owner/:ownerToken/guests-sample", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 20) || 20));

    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const { data, error: gErr } = await supabase
      .from("guests")
      .select("id,full_name,name,phone,invite_token,token,created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (gErr) throw gErr;

    res.json(
      (data || []).map((r) => {
        const g = normalizeGuestRow(r);
        return { id: r.id, name: g.full_name, phone: r.phone, invite_token: g.invite_token };
      })
    );
  } catch (error) {
    console.error("public:guests sample failed:", error);
    res.status(500).json({ error: "שליפת אורחים לדוגמה נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.get("/owner/:ownerToken/invalid-phones", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const limit = Math.max(1, Math.min(300, Number(req.query?.limit || 200) || 200));

    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const { data: guests, error: gErr } = await supabase
      .from("guests")
      .select("id,full_name,name,phone,invite_token,token,created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (gErr) throw gErr;

    const invalid = [];
    for (const row of guests || []) {
      const g = normalizeGuestRow(row);
      const phone = row.phone || "";
      if (!isLikelyE164(phone)) {
        invalid.push({ id: row.id, name: g.full_name, phone });
        if (invalid.length >= limit) break;
      }
    }

    res.json({ totalChecked: (guests || []).length, invalidCount: invalid.length, invalid });
  } catch (error) {
    console.error("public:invalid phones failed:", error);
    res.status(500).json({ error: "בדיקת טלפונים נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.post("/owner/:ownerToken/fix-phones", async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const { data: guests, error: gErr } = await supabase
      .from("guests")
      .select("id,full_name,name,phone,created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (gErr) throw gErr;

    const rows = guests || [];
    const desiredById = new Map();
    const groups = new Map(); // desiredPhone -> ids
    for (const r of rows) {
      const desired = normalizeIsraelPhone(r.phone || "");
      desiredById.set(r.id, desired);
      if (!groups.has(desired)) groups.set(desired, []);
      groups.get(desired).push(r.id);
    }

    const duplicates = [];
    const allowedIds = new Set();
    for (const [p, ids] of groups.entries()) {
      if (!p) continue;
      if (ids.length === 1) {
        allowedIds.add(ids[0]);
      } else {
        // Keep the first guest, skip the rest.
        allowedIds.add(ids[0]);
        duplicates.push({ phone: p, guestIds: ids, keptGuestId: ids[0] });
      }
    }

    let updated = 0;
    let skipped = 0;
    const updatedIds = [];

    for (const r of rows) {
      const desired = desiredById.get(r.id) || "";
      if (!desired || desired === (r.phone || "")) {
        skipped += 1;
        continue;
      }
      if (!allowedIds.has(r.id)) {
        skipped += 1;
        continue;
      }

      const upd = await supabase.from("guests").update({ phone: desired }).eq("id", r.id);
      if (upd.error) {
        skipped += 1;
        continue;
      }
      updated += 1;
      updatedIds.push(r.id);
    }

    res.json({
      total: rows.length,
      updated,
      skipped,
      duplicates: duplicates.slice(0, 50),
      updatedIds
    });
  } catch (error) {
    console.error("public:fix phones failed:", error);
    res.status(500).json({ error: "תיקון טלפונים נכשל.", details: error?.message || "Unknown error" });
  }
});

function normalizePhone(raw) {
  if (!raw) return "";
  return normalizeIsraelPhone(String(raw).trim());
}

function pickRowValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] != null && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

function decodeCsvBuffer(buffer) {
  const utf8 = buffer.toString("utf8");
  const hasReplacement = utf8.includes("\uFFFD");
  if (!hasReplacement) return utf8;
  return iconv.decode(buffer, "windows-1255");
}

function detectDelimiter(firstLine) {
  const line = String(firstLine || "").replace(/^\uFEFF/, "");
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function parseCsvToRows(csvContent) {
  const withoutBom = String(csvContent || "").replace(/^\uFEFF/, "");
  const firstNl = withoutBom.indexOf("\n");
  const firstLine = firstNl >= 0 ? withoutBom.slice(0, firstNl) : withoutBom;
  const delimiter = detectDelimiter(firstLine);

  const result = Papa.parse(withoutBom, {
    header: true,
    skipEmptyLines: true,
    delimiter,
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
  let { data, error } = await supabase.from("guests").insert(guestsToInsert).select("*");
  if (!error) return data;

  const missingColumnMatch = error.message?.match(/Could not find the '([^']+)' column/);
  const missingColumn = missingColumnMatch?.[1];
  const isNewSchemaMissing = missingColumn === "full_name" || missingColumn === "invite_token";
  if (!isNewSchemaMissing) throw error;

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

router.post("/owner/:ownerToken/guests/upload-file", upload.single("csv"), async (req, res) => {
  try {
    const { ownerToken } = req.params;
    const mode = req.body?.mode === "replace" ? "replace" : "add";
    if (!req.file?.buffer) return res.status(400).json({ error: "לא נבחר קובץ CSV." });

    const { event, error } = await getEventByOwnerToken(ownerToken);
    if (error) throw error;
    if (!event) return res.status(404).json({ error: "קישור בעל אירוע לא תקין." });

    const eventId = event.id;
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
      return res.status(200).json({ count: 0, skipped: uniqueByPhone.length, mode });
    }

    const data = await insertGuestsWithSchemaFallback(toInsert);
    res.status(201).json({
      count: data.length,
      skipped: uniqueByPhone.length - toInsert.length,
      mode
    });
  } catch (error) {
    console.error("public:upload guests failed:", error);
    res.status(500).json({ error: "ייבוא האורחים נכשל.", details: error?.message || "Unknown error" });
  }
});

export default router;

