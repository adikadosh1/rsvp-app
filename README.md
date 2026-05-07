# הושבה כיד המלך - מערכת RSVP יוקרתית

פרויקט מלא לניהול אישורי הגעה לאירועים:
- Backend ב-Node.js + Express
- Frontend ב-React + Vite
- בסיס נתונים Supabase
- שליחת הודעות WhatsApp/SMS דרך Twilio
- פריסה מומלצת על Vercel

## מה המערכת כוללת

1. יצירת אירוע עם פרטי מיקום, חניה וטלפון ליצירת קשר
2. העלאת רשימת אורחים מ-CSV (`name,phone` או `שם,טלפון`)
3. כתיבת הודעה והעלאת תמונת הזמנה אופציונלית
4. שליחה המונית של קישור אישי לכל אורח
5. מסך אורח ב-RTL עם 4 שלבים:
   - סטטוס הגעה
   - כמות משתתפים
   - מנות מיוחדות
   - מסך הצלחה עם "הוסף ליומן" ו"נווט לאירוע"
6. דשבורד מנהל בזמן אמת (רענון כל 10 שניות)
7. שליחת תזכורת אוטומטית למי שלא ענה
8. Self‑Serve לבעל אירוע: יצירת קישור ציבורי, עדכון פרטי אירוע והעלאת מוזמנים ללא גישת מנהל

## מבנה הפרויקט

```text
server/
  index.js
  routes/
  services/
client/
  src/
database/
  schema.sql
```

## התקנה והרצה מקומית

1. התקנת תלויות:
   ```bash
   npm install
   ```
2. יצירת קובץ סביבה:
   ```bash
   cp .env.example .env
   ```
3. עדכון משתני סביבה אמיתיים ב-`.env`
4. הרצת סכמת DB ב-Supabase SQL Editor:
   - הדבק את `database/schema.sql`
   - ודא שיש עמודה `owner_token` בטבלת `events` (כלול בקובץ schema.sql)
   - צור Bucket בשם `invitation-images` (Public)
5. הרצה בפיתוח:
   ```bash
   npm run dev
   ```
6. פתיחה בדפדפן:
   - ממשק מנהל: `http://localhost:5173/dashboard`
   - יצירת קישור לבעל אירוע: `http://localhost:5173/start`

## פריסה ל-Vercel

### Frontend (מומלץ)
1. ייבוא ריפו מ-GitHub ל-Vercel → New Project.
2. הגדרות בנייה:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. משתני סביבה ב-Vercel (Production):
   - `VITE_API_BASE_URL` — כתובת ה-API הציבורית שלך עם סיומת `/api`, למשל `https://api.example.com/api`

### Backend (Express)
השרת הנוכחי הוא אפליקציית Node רציפה (`server/index.js`). ב-Vercel זה דורש התאמה ל-Serverless או לפרוס את ה-Backend כשירות נפרד.

**אפשרות מומלצת לפרודקשן:** Render / Fly.io / Railway עבור ה-API, ו-Vercel רק ל-Frontend.

משתנים חשובים בשרת ה-API:
- `PUBLIC_APP_URL` — כתובת האתר של האורחים (למשל הדומיין של Vercel), לצורך קישורי RSVP בהודעות.
- `PUBLIC_API_URL` — כתובת בסיס של שרת ה-API (למשל `https://api.example.com`), לצורך קישורי תמונות כשמשתמשים בשמירת קבצים מקומית תחת `/uploads`.

## משתני סביבה חשובים

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`
- `PUBLIC_APP_URL`
- `PUBLIC_API_URL` (אופציונלי — לקישורי קבצים מהשרת)

## הערות Production

- מומלץ להוסיף אימות מנהל (Admin Auth) לפני העלאה ושליחה
- מומלץ להקשיח CORS לפי דומיין סופי בלבד
- מומלץ להוסיף Rate Limiting לנתיבי `send-invitations` ו-`send-reminders`
- מומלץ להוסיף Rate Limiting גם לנתיבים הציבוריים תחת `/api/public/*` (כדי למנוע abuse)
- מומלץ להוסיף Audit Trail מפורט לשליחות
