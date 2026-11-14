/*
  A krathong (Loy Krathong float) drawn as vector: banana-leaf base with folded pleats, lotus petals, a candle
  and incense. Unicode has no krathong emoji, so this stands in for one. Drawn in a 40×36 box.
*/
export function KrathongShape({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinejoin="round">
      {/* incense sticks */}
      <path d="M14,14 L11,3 M26,14 L29,3" stroke="#7c4a1e" strokeWidth={1.2} strokeLinecap="round" />
      <circle cx={11} cy={3} r={1} fill="#ef4444" />
      <circle cx={29} cy={3} r={1} fill="#ef4444" />
      {/* candle and flame */}
      <rect x={18.6} y={7} width={2.8} height={10} rx={0.8} fill="#fef3c7" stroke="#b45309" strokeWidth={0.8} />
      <g className="krathong-flame">
        <path d="M20,1 C22.4,3.6 22,6.2 20,7 C18,6.2 17.6,3.6 20,1 Z" fill="#f59e0b" />
        <path d="M20,3.2 C21,4.4 20.8,5.6 20,6 C19.2,5.6 19,4.4 20,3.2 Z" fill="#fde047" />
      </g>
      {/* lotus petals */}
      <path d="M7,22 C6,15 9,11 12,10 C12,15 11,19 13,22 Z" fill="#f9a8d4" stroke="#be185d" strokeWidth={0.8} />
      <path d="M33,22 C34,15 31,11 28,10 C28,15 29,19 27,22 Z" fill="#f9a8d4" stroke="#be185d" strokeWidth={0.8} />
      <path d="M12,22 C11,14 15,10 17,9 C17.5,14 17,18 19,22 Z" fill="#fbcfe8" stroke="#be185d" strokeWidth={0.8} />
      <path d="M28,22 C29,14 25,10 23,9 C22.5,14 23,18 21,22 Z" fill="#fbcfe8" stroke="#be185d" strokeWidth={0.8} />
      <path d="M16,22 C16,16 18,13 20,12 C22,13 24,16 24,22 Z" fill="#fff1f7" stroke="#be185d" strokeWidth={0.8} />
      {/* banana-leaf base with folded pleats */}
      <path d="M2,22 L38,22 L35,30 Q20,36 5,30 Z" fill="#3f8f2e" stroke="#1f5016" strokeWidth={1} />
      <path d="M4,22 L7,26 L10,22 L13,26 L16,22 L19,26 L22,22 L25,26 L28,22 L31,26 L34,22 L37,26" fill="none" stroke="#a3e635" strokeWidth={1.1} />
    </g>
  );
}

export function KrathongIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 36" className={className} aria-hidden>
      <KrathongShape />
    </svg>
  );
}
