import express from "express";
import { supabase } from "../services/supabase.js";
import { normalizeResponseRow } from "../utils/rsvpNormalize.js";

const router = express.Router();

async function findGuestByInviteToken(token) {
  const trimmed = String(token || "").trim();
  if (!trimmed) return { guest: null, error: null };

  const legacyFirst = await supabase.from("guests").select("*").eq("token", trimmed).maybeSingle();
  if (!legacyFirst.error && legacyFirst.data) return { guest: legacyFirst.data, error: null };

  const newSchema = await supabase.from("guests").select("*").eq("invite_token", trimmed).maybeSingle();
  if (!newSchema.error && newSchema.data) return { guest: newSchema.data, error: null };

  return { guest: null, error: newSchema.error || legacyFirst.error };
}

async function fetchEventForGuest(eventId) {
  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    event_name: data.event_name ?? data.name ?? null,
    event_date: data.event_date ?? data.date ?? null,
    venue_name: data.venue_name ?? null,
    maps_url: data.maps_url ?? null,
    parking_info: data.parking_info ?? null,
    contact_phone: data.contact_phone ?? null,
    invitation_image_url: data.invitation_image_url ?? null,
    message_template: data.message_template ?? null,
    default_channel: data.default_channel ?? null
  };
}

async function fetchLatestResponse(guestId) {
  const r4 = await supabase
    .from("rsvp_responses")
    .select("*")
    .eq("guest_id", guestId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!r4.error && r4.data) return normalizeResponseRow(r4.data);

  const r3 = await supabase
    .from("responses")
    .select("*")
    .eq("guest_id", guestId)
    .order("responded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!r3.error && r3.data) return normalizeResponseRow(r3.data);

  return null;
}

function normalizeGuestForClient(row) {
  if (!row) return null;
  const token = row.invite_token ?? row.token ?? "";
  const fullName = row.full_name ?? row.name ?? "";
  return {
    ...row,
    full_name: fullName,
    invite_token: token,
    events: row.events
      ? {
          ...row.events,
          event_name: row.events.event_name ?? row.events.name ?? null,
          event_date: row.events.event_date ?? row.events.date ?? null,
          venue_name: row.events.venue_name ?? null,
          maps_url: row.events.maps_url ?? null,
          parking_info: row.events.parking_info ?? null,
          contact_phone: row.events.contact_phone ?? null
        }
      : undefined
  };
}

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { guest: rawGuest, error } = await findGuestByInviteToken(token);

    if (error || !rawGuest) {
      return res.status(404).json({ error: "קישור לא תקין או שפג תוקף." });
    }

    let guest = normalizeGuestForClient(rawGuest);
    if (!guest.events && rawGuest.event_id) {
      const ev = await fetchEventForGuest(rawGuest.event_id);
      if (ev) guest = { ...guest, events: ev };
    }

    const response = await fetchLatestResponse(rawGuest.id);

    res.json({
      guest,
      response
    });
  } catch (err) {
    console.error("Fetch RSVP token failed:", err);
    res.status(500).json({ error: "אירעה שגיאה בטעינת ההזמנה." });
  }
});

