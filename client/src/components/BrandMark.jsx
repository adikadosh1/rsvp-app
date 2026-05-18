/**
 * Crown + throne mark — single source of truth across the app.
 * Asset: /brand/logo-mark.svg
 */
export default function BrandMark({ size = "md", className = "", ...props }) {
  const sizeClass =
    size === "sm" ? "logo-mark-sm" : size === "lg" ? "logo-mark-lg" : size === "xl" ? "logo-mark-xl" : "logo-mark-md";

  return (
    <img
      className={`logo-mark ${sizeClass} ${className}`.trim()}
      src="/brand/logo-mark.svg"
      alt=""
      aria-hidden="true"
      width={size === "sm" ? 28 : size === "lg" ? 48 : size === "xl" ? 56 : 40}
      height={size === "sm" ? 28 : size === "lg" ? 48 : size === "xl" ? 56 : 40}
      decoding="async"
      {...props}
    />
  );
}
