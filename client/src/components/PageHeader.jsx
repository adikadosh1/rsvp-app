import { Link } from "react-router-dom";

export default function PageHeader({ title, subtitle, breadcrumbs = [], actions = null }) {
  return (
    <header className="page-header">
      <div>
        {breadcrumbs.length > 0 && (
          <nav className="breadcrumb-trail" aria-label="מיקום">
            {breadcrumbs.map((b, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span aria-hidden="true">/</span>}
                {b.to ? <Link to={b.to}>{b.label}</Link> : <span>{b.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="hint" style={{ marginTop: 6 }}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
