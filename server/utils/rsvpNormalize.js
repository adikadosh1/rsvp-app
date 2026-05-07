/**
 * Unified RSVP row shape for API responses (legacy `responses` + new `rsvp_responses`).
 */
export function normalizeResponseRow(row) {
  if (!row) return null;
  const attendees = row.attendees_count ?? row.guest_count ?? null;
  return {
    ...row,
    status: row.status ?? null,
    attendees_count: attendees,
    // Legacy schemas may use different column names for meal counts.
    vegetarian_count:
      row.vegetarian_count ??
      row.veg_count ??
      row.vegetarian_meals_count ??
      row.vegetarian ??
      row.veg ??
      null,
    kids_meals_count:
      row.kids_meals_count ??
      row.kids_count ??
      row.children_meals_count ??
      row.child_meals_count ??
      row.kids_meals ??
      row.kids ??
      null,
    updated_at: row.updated_at ?? row.responded_at ?? row.created_at ?? null
  };
}
