function maskPhone(p) {
  if (!p || typeof p !== "string") return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export function logInfo(scope, payload = {}) {
  const safe = { ...payload };
  if (safe.phone) safe.phone = maskPhone(String(safe.phone));
  if (safe.raw_phone) safe.raw_phone = maskPhone(String(safe.raw_phone));
  console.log(`[${scope}]`, safe);
}

export function logWarn(scope, payload = {}) {
  const safe = { ...payload };
  if (safe.phone) safe.phone = maskPhone(String(safe.phone));
  console.warn(`[${scope}]`, safe);
}
