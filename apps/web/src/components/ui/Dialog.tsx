import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { IconButton } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md';
}

/**
 * Built on the native <dialog> element: showModal() gives a focus trap, Esc to close,
 * an inert background and correct screen-reader semantics without a library.
 */
export function Dialog({ open, onClose, title, description, children, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
      onMouseDown={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-lg border border-line bg-surface p-0 text-ink shadow-[0_12px_40px_var(--color-shadow)]',
        size === 'sm' ? 'max-w-md' : 'max-w-xl',
      )}
    >
      {open ? (
        <div className="flex max-h-[min(90dvh,760px)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
              <X className="size-4" />
            </IconButton>
          </header>
          <div className="overflow-y-auto">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 border-t border-line bg-paper px-5 py-3 sm:flex-row sm:justify-end">{children}</div>;
}
