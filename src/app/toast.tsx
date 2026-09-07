import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

type ToastKind = 'success' | 'error';
type ToastState = { id: number; message: string; kind: ToastKind } | null;

const ToastContext = createContext<{
  toast: (message: string) => void;
  errorToast: (message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<ToastState>(null);

  const show = useCallback((message: string, kind: ToastKind) => {
    const id = Date.now();
    setNotice({ id, message, kind });
    setTimeout(() => setNotice((prev) => (prev?.id === id ? null : prev)), 3600);
  }, []);

  const value = {
    toast: (m: string) => show(m, 'success'),
    errorToast: (m: string) => show(m, 'error'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {notice && (
        <div className="toast" role="status" style={notice.kind === 'error' ? { background: '#7a1f1f' } : undefined}>
          {notice.kind === 'error' ? <AlertTriangle /> : <CheckCircle2 />} {notice.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
