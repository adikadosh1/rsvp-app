import { useRef } from "react";
import { useScrollReveal } from "../hooks/useScrollReveal.js";

export default function ScrollReveal({
  children,
  className = "",
  as: Tag = "motion",
  style,
  delay = 0,
  id,
  ...rest
}) {
  const ref = useRef(null);
  useScrollReveal(ref);

  const Component = Tag === "motion" ? "div" : Tag;

  return (
    <Component
      ref={ref}
      id={id}
      className={`scroll-reveal ${className}`.trim()}
      style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }}
      {...rest}
    >
      {children}
    </Component>
  );
}
