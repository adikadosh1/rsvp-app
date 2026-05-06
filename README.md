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
   - צור Bucket בשם `invitation-images` (Public)
5. הרצה בפיתוח:
   ```bash
   npm run dev
   ```
6. פתיחה בדפדפן:
   - ממשק מנהל: `http://localhost:5173/dashboard`

## פריסה ל-Vercel

### Frontend
- Root directory: `./`
- Build command: `npm run build`
- Output directory: `dist`

### Backend
- ניתן לפרוס כ-Vercel Serverless Functions או כשירות Node נפרד.
- אם פורסים בנפרד, יש לעדכן `VITE_API_BASE_URL`.

## משתני סביבה חשובים

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`
- `PUBLIC_APP_URL`

## הערות Production

- מומלץ להוסיף אימות מנהל (Admin Auth) לפני העלאה ושליחה
- מומלץ להקשיח CORS לפי דומיין סופי בלבד
- מומלץ להוסיף Rate Limiting לנתיבי `send-invitations` ו-`send-reminders`
- מומלץ להוסיף Audit Trail מפורט לשליחות
