export default function BrandWordmark({ eyebrow = "RSVP PREMIUM", subtitle = null, compact = false }) {
  return (
    <div className={`brand-wordmark ${compact ? "brand-wordmark-compact" : ""}`.trim()}>
      {eyebrow ? <div className="brand-wordmark-eyebrow">{eyebrow}</div> : null}
      <div className="brand-wordmark-name">
        הושבה <span>כיד המלך</span>
      </div>
      {subtitle ? <div className="brand-wordmark-sub">{subtitle}</div> : null}
    </div>
  );
}
