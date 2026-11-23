export function LogoMark({ className = "h-8 w-8", ring = true }: { className?: string; ring?: boolean }) {
  return (
    <svg viewBox="0 0 88 88" fill="none" className={className} aria-hidden>
      {ring && <circle cx="44" cy="44" r="40" className="stroke-current" strokeWidth="2" opacity="0.55" />}
      <circle cx="44" cy="44" r="33" className="fill-current" opacity="0.08" />
      <path
        d="M28 60 L28 28 L44 52 L60 28 L60 60"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function Logo({
  className = "",
  markClassName = "h-9 w-9 text-brand-700",
  wordClassName = "text-lg",
}: {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      <span className={`font-serif font-semibold leading-none tracking-tight text-brand-900 ${wordClassName}`}>
        The VA Atelier
      </span>
    </span>
  );
}
