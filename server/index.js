import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import eventsRouter from "./routes/events.js";
import guestsRouter from "./routes/guests.js";
import rsvpRouter from "./routes/rsvp.js";
import adminRouter, { requireAdmin } from "./routes/admin.js";
import publicRouter from "./routes/public.js";

const app = express();
const port = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") || "*"
  })
);
app.use(express.json({ limit: "5mb" }));

// Local uploads fallback (when Supabase Storage isn't configured/available)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

function createRateLimiter({ windowMs, max, keyGenerator }) {
  const hits = new Map(); // key -> { count, resetAt }
  const keyFn = keyGenerator || ((req) => req.ip || "unknown");

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const prev = hits.get(key);
    if (!prev || now >= prev.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    prev.count += 1;
    if (prev.count > max) {
      const retryAfter = Math.max(1, Math.ceil((prev.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "יותר מדי בקשות. נסה שוב בעוד כמה רגעים." });
    }

    return next();
  };
}

const publicLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 120 });
const publicSendLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => `${req.ip || "unknown"}:${req.path}`
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "hoshava-kid-hamelech-api" });
});

app.use("/api/admin", adminRouter);
// Public self-serve routes (rate-limited)
app.use("/api/public", publicLimiter, (req, res, next) => {
  if (req.path.includes("/send-invitations") || req.path.includes("/send-reminders")) {
    return publicSendLimiter(req, res, next);
  }
  return next();
});
app.use("/api/public", publicRouter);

// Protect admin routes
app.use("/api/events", requireAdmin, eventsRouter);
app.use("/api/guests", requireAdmin, guestsRouter);
app.use("/api/rsvp", rsvpRouter);

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "שגיאה פנימית בשרת." });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
