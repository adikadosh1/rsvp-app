function normalizePhoneForPreview(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  // keep leading +, remove spaces/dashes/parentheses
  const cleaned = s.replace(/[()\-\s]/g, "");
  // If multiple numbers in one string, take first chunk
  const first = cleaned.split(/[;,/]/)[0] || cleaned;
  return first.trim();
}

function normalizeNameForPreview(raw) {
  return String(raw || "").trim();
}

export function isContactPickerSupported() {
  return typeof navigator !== "undefined" && !!navigator.contacts?.select;
}

export async function pickGuestsFromContacts() {
  if (!isContactPickerSupported()) {
    throw new Error("הדפדפן לא תומך בייבוא מאנשי קשר במכשיר הזה.");
  }

  // Web Contact Picker API (mostly Android/Chrome)
  // https://web.dev/contact-picker/
  const contacts = await navigator.contacts.select(["name", "tel"], { multiple: true });
  const rows = (contacts || [])
    .flatMap((c) => {
      const name = normalizeNameForPreview(Array.isArray(c?.name) ? c.name[0] : c?.name);
      const tels = Array.isArray(c?.tel) ? c.tel : c?.tel ? [c.tel] : [];
      return tels.map((t) => ({
        name,
        phone: normalizePhoneForPreview(t)
      }));
    })
    .filter((g) => g.name && g.phone);

  // De-dupe within selection by phone (keep first)
  const seen = new Set();
  const unique = [];
  let dupInPick = 0;
  for (const g of rows) {
    if (seen.has(g.phone)) {
      dupInPick += 1;
      continue;
    }
    seen.add(g.phone);
    unique.push(g);
  }

  return { guests: unique, dupInPick };
}

export function guestsToCsvFile(guests, fileName = "contacts.csv") {
  const header = "name,phone";
  const lines = (guests || []).map((g) => `${JSON.stringify(g.name || "")},${JSON.stringify(g.phone || "")}`);
  const csv = [header, ...lines].join("\n");
  return new File([csv], fileName, { type: "text/csv;charset=utf-8" });
}

