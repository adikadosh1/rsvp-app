import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = uid();
      const t = {
        id,
        title: toast.title || "",
        message: toast.message || "",
        tone: toast.tone || "info", // info | success | warning | danger
        ttlMs: toast.ttlMs ?? 4500
      };
      setToasts((prev) => [t, ...prev].slice(0, 4));
      if (t.ttlMs > 0) setTimeout(() => remove(id), t.ttlMs);
      return id;
    },
    [remove]
  );

  const api = useMemo(() => ({ push, remove }), [push, remove]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-label="התראות">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role="status" aria-live="polite">
            <div className="toast-head">
              <div className="toast-title">{t.title}</div>
              <button type="button" className="toast-x" onClick={() => remove(t.id)} aria-label="סגור">
                ✕
              </button>
            </div>
            {t.message && <div className="toast-msg">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

