/** Scroll to a section id on the home page (respects sticky nav via scroll-margin). */
export function scrollToSection(sectionId, behavior = "smooth") {
  if (!sectionId || sectionId === "home") {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior, block: "start" });
    return;
  }
  // Section may still be mounting (lazy / reveal)
  window.setTimeout(() => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior, block: "start" });
  }, 120);
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
