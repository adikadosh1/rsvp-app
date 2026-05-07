export default function ProgressRing({
  value,
  max,
  size = 56,
  stroke = 6,
  color = "var(--gold-strong)",
  trackColor = "rgba(255,255,255,0.10)",
  label
}) {
  const safeMax = Math.max(1, Number(max || 1));
  const safeValue = Math.max(0, Math.min(safeMax, Number(value || 0)));
  const pct = safeMax ? (safeValue / safeMax) * 100 : 0;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="ring" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center" aria-hidden="true">
        <div className="ring-pct">{Math.round(pct)}%</div>
      </div>
    </div>
  );
}

