import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={`fixed bottom-lg right-lg bg-inverse-surface text-inverse-on-surface px-md py-sm rounded-lg shadow-lg flex items-center gap-sm transform transition-all duration-300 z-50 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-[150%] opacity-0"
        }`}
      >
        <span className="material-symbols-outlined text-secondary">check_circle</span>
        <span className="font-small text-small">{message}</span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
