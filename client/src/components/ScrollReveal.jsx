import { useRef } from "react";
import { useScrollReveal } from "../hooks/useScrollReveal.js";

export default function ScrollReveal({ children, className = "", as: Tag = "div", style, delay = 0 }) {
  const ref = useRef(null);
  useScrollReveal(ref);

  const Component = Tag === "motion" ? "div" : Tag;

  return (
    <Component
      ref={ref}
      className={`scroll-reveal ${className}`.trim()}
      style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </Component>
  );
}
