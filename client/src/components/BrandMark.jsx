/**
 * Crown + throne mark — transparent background, no tile.
 * Asset: /brand/logo-mark.svg
 */
const HEIGHTS = { sm: 40, md: 54, lg: 68, xl: 80 };

export default function BrandMark({ size = "md", className = "", ...props }) {
  const sizeClass =
    size === "sm" ? "logo-mark-sm" : size === "lg" ? "logo-mark-lg" : size === "xl" ? "logo-mark-xl" : "logo-mark-md";
  const h = HEIGHTS[size] || HEIGHTS.md;

  return (
    <img
      className={`logo-mark ${sizeClass} ${className}`.trim()}
      src="/brand/logo-mark.svg"
      alt=""
      aria-hidden="true"
      height={h}
      decoding="async"
      {...props}
    />
  );
}
