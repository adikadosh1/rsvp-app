import { Link } from "react-router-dom";

function BrandMark() {
  return <img className="brand-mini-mark" src="/brand/logo-mark.svg" alt="" aria-hidden="true" />;
}

export default function BrandHeader({ rightSlot = null }) {
  return (
    <header className="brand-mini" role="banner">
      <Link className="brand-mini-left" to="/" aria-label="מעבר לדף הבית">
        <BrandMark />
        <div className="brand-mini-text">
          <div className="brand-mini-eyebrow">RSVP PREMIUM</div>
          <div className="brand-mini-name">
            הושבה <span>כיד המלך</span>
          </div>
        </div>
      </Link>
      <div className="brand-mini-right">{rightSlot}</div>
    </header>
  );
}

