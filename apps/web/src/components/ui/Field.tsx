import { ChevronDown } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const control =
  'w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-faint transition-colors duration-150 ' +
  'hover:border-faint focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30 ' +
  'aria-[invalid=true]:border-danger disabled:bg-sunken disabled:text-muted';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
}

/** Label, control and message wired together with ids, so screen readers announce errors with the field. */
export function Field({ label, error, hint, optional, children, className }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
        {optional ? <span className="font-normal text-faint"> (optional)</span> : null}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? messageId : undefined })}
      {error ? (
        <p id={messageId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(control, 'h-9', className)} {...props} />;
}

export function Textarea({ className, ref, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(control, 'min-h-24 resize-y py-2', className)} {...props} />;
}

export function Select({ className, children, ref, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(control, 'h-9 cursor-pointer appearance-none pr-8')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}
