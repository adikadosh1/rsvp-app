export default function EmptyState({ title, description, icon = "guests" }) {
  return (
    <div className="empty-state-pro">
      <svg className="empty-illustration" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        {icon === "guests" ? (
          <>
            <circle cx="60" cy="60" r="56" fill="url(#eg)" opacity="0.15" />
            <circle cx="60" cy="44" r="18" stroke="var(--primary)" strokeWidth="2" />
            <path d="M30 88c6-16 44-16 60 0" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="eg" x1="0" y1="0" x2="120" y2="120">
                <stop stopColor="#5B2D8E" />
                <stop offset="1" stopColor="#4A90D9" />
              </linearGradient>
            </defs>
          </>
        ) : (
          <>
            <rect x="24" y="28" width="72" height="56" rx="12" stroke="var(--primary)" strokeWidth="2" />
            <path d="M36 48h48M36 60h32" stroke="var(--secondary)" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </svg>
      <h4>{title}</h4>
      {description ? <p className="hint">{description}</p> : null}
    </div>
  );
}
