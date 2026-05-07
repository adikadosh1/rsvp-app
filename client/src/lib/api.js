const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";

export async function apiFetch(path, options = {}) {
  const { clearToken, getToken } = await import("./auth.js");
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  let data = null;

  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && path !== "/admin/login") {
      clearToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    const base = data?.error || "אירעה שגיאה בבקשה לשרת.";
    const details = data?.details ? ` (${data.details})` : "";
    throw new Error(`${base}${details}`);
  }

  return data;
}

export { apiBase };
