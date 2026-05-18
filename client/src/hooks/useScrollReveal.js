import { useEffect } from "react";

export function useScrollReveal(ref, { threshold = 0.12, once = true } = {}) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return undefined;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-visible");
        if (once) io.unobserve(el);
      },
      { threshold, rootMargin: "0px 0px -32px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, once]);
}
