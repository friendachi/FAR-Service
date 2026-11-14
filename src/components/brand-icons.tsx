/** Small brand marks for contact links (lucide no longer ships brand icons). */
export function LineIcon({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" fill="#06c755" />
      <path
        d="M20 9c-6.9 0-12.5 4.5-12.5 10 0 4.9 4.4 9 10.4 9.8.4.1 1 .3 1.1.6.1.3.1.8 0 1.1l-.2 1.1c-.1.3-.2 1.3 1.2.7 1.4-.6 7.6-4.5 10.4-7.7 1.9-2.1 2.6-4.2 2.6-5.6C32.5 13.5 26.9 9 20 9Z"
        fill="#fff"
      />
      <text x="20" y="22.6" textAnchor="middle" fontSize="7.4" fontWeight="800" fill="#06c755" fontFamily="Arial, sans-serif">
        LINE
      </text>
    </svg>
  );
}

export function FacebookIcon({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#1877f2" />
      <path
        d="M22.2 32V21.6h3.5l.5-4.1h-4v-2.6c0-1.2.3-2 2-2h2.1V9.3c-.4 0-1.6-.2-3.1-.2-3.1 0-5.2 1.9-5.2 5.3v3.1h-3.5v4.1H18V32h4.2Z"
        fill="#fff"
      />
    </svg>
  );
}
