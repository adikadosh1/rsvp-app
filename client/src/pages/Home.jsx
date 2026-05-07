import { Link } from "react-router-dom";
import BrandHeader from "../components/BrandHeader.jsx";

function Section({ id, title, subtitle, children }) {
  return (
    <section id={id} className="card home-section">
      <div className="home-section-head">
        <h2 style={{ margin: 0 }}>{title}</h2>
        {subtitle ? (
          <p className="hint" style={{ marginTop: 8 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="prose">{children}</div>
    </section>
  );
}

function TopNav() {
  const items = [
    { href: "#home", label: "דף הבית" },
    { href: "#about", label: "אודות" },
    { href: "#services", label: "השירותים שלנו" },
    { href: "#pricing", label: "מחירון" },
    { href: "#story", label: "קצת עלינו" },
    { href: "#contact", label: "צור קשר" }
  ];

  return (
    <nav className="home-nav" aria-label="תפריט ראשי">
      <div className="home-nav-inner">
        <a className="home-nav-brand" href="#home" aria-label="חזרה לדף הבית">
          הושבה <span>כיד המלך</span>
        </a>
        <div className="home-nav-links">
          {items.map((it) => (
            <a key={it.href} className="home-nav-link" href={it.href}>
              {it.label}
            </a>
          ))}
          <Link className="btn btn-ghost home-nav-cta" to="/login">
            כניסת מנהל
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function Home() {
  return (
    <div className="container home-page">
      <TopNav />
      <BrandHeader />

      <section id="home" className="card hero">
        <div className="hero-inner">
          <div className="hero-kicker">PREMIUM EVENT OPS</div>
          <h1 className="hero-title">
            שירותי <span>הושבה</span> ו‑<span>אישורי הגעה</span>
          </h1>
          <p className="hero-sub">
            חוויית אירוע מדויקת מתחילה בתכנון נכון. אנחנו משלבים הושבה חכמה, איסוף אישורי הגעה (RSVP) בזמן אמת, והפקת נתונים
            שמייצרת שקט – לך ולמשפחה.
          </p>

          <div className="actions" style={{ marginTop: 14 }}>
            <a className="btn btn-gold" href="#contact">
              דברו איתנו
            </a>
            <a className="btn btn-accent" href="#services">
              מה אנחנו מציעים
            </a>
          </div>
        </div>
      </section>

      <Section
        id="about"
        title="אודות"
        subtitle="שירותי פרימיום שמחברים בין אנשים, מקום, וקצב."
      >
        <p>
          “הושבה כיד המלך” נולדה מתוך הרצון להפוך את ניהול האירוע לחוויה נעימה, מסודרת ויוקרתית. אנחנו מקפידים על דיוק, תקשורת
          ברורה עם האורחים, ונראות שמכבדת את המעמד.
        </p>
        <p>
          המערכת שלנו מאפשרת לאסוף אישורי הגעה בקלות, לעקוב אחרי סטטוסים בזמן אמת, לנהל כמויות ומנות מיוחדות – וליצור תמונת מצב
          אחת, נקייה, שמחליפה עשרות הודעות וטלפונים.
        </p>
      </Section>

      <Section id="services" title="השירותים שלנו" subtitle="מ‑A עד Z – כדי שהאירוע יהיה מדויק.">
        <ul>
          <li>
            <strong>שירותי הושבה באירועים</strong>: תכנון וסידור שולחנות, התאמות משפחתיות, איזון בין קבוצות, והפקת תרשימי הושבה
            ברורים.
          </li>
          <li>
            <strong>אישורי הגעה (RSVP)</strong>: שליחת הודעות אישיות עם קישור, קבלת סטטוס מגיע/לא מגיע/לא יודע, כמות מגיעים,
            ומנות מיוחדות.
          </li>
          <li>
            <strong>דשבורד מנהל בזמן אמת</strong>: סטטיסטיקות, חיפוש וסינון, רשימת אורחים, וכל המידע במקום אחד.
          </li>
          <li>
            <strong>תזכורות חכמות</strong>: תזכורת אוטומטית למי שלא ענה – בלי להתעסק ידנית.
          </li>
        </ul>
      </Section>

      <Section id="pricing" title="מחירון" subtitle="שקוף, פשוט, ועם אפשרות להתאמה אישית.">
        <div className="home-pricing">
          <div className="home-price card">
            <div className="home-price-kicker">RSVP</div>
            <div className="home-price-title">חבילת אישורי הגעה</div>
            <div className="home-price-sub">ליווי + הקמת אירוע + מערכת מלאה</div>
            <div className="home-price-points">
              <div>תבנית הודעה מותאמת</div>
              <div>ניהול רשימת אורחים</div>
              <div>דשבורד בזמן אמת</div>
            </div>
            <a className="btn btn-gold" href="#contact">
              קבלו הצעה
            </a>
          </div>

          <div className="home-price card">
            <div className="home-price-kicker">SEATING</div>
            <div className="home-price-title">חבילת הושבה</div>
            <div className="home-price-sub">תכנון שולחנות + תרשימי הושבה</div>
            <div className="home-price-points">
              <div>תיאום העדפות</div>
              <div>איזון קבוצות ומשפחות</div>
              <div>פלט תרשים ברור</div>
            </div>
            <a className="btn btn-accent" href="#contact">
              נדבר ונבנה ביחד
            </a>
          </div>
        </div>

        <p className="hint" style={{ marginTop: 12 }}>
          המחיר הסופי תלוי בכמות מוזמנים, מורכבות ההושבה, וערוץ השליחה (SMS/WhatsApp). נשמח להתאים פתרון מדויק עבורך.
        </p>
      </Section>

      <Section id="story" title="קצת עלינו" subtitle="אנחנו פה כדי להפוך ‘בלגן’ לתוכנית.">
        <p>
          אחרי עשרות אירועים למדנו שההבדל בין ערב “לחוץ” לערב “זורם” הוא שליטה בפרטים הקטנים. כשיש תמונת מצב אמינה, כשכל אורח
          מקבל קישור אישי, וכשכל שינוי נכנס בזמן אמת – מקבלים שקט.
        </p>
        <p>
          אנחנו עובדים עם סטנדרט שירות גבוה, דגש על עיצוב ונראות, וזמינות מהירה – כדי שתהיה לך תחושת ביטחון לאורך כל הדרך.
        </p>
      </Section>

      <Section id="contact" title="צור קשר" subtitle="בואו נרים אירוע מדויק.">
        <p>
          כתבו לנו מה סוג האירוע, תאריך משוער וכמות מוזמנים – ונחזור אליכם עם הצעה מסודרת.
        </p>
        <div className="actions" style={{ marginTop: 10 }}>
          <a className="btn btn-gold" href="https://wa.me/" target="_blank" rel="noreferrer">
            וואטסאפ
          </a>
          <a className="btn" href="tel:+972" target="_blank" rel="noreferrer">
            שיחה טלפונית
          </a>
          <a className="btn btn-accent" href="mailto:info@example.com">
            אימייל
          </a>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          אפשר גם להיכנס לפאנל וליצור אירוע חדש דרך <Link to="/login">כניסת מנהל</Link>.
        </p>
      </Section>

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

