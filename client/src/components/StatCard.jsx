import { useCountUp } from "../hooks/useCountUp.js";

function MiniSparkline({ values = [], color = "var(--primary)" }) {
  const max = Math.max(...values, 1);
  const w = 100;
  const h = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - (v / max) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="stat-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  );
}

export default function StatCard({ label, value, icon: Icon, trend, trendUp, spark = [] }) {
  const display = useCountUp(value);

  return (
    <article className="stat-card-hero">
      <div className="stat-card-hero-inner">
        <div className="stat-card-top">
          <div>
            <div className="stat-value">{display}</div>
            <div className="stat-label">{label}</div>
            {trend != null && (
              <span className={`stat-trend ${trendUp ? "up" : "down"}`}>
                {trendUp ? "↑" : "↓"} {trend}
              </span>
            )}
          </div>
          {Icon ? (
            <div className="stat-icon-ring">
              <Icon size={20} />
            </div>
          ) : null}
        </div>
        {spark.length > 1 ? <MiniSparkline values={spark} /> : null}
      </div>
    </article>
  );
}
