import { useEffect, useState } from "react";

function partsFromIso(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Math.max(0, t - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
    done: diff === 0
  };
}

export default function CountdownTimer({ eventDate, className = "countdown-live" }) {
  const [p, setP] = useState(() => partsFromIso(eventDate));

  useEffect(() => {
    setP(partsFromIso(eventDate));
    const id = setInterval(() => setP(partsFromIso(eventDate)), 1000);
    return () => clearInterval(id);
  }, [eventDate]);

  if (!p) return <div className="hint">אין תאריך אירוע מוגדר</div>;
  if (p.done) return <div className="hint">האירוע התחיל!</div>;

  return (
    <div className={className}>
      {[
        ["ימים", p.days],
        ["שעות", p.hours],
        ["דקות", p.mins],
        ["שניות", p.secs]
      ].map(([lbl, num]) => (
        <div key={lbl} className="cd-box">
          <div className="cd-num">{num}</div>
          <div className="cd-lbl">{lbl}</div>
        </div>
      ))}
    </div>
  );
}
