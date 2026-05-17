export default function Spinner({ label = "טוען...", size = "md" }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <div className={`spinner ${size === "sm" ? "spinner-sm" : ""}`} aria-hidden="true" />
      {label ? <span className="hint">{label}</span> : null}
    </div>
  );
}
