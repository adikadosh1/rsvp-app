import { Link } from "react-router-dom";

function CrownMark() {
  return (
    <svg className="brand-mini-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M10 46h44v6H10v-6Zm4-24 10 12 8-14 8 14 10-12 6 18H8l6-18Z" fill="currentColor" opacity="0.95" />
      <path
        d="M16 16a4 4 0 1 0 0.001 0ZM32 10a4 4 0 1 0 0.001 0ZM48 16a4 4 0 1 0 0.001 0Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

export default function BrandHeader({ rightSlot = null }) {
  return (
    <header className="brand-mini" role="banner">
      <Link className="brand-mini-left" to="/start" aria-label="מעבר למסך התחלה">
        <CrownMark />
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

