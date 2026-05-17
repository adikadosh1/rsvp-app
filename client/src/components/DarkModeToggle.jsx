import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "hkham:theme";

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = saved === "dark" || (!saved && prefersDark);
      setDark(isDark);
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    } catch (_e) {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch (_e) {
      // ignore
    }
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={dark ? "מצב בהיר" : "מצב כהה"}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{dark ? "בהיר" : "כהה"}</span>
    </button>
  );
}
