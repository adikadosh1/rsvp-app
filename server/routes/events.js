import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile } from "fs/promises";
import { supabase, uploadInvitationImage } from "../services/supabase.js";
import { sendMessageToGuest, isLikelyE164, smsSenderConfigured } from "../services/twilio.js";
import { logInfo, logWarn } from "../utils/logger.js";
import { normalizeResponseRow } from "../utils/rsvpNormalize.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function insertEventWithSchemaFallback(basePayload) {
  const payload = { ...basePayload };
  // Optional fields that may not exist in older DB schema versions.
  const optionalColumns = new Set(["venue_name", "maps_url", "parking_info", "contact_phone"]);
  let mappedToLegacyColumns = false;

  // Retry insert when an optional column is missing from DB schema cache.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase.from("events").insert(payload).select("*").single();

    if (!error) return data;

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
      delete payload[missingColumn];
      continue;
    }

    throw error;
  }

  throw new Error("Failed to insert event due to unresolved schema mismatch.");
}

function normalizeEventRow(row) {
  return {
    ...row,
    event_name: row.event_name ?? row.name ?? null,
    event_date: row.event_date ?? row.date ?? null,
    invitation_image_url: row.invitation_image_url ?? null,
    default_channel: row.default_channel ?? null
  };
}

function normalizeGuestRow(row) {
  return {
    ...row,
    full_name: row.full_name ?? row.name ?? "",
    invite_token: row.invite_token ?? row.token ?? ""
  };
}

async function updateEventMessageConfigWithSchemaFallback({ eventId, messageTemplate, invitationImageUrl, channel }) {
  const payload = {
    message_template: messageTemplate,
    invitation_image_url: invitationImageUrl || null,
    default_channel: channel || "sms"
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase.from("events").update(payload).eq("id", eventId).select("*").single();
    if (!error) return data;

    const missingColumnMatch = error.message?.match(/Could not find the '([^']+)' column/);
    const missingColumn = missingColumnMatch?.[1];
    if (missingColumn && Object.hasOwn(payload, missingColumn)) {
      delete payload[missingColumn];
      continue;
    }
    throw error;
  }

  throw new Error("Failed to update message config due to schema mismatch.");
}

function formatTwilioErr(err) {
  const code = err?.code ?? err?.status;
  const msg = err?.message || String(err);
  const more = err?.moreInfo || err?.details;
  return [msg, code, more].filter(Boolean).join(" | ");
}

