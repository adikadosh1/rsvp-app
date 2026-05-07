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

function unfoldVcardLines(text) {
  // RFC 6350 line folding: lines starting with space/tab continue previous line.
  const rawLines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines = [];
  for (const ln of rawLines) {
    if (!ln) continue;
    if (/^[ \t]/.test(ln) && lines.length) {
      lines[lines.length - 1] += ln.trimStart();
    } else {
      lines.push(ln);
    }
  }
  return lines;
}

function decodeVcardValue(v) {
  // Best-effort decode for common escaped sequences
  return String(v || "")
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .trim();
}

export function parseVcfToGuests(vcfText) {
  const lines = unfoldVcardLines(vcfText);
  const guests = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const name = normalizeNameForPreview(current.name);
    for (const tel of current.tels) {
      const phone = normalizePhoneForPreview(tel);
      if (name && phone) guests.push({ name, phone });
    }
    current = null;
  };

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (l.toUpperCase() === "BEGIN:VCARD") {
      current = { name: "", tels: [] };
      continue;
    }
    if (l.toUpperCase() === "END:VCARD") {
      flush();
      continue;
    }
    if (!current) continue;

    const idx = l.indexOf(":");
    if (idx < 0) continue;
    const keyPart = l.slice(0, idx);
    const valuePart = decodeVcardValue(l.slice(idx + 1));
    const key = keyPart.split(";")[0].toUpperCase();

    if (key === "FN") {
      if (!current.name) current.name = valuePart;
    } else if (key === "N") {
      // N:Last;First;Additional;Prefix;Suffix
      if (!current.name) {
        const parts = valuePart.split(";");
        const last = (parts[0] || "").trim();
        const first = (parts[1] || "").trim();
        current.name = `${first} ${last}`.trim();
      }
    } else if (key === "TEL") {
      if (valuePart) current.tels.push(valuePart);
    }
  }
  flush();

  // Dedup by phone
  const seen = new Set();
  const unique = [];
  let dupInPick = 0;
  for (const g of guests) {
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

