import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const smsFrom = String(process.env.TWILIO_SMS_FROM || "").trim();
const smsMessagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
const whatsappFrom = String(process.env.TWILIO_WHATSAPP_FROM || "").trim();

/** SMS ייעודי (מספר או Messaging Service) — Sandbox של WhatsApp לא מחליף את זה. */
export function smsSenderConfigured() {
  const mg = resolveMessagingServiceSid();
  return Boolean(mg || smsFrom);
}

function resolveMessagingServiceSid() {
  if (smsMessagingServiceSid.startsWith("MG")) return smsMessagingServiceSid;
  if (smsFrom.startsWith("MG")) return smsFrom;
  return "";
}

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

function stripWhatsappScheme(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  return s.startsWith("whatsapp:") ? s.slice("whatsapp:".length).trim() : s;
}

function smsFromPhoneE164() {
  if (!smsFrom || smsFrom.startsWith("MG")) return "";
  return normalizePhone(smsFrom);
}

function coerceMediaList(mediaUrl) {
  if (mediaUrl == null) return [];
  const arr = Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl];
  return arr.filter(Boolean);
}

/**
 * SMS/MMS/WhatsApp דרך Twilio.
 * כשמצורפת תמונה ל-SMS, Twilio שולח MMS — ליעדים רבים (כולל +972) זה נכשל לעיתים; במקרה כזה מתבצעת שליחת SMS רגיל + קישור לתמונה.
 */
export async function sendMessageToGuest({
  phone,
  body,
  channel = "sms",
  mediaUrl = null
}) {
  const cleanPhone = normalizePhone(phone);
  const isWhatsapp = channel === "whatsapp";

  const mediaUrls = coerceMediaList(mediaUrl);

  if (isWhatsapp && !whatsappFrom) {
    throw new Error("Missing TWILIO_WHATSAPP_FROM value.");
  }

  const mgSid = resolveMessagingServiceSid();
  if (!isWhatsapp && !mgSid && !smsFromPhoneE164()) {
    throw new Error(
      'חסר שולח SMS: הגדרו מספר Twilio ל-SMS או Messaging Service.\nSandbox של WhatsApp (+14155238886) מאפשר שליחת הודעות רק בתור WhatsApp (`TWILIO_WHATSAPP_FROM`), לא כ-SMS — יש רכוש מספר SMS ב-Twilio או `TWILIO_MESSAGING_SERVICE_SID`.'
    );
  }

  if (!cleanPhone || (!cleanPhone.startsWith("+") && !isWhatsapp)) {
    throw new Error(`מספר טלפון לא תקין: "${phone}" → "${cleanPhone}"`);
  }

  const to = isWhatsapp ? `whatsapp:${cleanPhone}` : cleanPhone;

  if (isWhatsapp) {
    const waBase = normalizePhone(stripWhatsappScheme(whatsappFrom));
    if (!waBase.startsWith("+")) {
      throw new Error("TWILIO_WHATSAPP_FROM חייב להיות מספר בפורמט בינלאומי (כולל +). אפשר גם עם קידומת whatsapp:");
    }
    const sender = `whatsapp:${waBase}`;
    return twilioClient.messages.create({
      from: sender,
      to,
      body,
      ...(mediaUrls.length ? { mediaUrl: mediaUrls } : {})
    });
  }

  const useMessagingSid = Boolean(mgSid);

  // MMS ליעדים בישראל (+972) כמעט תמיד נכשל או לא נתמך ב-Twilio — שולחים SMS עם קישור לתמונה
  if (mediaUrls.length && cleanPhone.startsWith("+972")) {
    const link = mediaUrls[0];
    const plainBody = link && !body.includes(String(link)) ? `${body}\n\nתצוגת הזמנה: ${link}` : body;
    const smsPayload = useMessagingSid
      ? { messagingServiceSid: mgSid, to, body: plainBody }
      : { from: smsFromPhoneE164(), to, body: plainBody };
    return twilioClient.messages.create(smsPayload);
  }

  let payload;

  if (useMessagingSid) {
    payload = { messagingServiceSid: mgSid, to, body };
    if (mediaUrls.length) payload.mediaUrl = mediaUrls;
  } else {
    const normalizedFrom = smsFromPhoneE164();
    if (!normalizedFrom.startsWith("+")) {
      throw new Error(
        'TWILIO_SMS_FROM לא תקין. צפוי מספר E.164 (למשל +12025550123) או SID של Messaging Service המתחיל ב-MG (או הגדר TWILIO_MESSAGING_SERVICE_SID).\nלא ניתן לשולח SMS עם אותו מספר Sandbox של WhatsApp בלבד — נדרש מספר SMS פעיל בחשבון Twilio.'
      );
    }
    payload = { from: normalizedFrom, to, body };
    if (mediaUrls.length) payload.mediaUrl = mediaUrls;
  }

  try {
    return await twilioClient.messages.create(payload);
  } catch (err) {
    // נסיון שני ללא MMS — הרבה מסלולי Twilio/ספקים דוחים MMS בינלאומי
    if (!mediaUrls.length || !body) throw err;

    const link = mediaUrls[0];
    const appendix = link ? `\n\nתצוגת הזמנה: ${link}` : "";
    const plainBody = link && !body.includes(String(link)) ? `${body}${appendix}` : body;

    const plainPayload = useMessagingSid
      ? { messagingServiceSid: mgSid, to, body: plainBody }
      : { from: smsFromPhoneE164(), to, body: plainBody };

    try {
      return await twilioClient.messages.create(plainPayload);
    } catch (fallbackErr) {
      fallbackErr.firstAttempt = err;
      throw fallbackErr;
    }
  }
}
