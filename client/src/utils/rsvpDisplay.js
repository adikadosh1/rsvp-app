export function responseMealColumns(response) {
  if (!response) {
    return { attendees: "-", veg: "-", kids: "-" };
  }
  const attendees = response.attendees_count ?? response.guest_count ?? "-";
  const veg = response.vegetarian_count ?? "-";
  const kids = response.kids_meals_count ?? "-";
  return { attendees, veg, kids };
}

function normalizeStatus(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const low = s.toLowerCase();

  // Already Hebrew
  if (s === "מגיע" || s === "לא מגיע" || s === "לא יודע") return s;

  // Legacy/English variants (from old schemas / constraints)
  if (["arrived", "coming", "yes", "confirmed"].includes(low)) return "מגיע";
  if (["not_arrived", "not_coming", "declined", "no"].includes(low)) return "לא מגיע";
  if (["unknown", "maybe", "pending"].includes(low)) return "לא יודע";

  // Common typos/variants
  if (low.includes("arriv") || low.includes("com")) return "מגיע";
  if (low.includes("declin") || low.includes("not")) return "לא מגיע";

  // Fallback: show whatever exists (for debugging / unexpected enums)
  return s;
}

export function statusLabel(guest) {
  const s = guest.latestResponse?.status;
  const normalized = normalizeStatus(s);
  return normalized || "טרם ענה";
}