router.post("/", async (req, res) => {
  try {
    const { eventName, eventDate, venueName, mapsUrl, parkingInfo, contactPhone } = req.body;

    if (!eventName || !eventDate) {
      return res.status(400).json({ error: "שם אירוע ותאריך הם שדות חובה." });
    }

    const insertPayload = {
      event_name: eventName,
      event_date: eventDate,
      ...(venueName ? { venue_name: venueName } : {}),
      ...(mapsUrl ? { maps_url: mapsUrl } : {}),
      ...(parkingInfo ? { parking_info: parkingInfo } : {}),
      ...(contactPhone ? { contact_phone: contactPhone } : {})
    };
    const data = await insertEventWithSchemaFallback(insertPayload);

    res.status(201).json(normalizeEventRow({ ...data, event_name: data.event_name ?? data.name ?? eventName, event_date: data.event_date ?? data.date ?? eventDate }));
  } catch (error) {
    console.error("Create event failed:", error);
    res.status(500).json({
      error: "יצירת אירוע נכשלה.",
      details: error?.message || "Unknown error"
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    res.json((data || []).map(normalizeEventRow));
  } catch (error) {
    console.error("List events failed:", error);
    res.status(500).json({ error: "שליפת אירועים נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.get("/:eventId/send-preflight", async (req, res) => {
  try {
    const { eventId } = req.params;
    const [{ data: ev, error: evErr }, { data: guests, error: gErr }] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase.from("guests").select("*").eq("event_id", eventId)
    ]);
    if (evErr) throw evErr;
    if (gErr) throw gErr;

    const normalizedEvent = normalizeEventRow(ev);
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
      hasMessageTemplate: Boolean(normalizedEvent.message_template),
      publicAppUrlSet: Boolean(process.env.PUBLIC_APP_URL),
      twilioSmsFromSet: smsSenderConfigured(),
      twilioWhatsappFromSet: Boolean(process.env.TWILIO_WHATSAPP_FROM),
      sandboxHint:
        "ב-Twilio Sandbox רק מספרים שהצטרפו לסנדבוקס יכולים לקבל הודעות. נדרש גם קוד JOIN מהטלפון של הנמען."
    });
  } catch (error) {
    console.error("Preflight failed:", error);
    res.status(500).json({ error: "שגיאה בבדיקת מוכנות שליחה." });
  }
});

router.get("/:eventId/response-timeline", async (req, res) => {
  try {
    const { eventId } = req.params;
    const now = Date.now();
    const start = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // Guests table schema may vary (new: full_name, legacy: name). Use a safe fallback.
    let guestRows = [];
    {
      const r1 = await supabase.from("guests").select("id,full_name,name").eq("event_id", eventId);
      if (!r1.error) {
        guestRows = r1.data || [];
      } else {
        const msg = r1.error?.message || "";
        if (msg.includes("full_name") || msg.toLowerCase().includes("column") || msg.toLowerCase().includes("does not exist")) {
          const r2 = await supabase.from("guests").select("id,name").eq("event_id", eventId);
          if (r2.error) throw r2.error;
          guestRows = r2.data || [];
        } else {
          throw r1.error;
        }
      }
    }

    const guestIds = (guestRows || []).map((g) => g.id).filter(Boolean);
    if (guestIds.length === 0) {
      return res.json({
        byHour: Array.from({ length: 24 }, (_, i) => ({ hourLabel: `${i}`, count: 0 })),
        recent: []
      });
    }

    const fetchFrom = async (table) => {
      const r = await supabase
        .from(table)
        .select("*")
        .in("guest_id", guestIds)
        .gte("updated_at", start);
      if (!r.error) return r.data || [];
      // Some legacy rows may not have updated_at; try created_at/responded_at by pulling all and filtering in-memory (small window).
      const r2 = await supabase.from(table).select("*").in("guest_id", guestIds);
      if (r2.error) return [];
      return (r2.data || []).filter((row) => {
        const t = new Date(row.updated_at || row.responded_at || row.created_at || 0).getTime();
        return Number.isFinite(t) && t >= now - 24 * 60 * 60 * 1000;
      });
    };

    let rows = await fetchFrom("responses");
    if (!rows.length) rows = await fetchFrom("rsvp_responses");

    const buckets = Array.from({ length: 24 }, (_, i) => ({ hourLabel: `${i}`, count: 0 }));
    const recent = [];
    for (const row of rows) {
      const nr = normalizeResponseRow(row);
      const ts = new Date(nr.updated_at || 0).getTime();
      if (!Number.isFinite(ts)) continue;
      const diffH = Math.floor((now - ts) / (60 * 60 * 1000));
      if (diffH < 0 || diffH >= 24) continue;
      const idx = 24 - 1 - diffH;
      buckets[idx].count += 1;
      recent.push(nr);
    }

    recent.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    const nameByGuestId = new Map((guestRows || []).map((g) => [g.id, g.full_name ?? g.name ?? ""]));

    res.json({
      byHour: buckets,
      recent: recent.slice(0, 12).map((r) => ({
        guest_id: r.guest_id,
        name: nameByGuestId.get(r.guest_id) || "",
        status: r.status || "",
        attendees_count: r.attendees_count ?? null,
        updated_at: r.updated_at || null
      }))
    });
  } catch (error) {
    console.error("response-timeline failed:", error);
    res.status(500).json({ error: "שליפת timeline נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (error) throw error;
    res.json(normalizeEventRow(data));
  } catch (error) {
    res.status(404).json({ error: "אירוע לא נמצא." });
  }
});

router.post("/:eventId/message-assets", upload.single("invitationImage"), async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: "לא נבחר קובץ תמונה." });
    }
    // Prefer Supabase Storage; fallback to local uploads when storage isn't available.
    let imageUrl = null;
    try {
      imageUrl = await uploadInvitationImage(req.file.buffer, eventId, req.file.mimetype);
    } catch (storageError) {
      const ext = (req.file.mimetype || "image/jpeg").split("/")[1] || "jpg";
      const fileName = `${Date.now()}-invitation.${ext}`;
      const uploadsDir = path.join(__dirname, "..", "..", "uploads", eventId);
      await mkdir(uploadsDir, { recursive: true });
      const absolutePath = path.join(uploadsDir, fileName);
      await writeFile(absolutePath, req.file.buffer);
      const publicPath = `/uploads/${eventId}/${fileName}`;
      const publicBase =
        process.env.PUBLIC_API_URL ||
        `${req.protocol}://${req.get("host")}`;
      imageUrl = `${publicBase}${publicPath}`;
      console.warn("Supabase Storage failed, used local uploads:", storageError?.message || storageError);
    }

    res.json({ imageUrl });
  } catch (error) {
    console.error("Upload image failed:", error);
    res.status(500).json({ error: "העלאת תמונת הזמנה נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.patch("/:eventId/message-config", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { messageTemplate, invitationImageUrl, channel } = req.body;

    if (!messageTemplate) {
      return res.status(400).json({ error: "תוכן ההודעה הוא שדה חובה." });
    }

    const data = await updateEventMessageConfigWithSchemaFallback({
      eventId,
      messageTemplate,
      invitationImageUrl,
      channel
    });

    res.json(normalizeEventRow(data));
  } catch (error) {
    console.error("Update message config failed:", error);
    res.status(500).json({ error: "עדכון הודעה נכשל.", details: error?.message || "Unknown error" });
  }
});

