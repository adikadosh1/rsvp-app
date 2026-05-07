import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const smsFrom = process.env.TWILIO_SMS_FROM;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

if (!accountSid || !authToken) {
  throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in environment.");
}

const twilioClient = twilio(accountSid, authToken);

function normalizePhone(phone) {
  if (!phone) return "";
  let p = String(phone).trim().replace(/\s|-/g, "");

  // Keep leading + if exists, remove other non-digits.
  if (p.startsWith("+")) {
    p = `+${p.slice(1).replace(/\D/g, "")}`;
  } else {
    p = p.replace(/\D/g, "");
  }

  // ישראל: תמיכה במספרים מקומיים וסמי-בינלאומיים
  // 05XXXXXXXX -> +9725XXXXXXXX
  // 972XXXXXXXXX -> +972XXXXXXXXX
  if (p.startsWith("05") && p.length === 10) {
    return `+972${p.slice(1)}`;
  }
  if (p.startsWith("972") && !p.startsWith("+972")) {
    return `+${p}`;
  }
  if (p.startsWith("0") && p.length >= 9 && p.length <= 10) {
    // fallback for other Israeli local formats (02/03/04/08/09...)
    return `+972${p.slice(1)}`;
  }

  return p;
}

export function normalizeIsraelPhone(phone) {
  return normalizePhone(phone);
}

export function isLikelyE164(phone) {
  const n = normalizePhone(phone);
  return Boolean(n && n.startsWith("+") && n.length >= 11 && n.length <= 16);
}

export async function sendMessageToGuest({
  phone,
  body,
  channel = "sms",
  mediaUrl = null
}) {
  const cleanPhone = normalizePhone(phone);
  const isWhatsapp = channel === "whatsapp";
  const from = isWhatsapp ? whatsappFrom : smsFrom;

  if (!from) {
    throw new Error(`Missing ${isWhatsapp ? "TWILIO_WHATSAPP_FROM" : "TWILIO_SMS_FROM"} value.`);
  }

  if (!cleanPhone || (!cleanPhone.startsWith("+") && !isWhatsapp)) {
    throw new Error(`מספר טלפון לא תקין: "${phone}" → "${cleanPhone}"`);
  }

  const normalizedFrom = normalizePhone(from);
  const to = isWhatsapp ? `whatsapp:${cleanPhone}` : cleanPhone;
  const sender = isWhatsapp ? `whatsapp:${normalizedFrom}` : normalizedFrom;

  return twilioClient.messages.create({
    from: sender,
    to,
    body,
    ...(mediaUrl ? { mediaUrl: Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl] } : {})
  });
}
