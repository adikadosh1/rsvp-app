import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

const jwtSecret = process.env.ADMIN_JWT_SECRET;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!jwtSecret || !adminPassword) {
  // Don't throw at import-time in production; allow server to boot for public pages.
  console.warn("Admin auth not configured: missing ADMIN_JWT_SECRET or ADMIN_PASSWORD");
}

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  if (!adminPassword || !jwtSecret) {
    return res.status(500).json({ error: "אימות מנהל לא מוגדר בשרת." });
  }

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: "סיסמה שגויה." });
  }

  const token = jwt.sign({ role: "admin" }, jwtSecret, { expiresIn: "12h" });
  res.json({ token });
});

router.get("/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token || !jwtSecret) return res.status(401).json({ error: "לא מחובר." });

  try {
    const payload = jwt.verify(token, jwtSecret);
    res.json({ ok: true, payload });
  } catch (_e) {
    res.status(401).json({ error: "טוקן לא תקין או פג תוקף." });
  }
});

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "נדרשת התחברות מנהל." });
  if (!jwtSecret) return res.status(500).json({ error: "אימות מנהל לא מוגדר בשרת." });

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload?.role !== "admin") return res.status(403).json({ error: "אין הרשאות." });
    return next();
  } catch (_e) {
    return res.status(401).json({ error: "טוקן לא תקין או פג תוקף." });
  }
}

export default router;
