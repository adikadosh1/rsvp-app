/** Scroll to a section id on the home page (respects sticky nav via scroll-margin). */
export function scrollToSection(sectionId, behavior = "smooth") {
  if (!sectionId || sectionId === "home") {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  const scroll = () => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior, block: "start" });
    return Boolean(el);
  };

  if (scroll()) return;

  // Section may still be mounting (lazy / reveal)
  let attempts = 0;
  const retry = () => {
    attempts += 1;
    if (scroll() || attempts >= 8) return;
    window.setTimeout(retry, 80);
  };
  window.setTimeout(retry, 80);
}

export function hashFromLocation(location) {
  const fromHash = location.hash?.replace(/^#/, "");
  if (fromHash) return fromHash;
  const map = {
    "/about": "about",
    "/services": "services",
    "/pricing": "pricing",
    "/contact": "contact"
  };
  return map[location.pathname] || "";
}
