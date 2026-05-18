import { useLocation, useNavigate } from "react-router-dom";

export default function BackButton({ fallbackTo = "/" }) {
  const nav = useNavigate();
  const loc = useLocation();

  const hideOn = new Set(["/", "/login"]);
  const isAdminRoute =
    loc.pathname === "/dashboard" ||
    loc.pathname.startsWith("/events/") ||
    loc.pathname.startsWith("/manage/");

  const hasHistory = typeof window !== "undefined" ? window.history.length > 1 : false;
  const shouldShow = hasHistory && !hideOn.has(loc.pathname) && !isAdminRoute;
  if (!shouldShow) return null;

  const goBack = () => {
    // If the user landed directly on a deep link, history.back might do nothing useful.
    // We attempt back first, then fallback.
    try {
      nav(-1);
      // If we remain on the same path quickly, navigate to fallback.
      setTimeout(() => {
        if (window.location.pathname === loc.pathname) nav(fallbackTo);
      }, 250);
    } catch (_e) {
      nav(fallbackTo);
    }
  };

  return (
    <button type="button" className="back-fab" onClick={goBack} aria-label="חזרה לעמוד הקודם">
      חזרה
    </button>
  );
}

