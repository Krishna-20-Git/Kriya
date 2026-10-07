export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect width="32" height="32" rx="7" fill="var(--color-accent)" />
        <path d="M8 21h16M8 16h11M8 11h6" stroke="var(--color-on-accent)" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      Kriya
    </span>
  );
}
