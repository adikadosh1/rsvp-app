const KEY = "hkham_admin_token";

export function getToken() {
  try {
    return localStorage.getItem(KEY);
  } catch (_e) {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(KEY, token);
  } catch (_e) {
    // ignore
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
  } catch (_e) {
    // ignore
  }
}

