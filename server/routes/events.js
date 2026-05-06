import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile } from "fs/promises";
import { supabase, uploadInvitationImage } from "../services/supabase.js";
import { sendMessageToGuest } from "../services/twilio.js";

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
          if (!g.invite_token) throw new Error("לא נמצא טוקן אישי לאורח.");

          const personalLink = `${baseUrl}/rsvp/${g.invite_token}`;
          const body = normalizedEvent.message_template
            .replaceAll("{{שם}}", g.full_name)
            .replaceAll("{{לינק}}", personalLink)
            .replaceAll("{{אירוע}}", normalizedEvent.event_name || "האירוע");

          const finalBody = effectiveImageUrl
            ? `${body}\n\nהזמנה דיגיטלית: ${effectiveImageUrl}`
            : body;

          console.log("[send-invitations] sending", { eventId, channel, ...safeMeta });

          const twilioResponse = await sendMessageToGuest({
            phone: guest.phone,
            body: finalBody,
            channel
          });

          console.log("[send-invitations] sent", { eventId, channel, ...safeMeta, sid: twilioResponse.sid, status: twilioResponse.status });

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
          const msg = err?.message || "Unknown error";
          const more = err?.moreInfo || err?.details || err?.code || null;
          console.warn("[send-invitations] failed", { eventId, channel, ...safeMeta, error: msg, more });
          return { ok: false, guestId: guest.id, name: g.full_name, phone: guest.phone, error: msg };
        }
      })
    );

    const failedItems = perGuest.filter((r) => !r.ok);
    res.json({
      sent: perGuest.length - failedItems.length,
      failed: failedItems.length,
      failures: failedItems.slice(0, 25)
    });
  } catch (error) {
    console.error("Send invitations failed:", error);
    res.status(500).json({ error: "שליחת הזמנות נכשלה.", details: error?.message || "Unknown error" });
  }
});

router.post("/:eventId/send-reminders", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { channel = "sms", reminderText } = req.body;
    const baseUrl = process.env.PUBLIC_APP_URL;

    const { data: guests, error } = await supabase
      .from("guests")
      .select("id, full_name, phone, invite_token, rsvp_responses(status)")
      .eq("event_id", eventId);

    if (error) throw error;

    const pendingGuests = guests.filter((guest) => !guest.rsvp_responses || guest.rsvp_responses.length === 0);

    const results = await Promise.allSettled(
      pendingGuests.map((guest) =>
        sendMessageToGuest({
          phone: guest.phone,
          channel,
          body: `${reminderText || "נשמח לאישור הגעה בהקדם"}\n${baseUrl}/rsvp/${guest.invite_token}`
        })
      )
    );

    const failed = results.filter((item) => item.status === "rejected").length;
    res.json({ reminded: results.length - failed, failed });
  } catch (error) {
    console.error("Send reminders failed:", error);
    res.status(500).json({ error: "שליחת תזכורות נכשלה." });
  }
});

export default router;
