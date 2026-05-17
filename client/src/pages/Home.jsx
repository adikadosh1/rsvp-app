import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

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

function MobileMenuIcon() {
  return (
    <span className="home-burger" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function BrandMark() {
  return <img className="home-nav-mark" src="/brand/logo-mark.svg" alt="" aria-hidden="true" />;
}

function TopNav() {
  const items = [
    { href: "/", label: "דף הבית" },
    { href: "/about", label: "אודות" },
    { href: "/services", label: "השירותים שלנו" },
    { href: "/pricing", label: "מחירון" },
    { href: "/contact", label: "צור קשר" }
  ];

  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const links = useMemo(
    () =>
      items.map((it) => (
        <Link
          key={it.href}
          className="home-nav-link"
          onClick={() => setOpen(false)}
          to={it.href}
        >
          {it.label}
        </Link>
      )),
    []
  );

  return (
    <nav className="home-nav" aria-label="תפריט ראשי">
      <div className="home-nav-inner">
        <a className="home-nav-brand" href="#home" aria-label="חזרה לדף הבית">
          <BrandMark />
          <span className="home-nav-brand-text">
            <span className="home-nav-eyebrow">RSVP PREMIUM</span>
            <span className="home-nav-name">
              הושבה <span>כיד המלך</span>
            </span>
          </span>
        </a>
        <div className="home-nav-links">{links}</div>

        <div className="home-nav-actions">
          <Link className="btn btn-ghost home-nav-cta" to="/login">
            כניסת מנהל
          </Link>
          <button
            type="button"
            className="home-burger-btn"
            aria-label={open ? "סגור תפריט" : "פתח תפריט"}
            aria-expanded={open ? "true" : "false"}
            onClick={() => setOpen((v) => !v)}
          >
            <MobileMenuIcon />
          </button>
        </div>
      </div>

      {open ? (
        <>
          <div className="home-nav-backdrop" onMouseDown={() => setOpen(false)} aria-hidden="true" />
          <div className="home-nav-drawer" role="dialog" aria-modal="true" aria-label="תפריט">
            <div className="home-nav-drawer-head">
              <div className="home-nav-brand" style={{ fontSize: 18 }}>
                הושבה <span>כיד המלך</span>
              </div>
              <button type="button" className="home-drawer-close" onClick={() => setOpen(false)} aria-label="סגור">
                ×
              </button>
            </div>
            <div className="home-nav-drawer-links">{links}</div>
            <div className="home-nav-drawer-ctas">
              <a className="btn btn-gold" href="#contact" onClick={() => setOpen(false)}>
                דברו איתנו
              </a>
              <Link className="btn btn-accent" to="/login" onClick={() => setOpen(false)}>
                כניסת מנהל
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </nav>
  );
}

function ServiceCard({ title, desc, bullets }) {
  return (
    <div className="home-service card">
      <div className="home-service-title">{title}</div>
      <div className="home-service-desc">{desc}</div>
      <div className="home-service-bullets">
        {bullets.map((b) => (
          <div key={b} className="home-bullet">
            <span className="home-bullet-dot" aria-hidden="true" />
            <span>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="home-stat">
      <div className="home-stat-num">{value}</div>
      <div className="home-stat-lbl">{label}</div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="container home-page">
      <TopNav />

      <section id="home" className="card hero" aria-label="פתיח">
        <div className="hero-inner">
          <div className="hero-kicker">PREMIUM EVENT OPS</div>
          <h1 className="hero-title">
            אירוע מדויק מתחיל ב‑<span>הושבה</span> וב‑<span>RSVP</span> שעובד
          </h1>
          <p className="hero-sub">
            במקום עשרות הודעות וטלפונים—מערכת אחת: מוזמנים, סטטוסים, כמויות ומנות מיוחדות. יחד עם שירותי הושבה מקצועיים שמייצרים
            סדר, נראות וזרימה.
          </p>

          <div className="actions" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <a className="btn btn-gold" href="#contact">
              קבלת הצעה ב‑2 דקות
            </a>
            <a className="btn btn-accent" href="#services">
              לראות שירותים
            </a>
            <a className="btn" href="#pricing">
              מחירון
            </a>
          </div>
        </div>

        <div className="home-hero-side" aria-label="נקודות מפתח">
          <div className="home-hero-badges">
            <span className="pill-chip">RTL + עברית</span>
            <span className="pill-chip">דשבורד בזמן אמת</span>
            <span className="pill-chip">SMS / WhatsApp</span>
            <span className="pill-chip">שמירת אלכוהול</span>
            <span className="pill-chip">ייצוא ודוחות</span>
          </div>
          <div className="home-hero-stats">
            <Stat value="4" label="שלבי RSVP" />
            <Stat value="1" label="דשבורד נקי" />
            <Stat value="0" label="בלאגן בוואטסאפ" />
          </div>
          <div className="home-hero-note">
            <div className="home-hero-note-title">מה מקבלים?</div>
            <div className="home-hero-note-text">
              לינק אישי לכל אורח, ניהול רשימה, תזכורות, מנות מיוחדות וסטטיסטיקות—וגם שירותי פרימיום משלימים כמו הושבה ושמירת אלכוהול.
            </div>
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
        <div className="home-services">
          <ServiceCard
            title="אישורי הגעה (RSVP) יוקרתי"
            desc="איסוף סטטוסים, כמויות ומנות—בדיוק של שעון. עם קישור אישי לכל אורח."
            bullets={["סטטוס מגיע/לא מגיע/לא יודע", "כמות מגיעים + מנות מיוחדות", "תזכורות למי שלא ענה"]}
          />
          <ServiceCard
            title="שירותי הושבה באירועים"
            desc="תכנון שולחנות חכם שמאזן בין משפחות וקבוצות ומייצר חוויה נעימה."
            bullets={["תיאום העדפות וקונפליקטים", "איזון בין שולחנות", "תרשימי הושבה ברורים"]}
          />
          <ServiceCard
            title="שמירת אלכוהול וניהול חלוקה"
            desc="שומרים על האינטרס שלכם: ספירה, רישום, חלוקה מבוקרת—ומקסימום בקבוקים סגורים לזיכוי."
            bullets={["ספירה ורישום בתחילת האירוע", "חלוקה מבוקרת לבר/שולחנות", "סיכום וסגירה בסוף האירוע"]}
          />
          <ServiceCard
            title="דשבורד מנהל בזמן אמת"
            desc="תמונה אחת נקייה: סטטיסטיקות, חיפוש וסינון, רשימת אורחים ותשובות."
            bullets={["סטטיסטיקות ורינגים", "רשימת אורחים עם פילטרים", "ייצוא דוחות וניהול"]}
          />
        </div>
      </Section>

      <Section id="process" title="איך זה עובד" subtitle="3 צעדים פשוטים, בלי כאבי ראש.">
        <div className="home-steps">
          <div className="home-step card">
            <div className="home-step-num">1</div>
            <div className="home-step-title">מעלים מוזמנים</div>
            <div className="home-step-sub">CSV או אנשי קשר מהטלפון (במובייל).</div>
          </div>
          <div className="home-step card">
            <div className="home-step-num">2</div>
            <div className="home-step-title">מגדירים הודעה</div>
            <div className="home-step-sub">טקסט + תמונת הזמנה (אופציונלי) + ערוץ שליחה.</div>
          </div>
          <div className="home-step card">
            <div className="home-step-num">3</div>
            <div className="home-step-title">מקבלים תוצאות</div>
            <div className="home-step-sub">סטטוס/כמות/מנות—והכול מתעדכן בדשבורד.</div>
          </div>
        </div>
      </Section>

      <Section id="trust" title="למה אנחנו" subtitle="דגש על נראות, דיוק ושקט נפשי.">
        <div className="home-trust">
          <div className="home-trust-card card">
            <div className="home-trust-title">נראות יוקרתית</div>
            <div className="home-trust-sub">הודעות, דפים ודשבורד בעיצוב שמכבד אירוע.</div>
          </div>
          <div className="home-trust-card card">
            <div className="home-trust-title">שקיפות בזמן אמת</div>
            <div className="home-trust-sub">מגיעים/לא מגיעים/לא ענו + מנות מיוחדות, בלי ניחושים.</div>
          </div>
          <div className="home-trust-card card">
            <div className="home-trust-title">חוסכים זמן</div>
            <div className="home-trust-sub">תזכורות וסיכומים במקום לרדוף אחרי אורחים.</div>
          </div>
        </div>
      </Section>

      <Section id="faq" title="שאלות נפוצות" subtitle="כמה דברים שכולם שואלים לפני שמתחילים.">
        <div className="home-faq">
          <details className="home-faq-item">
            <summary>אפשר לשלוח גם ב‑WhatsApp וגם ב‑SMS?</summary>
            <div className="hint">כן. בוחרים ערוץ שליחה לכל אירוע, וניתן להתאים לפי צורך.</div>
          </details>
          <details className="home-faq-item">
            <summary>איך האורחים מאשרים הגעה?</summary>
            <div className="hint">כל אורח מקבל קישור אישי ועובר 4 שלבים קצרים—כולל מנות מיוחדות.</div>
          </details>
          <details className="home-faq-item">
            <summary>מה עם מנות ילדים/צמחוני?</summary>
            <div className="hint">האורחים מזינים כמות, והדשבורד מסכם הכול אוטומטית.</div>
          </details>
          <details className="home-faq-item">
            <summary>יש תמיכה במובייל?</summary>
            <div className="hint">כן. כולל תפריט מותאם ונוחות שימוש מלאה. באנדרואיד אפשר גם ייבוא אנשי קשר ישיר.</div>
          </details>
        </div>
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

          <div className="home-price card">
            <div className="home-price-kicker">ALCOHOL</div>
            <div className="home-price-title">שמירת אלכוהול באירוע</div>
            <div className="home-price-sub">מנהל אלכוהול + בקרה + סיכום</div>
            <div className="home-price-points">
              <div>רישום בקבוקים בתחילת האירוע</div>
              <div>ניהול חלוקה לבר ול‑VIP</div>
              <div>סגירה מסודרת בסוף האירוע</div>
            </div>
            <a className="btn btn-ghost" href="#contact">
              תוספת לחבילה / הצעה מותאמת
            </a>
          </div>
        </div>

        <p className="hint" style={{ marginTop: 12 }}>
          המחיר הסופי תלוי בכמות מוזמנים, מורכבות ההושבה, וערוץ השליחה (SMS/WhatsApp). נשמח להתאים פתרון מדויק עבורך.
        </p>
        <p className="hint" style={{ marginTop: 8 }}>
          רוצים לראות טווחי שוק ודוגמאות? <a href="/pricing#pricing">יש לנו מחקר קצר</a> (עם מקורות) — נשלח גם בוואטסאפ/מייל.
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
          השאירו פרטים ונחזור עם הצעה מסודרת. אם נוח לכם—אפשר גם WhatsApp/טלפון.
        </p>
        <form className="home-contact" onSubmit={(e) => e.preventDefault()}>
          <label className="field">
            <span>שם מלא</span>
            <input placeholder="איך נקרא לכם?" autoComplete="name" />
          </label>
          <label className="field">
            <span>טלפון</span>
            <input placeholder="050-0000000" inputMode="tel" autoComplete="tel" />
          </label>
          <label className="field">
            <span>מה תרצו לשמוע?</span>
            <textarea rows={4} placeholder="סוג אירוע, תאריך משוער, כמות מוזמנים..." />
          </label>
          <div className="actions">
            <button className="btn btn-gold" type="submit">
              שליחה (דמו)
            </button>
            <a className="btn btn-accent" href="https://wa.me/" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a className="btn" href="tel:+972" target="_blank" rel="noreferrer">
              שיחה
            </a>
          </div>
          <p className="hint" style={{ margin: "10px 0 0" }}>
            הטופס כרגע דמו (ללא שליחה לשרת). אם תרצה, אחבר אותו לשליחה למייל/וואטסאפ בצורה אוטומטית.
          </p>
        </form>
        <p className="hint" style={{ marginTop: 10 }}>
          אפשר גם להיכנס לפאנל וליצור אירוע חדש דרך <Link to="/login">כניסת מנהל</Link>.
        </p>
      </Section>

      <footer className="footer-mini" role="contentinfo">
        <span>© {new Date().getFullYear()} הושבה כיד המלך</span>
        <span className="actions">
          <a href="/brand/logo-lockup.svg" download>
            הורדת לוגו (SVG)
          </a>
          <a href="/privacy">פרטיות</a>
          <a href="/terms">תנאי שימוש</a>
        </span>
      </footer>
    </div>
  );
}

