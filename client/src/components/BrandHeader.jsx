import { Link } from "react-router-dom";
import BrandMark from "./BrandMark.jsx";
import BrandWordmark from "./BrandWordmark.jsx";

export default function BrandHeader({ rightSlot = null, homeTo = "/" }) {
  return (
    <header className="brand-mini" role="banner">
      <Link className="brand-mini-left" to={homeTo} aria-label="מעבר לדף הבית">
        <BrandMark size="md" className="brand-mini-mark" />
        <BrandWordmark compact />
      </Link>
      <div className="brand-mini-right">{rightSlot}</div>
    </header>
  );
}
