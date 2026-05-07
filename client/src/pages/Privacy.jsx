import BrandHeader from "../components/BrandHeader.jsx";

export default function Privacy() {
  return (
    <div className="container">
      <BrandHeader />
      <section className="card">
        <h1>מדיניות פרטיות</h1>
        <p className="hint prose">
          מסמך זה נועד לשמש תבנית בסיסית. מומלץ להתייעץ משפטית לפני שימוש בפרודקשן.
        </p>
        <h3>איזה מידע נשמר</h3>
        <p className="hint prose">
          שמות ומספרי טלפון של מוזמנים (כפי שהוזנו), ותשובות RSVP (סטטוס, כמות, מנות מיוחדות) לצורך ניהול האירוע בלבד.
        </p>
        <h3>איך משתמשים במידע</h3>
        <p className="hint prose">
          המידע משמש לשליחת הודעות RSVP, להצגת סטטוס לארגון האירוע, ולשליחת תזכורות לנמענים שלא ענו.
        </p>
        <h3>שיתוף מידע</h3>
        <p className="hint prose">
          שליחת הודעות מתבצעת דרך ספק צד ג׳ (Twilio). אין מכירה של מידע לצדדים שלישיים.
        </p>
        <h3>מחיקה</h3>
        <p className="hint prose">
          ניתן למחוק אירוע ומוזמנים בהתאם למדיניות המפעיל. מחיקה מוחקת גם תשובות הקשורות לאירוע.
        </p>
      </section>

      <footer className="footer-mini" role="contentinfo">
        <span>© {new Date().getFullYear()} הושבה כיד המלך</span>
        <span className="actions">
          <a href="/privacy">פרטיות</a>
          <a href="/terms">תנאי שימוש</a>
        </span>
      </footer>
    </div>
  );
}

