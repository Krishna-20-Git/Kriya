import { Button } from './Button';
import { Dialog, DialogFooter } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  /** Destructive actions use the danger button; other confirmations use the primary one. */
  tone?: 'danger' | 'primary';
}

export function ConfirmDialog({ open, title, message, confirmLabel, pending, error, onConfirm, onClose, tone = 'danger' }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={pending ? () => undefined : onClose} title={title} size="sm">
      <div className="px-5 py-4">
        <p className="text-base text-ink-2">{message}</p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
