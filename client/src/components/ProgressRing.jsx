import { useId } from "react";

export default function ProgressRing({
  value,
  max,
  size = 56,
  stroke = 6,
  color = "var(--primary)",
  gradient = false,
  trackColor = "var(--border)",
  label,
  className = ""
}) {
  const gradId = useId().replace(/:/g, "");
  const safeMax = Math.max(1, Number(max || 1));
  const safeValue = Math.max(0, Math.min(safeMax, Number(value || 0)));
  const pct = safeMax ? (safeValue / safeMax) * 100 : 0;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const strokePaint = gradient ? `url(#${gradId})` : color;
  const pctSize = size >= 120 ? 30 : size >= 80 ? 22 : 13;

  return (
    <div
      className={`ring ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {gradient ? (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E91E8C" />
              <stop offset="100%" stopColor="#FF6B6B" />
            </linearGradient>
          </defs>
        ) : null}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
          opacity={0.55}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokePaint}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center" aria-hidden="true">
        <div className="ring-pct" style={{ fontSize: pctSize }}>
          {Math.round(pct)}
          <span className="ring-pct-suffix">%</span>
        </div>
      </div>
    </div>
  );
}
