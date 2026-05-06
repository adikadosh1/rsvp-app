import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import eventsRouter from "./routes/events.js";
import guestsRouter from "./routes/guests.js";
import rsvpRouter from "./routes/rsvp.js";

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "hoshava-kid-hamelech-api" });
});

app.use("/api/events", eventsRouter);
app.use("/api/guests", guestsRouter);
app.use("/api/rsvp", rsvpRouter);

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "שגיאה פנימית בשרת." });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
