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

export default function CountdownFlip({ eventDate, eventName }) {
  const [p, setP] = useState(() => partsFromIso(eventDate));

  useEffect(() => {
    setP(partsFromIso(eventDate));
    const id = setInterval(() => setP(partsFromIso(eventDate)), 1000);
    return () => clearInterval(id);
  }, [eventDate]);

  if (!p) return <p className="hint">אין תאריך אירוע מוגדר</p>;
  if (p.done) return <p className="hint">האירוע התחיל!</p>;

  const cells = [
    ["ימים", p.days],
    ["שעות", p.hours],
    ["דקות", p.mins],
    ["שניות", p.secs]
  ];

  return (
    <div>
      <div className="countdown-flip">
        {cells.map(([lbl, num]) => (
          <div key={lbl} className="flip-cube">
            <div className="flip-cube-num">{String(num).padStart(2, "0")}</div>
            <div className="flip-cube-lbl">{lbl}</div>
          </div>
        ))}
      </div>
      {eventName ? (
        <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
          נותרו <strong>{p.days}</strong> ימים ל־{eventName}
        </p>
      ) : null}
    </div>
  );
}
