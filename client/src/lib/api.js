const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  let data = null;

  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const errorMessage = data?.error || "אירעה שגיאה בבקשה לשרת.";
    throw new Error(errorMessage);
  }

  return data;
}

export { apiBase };
