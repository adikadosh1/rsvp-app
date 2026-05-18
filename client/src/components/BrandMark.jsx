import CrownMarkSvg from "./CrownMarkSvg.jsx";

const HEIGHTS = { sm: 44, md: 58, lg: 72, xl: 84 };

/**
 * Crown mark for headers — inline SVG so it always displays next to the wordmark.
 */
export default function BrandMark({ size = "md", className = "" }) {
  const sizeClass =
    size === "sm" ? "logo-mark-sm" : size === "lg" ? "logo-mark-lg" : size === "xl" ? "logo-mark-xl" : "logo-mark-md";

  return <CrownMarkSvg className={`logo-mark ${sizeClass} ${className}`.trim()} />;
}

export { HEIGHTS as brandMarkHeights };
