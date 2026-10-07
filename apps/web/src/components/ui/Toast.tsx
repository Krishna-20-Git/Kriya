import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Tone = 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

/** Short confirmations ("Task created") announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    nextId.current += 1;
    const id = nextId.current;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3500);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'flex items-center gap-2 rounded-md border bg-inverse px-3.5 py-2.5 text-base text-on-inverse shadow-lg',
              item.tone === 'error' ? 'border-danger' : 'border-inverse',
            )}
          >
            {item.tone === 'error' ? <XCircle className="size-4 text-inverse-danger" aria-hidden /> : <CheckCircle2 className="size-4 text-inverse-success" aria-hidden />}
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