router.post("/:eventId/send-invitations", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { channel = "sms", invitationImageUrl } = req.body;
    const baseUrl = process.env.PUBLIC_APP_URL;

    if (!baseUrl) {
      return res.status(500).json({ error: "חסר PUBLIC_APP_URL בקובץ הסביבה." });
    }

    const [{ data: event, error: eventError }, { data: guests, error: guestsError }] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase.from("guests").select("*").eq("event_id", eventId)
    ]);

    if (eventError) throw eventError;
    if (guestsError) throw guestsError;
    const normalizedEvent = normalizeEventRow(event);
    if (!normalizedEvent.message_template) {
      return res.status(400).json({ error: "יש להגדיר תוכן הודעה לפני שליחה." });
    }

    const effectiveImageUrl = invitationImageUrl || normalizedEvent.invitation_image_url || null;

    const perGuest = await Promise.all(
      guests.map(async (guest) => {
        const g = normalizeGuestRow(guest);
        const safeMeta = { guest_id: guest.id, name: g.full_name, raw_phone: guest.phone };

        try {
          if (!isLikelyE164(guest.phone)) {
            return { ok: false, skipped: true, guestId: guest.id, name: g.full_name, phone: guest.phone, error: "מספר טלפון לא תקין (נדרש פורמט בינלאומי, למשל +9725...)" };
          }
          if (!g.invite_token) throw new Error("לא נמצא טוקן אישי לאורח.");

          const personalLink = `${baseUrl}/rsvp/${g.invite_token}`;
          const body = normalizedEvent.message_template
            .replaceAll("{{שם}}", g.full_name)
            .replaceAll("{{לינק}}", personalLink)
            .replaceAll("{{אירוע}}", normalizedEvent.event_name || "האירוע");

          // If we send the invitation as media, no need to include the image URL in the text.
          const finalBody = body;

          logInfo("send-invitations:sending", { eventId, channel, guest_id: guest.id, name: g.full_name });

          const twilioResponse = await sendMessageToGuest({
            phone: guest.phone,
            body: finalBody,
            channel,
            mediaUrl: effectiveImageUrl || null
          });

          logInfo("send-invitations:sent", { eventId, channel, guest_id: guest.id, sid: twilioResponse.sid, status: twilioResponse.status });

          // Optional logging table (may not exist in legacy schema)
          try {
            await supabase.from("message_logs").insert({
              guest_id: guest.id,
              event_id: eventId,
              channel,
              twilio_sid: twilioResponse.sid,
              status: twilioResponse.status
            });
          } catch (_e) {
            // ignore
          }

          return { ok: true, guestId: guest.id, name: g.full_name, phone: guest.phone, sid: twilioResponse.sid, status: twilioResponse.status };
        } catch (err) {
          const msg = formatTwilioErr(err) || err?.message || "Unknown error";
          logWarn("send-invitations:failed", { eventId, channel, guest_id: guest.id, error: msg });
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
    console.error("Send invitations failed:", error);
    res.status(500).json({ error: "שליחת הזמנות נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.post("/:eventId/guests/:guestId/send-reminder", async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { channel = "sms", reminderText } = req.body || {};
    const baseUrl = process.env.PUBLIC_APP_URL;
    if (!baseUrl) return res.status(500).json({ error: "חסר PUBLIC_APP_URL בקובץ הסביבה." });

    const { data: guest, error } = await supabase
      .from("guests")
      .select("*")
      .eq("id", guestId)
      .eq("event_id", eventId)
      .single();
    if (error || !guest) return res.status(404).json({ error: "אורח לא נמצא." });

    const g = normalizeGuestRow(guest);
    if (!g.invite_token) return res.status(400).json({ error: "לא נמצא טוקן אישי לאורח." });
    if (!isLikelyE164(guest.phone)) return res.status(400).json({ error: "מספר טלפון לא תקין" });

    await sendMessageToGuest({
      phone: guest.phone,
      channel,
      body: `${reminderText || "נשמח לאישור הגעה בהקדם"}\n${baseUrl}/rsvp/${g.invite_token}`
    });

    res.json({ ok: true, guestId });
  } catch (error) {
    console.error("Send single reminder failed:", error);
    res.status(500).json({ error: formatTwilioErr(error) || "שליחת תזכורת נכשלה." });
  }
});

router.post("/:eventId/send-reminders", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { channel = "sms", reminderText } = req.body;
    const baseUrl = process.env.PUBLIC_APP_URL;
    if (!baseUrl) return res.status(500).json({ error: "חסר PUBLIC_APP_URL בקובץ הסביבה." });

    const { data: guests, error } = await supabase.from("guests").select("*").eq("event_id", eventId);
    if (error) throw error;
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
          if (!isLikelyE164(guest.phone)) {
            return { ok: false, skipped: true, error: "מספר טלפון לא תקין" };
          }
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
    console.error("Send reminders failed:", error);
    res.status(500).json({ error: "שליחת תזכורות נכשלה." });
  }
});

export default router;