router.post("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { status, attendeesCount, vegetarianCount, kidsMealsCount } = req.body;

    if (!status) {
      return res.status(400).json({ error: "נא לבחור סטטוס הגעה." });
    }

    const attending = status === "מגיע";
    const count =
      status === "לא מגיע"
        ? 0
        : Number(attendeesCount);
    if (status !== "לא מגיע" && (!Number.isFinite(count) || count < 1)) {
      return res.status(400).json({ error: "נא למלא כמות משתתפים תקינה." });
    }

    const { guest: rawGuest, error: guestError } = await findGuestByInviteToken(token);
    if (guestError || !rawGuest) {
      return res.status(404).json({ error: "קישור אורח לא נמצא." });
    }

    const veg = Number(vegetarianCount || 0);
    const kids = Number(kidsMealsCount || 0);
    const warnings = [];

    const newPayload = {
      guest_id: rawGuest.id,
      event_id: rawGuest.event_id,
      status,
      attendees_count: count,
      vegetarian_count: attending ? veg : 0,
      kids_meals_count: attending ? kids : 0
    };

    let { data, error } = await supabase
      .from("rsvp_responses")
      .upsert(newPayload, { onConflict: "guest_id" })
      .select("*")
      .single();

    if (!error && data) {
      return res.json({ ...normalizeResponseRow(data), warnings });
    }

    {
      const msg = error?.message || "";
      if (msg.toLowerCase().includes("relation") && msg.toLowerCase().includes("rsvp_responses")) {
        warnings.push({
          code: "missing_rsvp_responses_table",
          message:
            "המערכת לא מצאה את הטבלה rsvp_responses ולכן מנות ילדים/צמחוני לא יישמרו עד לעדכון בסיס הנתונים."
        });
      } else if (msg.includes("vegetarian_count") || msg.includes("kids_meals_count")) {
        warnings.push({
          code: "missing_meal_columns_in_rsvp_responses",
          message:
            "הטבלה rsvp_responses קיימת אבל חסרות בה עמודות של מנות. עדכנו את הסכמה כדי לשמור מנות ילדים/צמחוני."
        });
      }
    }

    const legacyPayloadBase = {
      guest_id: rawGuest.id,
      guest_count: count,
      // Some legacy schemas also include meal columns; we try to write them (and will fallback if missing).
      vegetarian_count: attending ? veg : 0,
      kids_meals_count: attending ? kids : 0
    };

    const legacyStatusCandidates = (s) => {
      if (s === "מגיע") return ["מגיע", "arrived", "coming", "yes", "confirmed"];
      if (s === "לא מגיע") return ["לא מגיע", "not_arrived", "not_coming", "no", "declined"];
      return ["לא יודע", "unknown", "maybe", "pending"];
    };

    const existing = await supabase.from("responses").select("id").eq("guest_id", rawGuest.id).maybeSingle();

    let saved;
    const tryWriteLegacy = async (payload) => {
      if (!existing.error && existing.data?.id) {
        return await supabase.from("responses").update(payload).eq("guest_id", rawGuest.id).select("*").single();
      }
      return await supabase.from("responses").insert(payload).select("*").single();
    };

    const tryWriteLegacyWithMealFallbacks = async (basePayload) => {
      // Try common legacy column spellings for meals.
      const candidates = [
        basePayload,
        { ...basePayload, veg_count: basePayload.vegetarian_count, kids_count: basePayload.kids_meals_count },
        { ...basePayload, vegetarian_meals_count: basePayload.vegetarian_count, children_meals_count: basePayload.kids_meals_count },
        { ...basePayload, vegetarian: basePayload.vegetarian_count, kids: basePayload.kids_meals_count }
      ];

      let last = null;
      for (const c of candidates) {
        const wr = await tryWriteLegacy(c);
        if (!wr.error) return wr;
        last = wr;

        const msg = wr.error?.message || "";
        const missingMealColumn =
          msg.includes("vegetarian_count") ||
          msg.includes("kids_meals_count") ||
          msg.includes("veg_count") ||
          msg.includes("kids_count") ||
          msg.includes("vegetarian_meals_count") ||
          msg.includes("children_meals_count") ||
          msg.includes("vegetarian") ||
          msg.includes("kids");
        if (!missingMealColumn && !msg.toLowerCase().includes("could not find the") && !msg.toLowerCase().includes("does not exist")) {
          return wr;
        }
      }

      // Final fallback: write without any meal columns.
      return await tryWriteLegacy({ guest_id: rawGuest.id, guest_count: count, status: basePayload.status });
    };

    // Try original hebrew status first. If legacy schema has CHECK constraint, retry with common english variants.
    const candidates = legacyStatusCandidates(status);
    let lastErr = null;
    for (const cand of candidates) {
      // First attempt: include meal fields (if legacy table supports them).
      const wr = await tryWriteLegacyWithMealFallbacks({ ...legacyPayloadBase, status: cand });
      if (!wr.error && wr.data) {
        saved = wr.data;
        lastErr = null;
        break;
      }
      lastErr = wr.error;
      // If it's NOT a status check constraint issue, don't keep retrying.
      const msg = wr.error?.message || "";
      if (!msg.includes("responses_status_check") && !msg.toLowerCase().includes("check constraint")) {
        break;
      }
    }
    if (lastErr) throw lastErr;

    const normalized = normalizeResponseRow(saved);
    const mealsMissing =
      normalized &&
      attending &&
      (normalized.vegetarian_count == null || normalized.kids_meals_count == null);
    if (mealsMissing) {
      warnings.push({
        code: "meals_not_persisted",
        message:
          "התשובה נשמרה, אבל מנות ילדים/צמחוני לא נשמרו כי חסרות עמודות מתאימות בבסיס הנתונים."
      });
      warnings.push({
        code: "sql_fix",
        message:
          "הרץ ב-Supabase SQL Editor:\n\nALTER TABLE public.responses ADD COLUMN IF NOT EXISTS vegetarian_count int NOT NULL DEFAULT 0;\nALTER TABLE public.responses ADD COLUMN IF NOT EXISTS kids_meals_count int NOT NULL DEFAULT 0;"
      });
    }

    res.json({ ...normalized, warnings });
  } catch (err) {
    console.error("Submit RSVP failed:", err);
    res.status(500).json({ error: "שמירת ה-RSVP נכשלה.", details: err?.message });
  }
});

export default router;
