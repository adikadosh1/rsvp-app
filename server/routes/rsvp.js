import express from "express";
import { supabase } from "../services/supabase.js";

const router = express.Router();

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { data: guest, error } = await supabase
      .from("guests")
      .select("id, full_name, invite_token, event_id, events(*)")
      .eq("invite_token", token)
      .single();

    if (error || !guest) {
      return res.status(404).json({ error: "קישור לא תקין או שפג תוקף." });
    }

    const { data: response } = await supabase
      .from("rsvp_responses")
      .select("*")
      .eq("guest_id", guest.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({
      guest,
      response: response || null
    });
  } catch (error) {
    console.error("Fetch RSVP token failed:", error);
    res.status(500).json({ error: "אירעה שגיאה בטעינת ההזמנה." });
  }
});

router.post("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { status, attendeesCount, vegetarianCount, kidsMealsCount } = req.body;

    if (!status || !attendeesCount) {
      return res.status(400).json({ error: "נא למלא סטטוס וכמות משתתפים." });
    }

    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select("id, event_id")
      .eq("invite_token", token)
      .single();

    if (guestError || !guest) {
      return res.status(404).json({ error: "קישור אורח לא נמצא." });
    }

    const payload = {
      guest_id: guest.id,
      event_id: guest.event_id,
      status,
      attendees_count: Number(attendeesCount),
      vegetarian_count: Number(vegetarianCount || 0),
      kids_meals_count: Number(kidsMealsCount || 0)
    };

    const { data, error } = await supabase
      .from("rsvp_responses")
      .upsert(payload, { onConflict: "guest_id" })
      .select("*")
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Submit RSVP failed:", error);
    res.status(500).json({ error: "שמירת ה-RSVP נכשלה." });
  }
});

export default router;
