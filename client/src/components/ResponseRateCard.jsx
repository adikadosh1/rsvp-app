import ProgressRing from "./ProgressRing.jsx";

function statusMeta(rate) {
  if (rate >= 70) return { label: "מצוין", tone: "ok" };
  if (rate >= 40) return { label: "בתהליך", tone: "warn" };
  return { label: "דורש תזכורות", tone: "alert" };
}

export default function ResponseRateCard({ rate = 0, answered = 0, total = 0 }) {
  const pending = Math.max(0, total - answered);
  const meta = statusMeta(rate);
  const useBrandGradient = rate >= 40;

  return (
    <article className="response-rate-card" aria-labelledby="response-rate-title">
      <header className="response-rate-head">
        <h3 id="response-rate-title" className="response-rate-title">
          אחוז מענה
        </h3>
        <span className={`response-rate-badge response-rate-badge--${meta.tone}`}>{meta.label}</span>
      </header>

      <div className="response-rate-ring-wrap">
        <ProgressRing
          value={rate}
          max={100}
          size={128}
          stroke={11}
          gradient={useBrandGradient}
          color={rate >= 70 ? "var(--ok)" : rate >= 40 ? "var(--amber)" : "var(--danger)"}
          trackColor="rgba(233, 30, 140, 0.12)"
          label={`${rate}% מענה`}
          className="response-rate-ring"
        />
      </div>

      <div
        className="response-rate-bar"
        role="progressbar"
        aria-valuenow={rate}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="התקדמות מענה"
      >
        <div className="response-rate-bar-fill" style={{ width: `${rate}%` }} />
      </div>

      <div className="response-rate-stats">
        <div className="response-rate-stat response-rate-stat--ok">
          <span className="response-rate-stat-num">{answered}</span>
          <span className="response-rate-stat-lbl">ענו</span>
        </div>
        <div className="response-rate-stat-divider" aria-hidden="true" />
        <div className="response-rate-stat response-rate-stat--pending">
          <span className="response-rate-stat-num">{pending}</span>
          <span className="response-rate-stat-lbl">ממתינים</span>
        </div>
      </div>

      <p className="response-rate-foot">
        <strong>{answered}</strong> מתוך <strong>{total}</strong> אורחים השיבו
      </p>
    </article>
  );
}
