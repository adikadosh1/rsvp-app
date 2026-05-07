import BrandHeader from "../components/BrandHeader.jsx";

export default function Terms() {
  return (
    <div className="container">
      <BrandHeader />
      <section className="card">
        <h1>תנאי שימוש</h1>
        <p className="hint prose">
          מסמך זה נועד לשמש תבנית בסיסית. מומלץ להתייעץ משפטית לפני שימוש בפרודקשן.
        </p>
        <h3>מה השירות עושה</h3>
        <p className="hint prose">
          המערכת מאפשרת יצירה וניהול אירוע, העלאת מוזמנים ושליחת הודעות RSVP, וקבלת תשובות מהאורחים.
        </p>
        <h3>אחריות</h3>
        <p className="hint prose">
          בעל האירוע אחראי לתוכן ההודעות, לנכונות מספרי הטלפון, ולהסכמת הנמענים לקבל הודעות. השירות מסופק “כמות שהוא”.
        </p>
        <h3>שימוש ראוי</h3>
        <p className="hint prose">
          אין להשתמש במערכת לספאם, הטרדה או שליחה לנמענים ללא הסכמה. במקרה של ניצול לרעה, ניתן לחסום שימוש.
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

