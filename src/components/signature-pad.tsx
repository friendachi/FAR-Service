"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Finger signature on a canvas. Reports whether anything has been drawn. */
/** `exportRef.current()` returns the signature as a PNG blob. */
export function SignaturePad({
  onChange,
  label = "เซ็นชื่อในกรอบ",
  exportRef,
}: {
  onChange: (signed: boolean) => void;
  label?: string;
  exportRef?: RefObject<(() => Promise<Blob | null>) | null>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (exportRef) exportRef.current = () => new Promise((res) => ref.current!.toBlob(res, "image/png"));
  }, [exportRef]);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#17201b";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setSigned(false);
    onChange(false);
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={ref}
          aria-label={label}
          className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-line-strong bg-paper"
          onPointerDown={(e) => {
            drawing.current = true;
            const ctx = e.currentTarget.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(...pos(e));
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d")!;
            ctx.lineTo(...pos(e));
            ctx.stroke();
            if (!signed) {
              setSigned(true);
              onChange(true);
            }
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
        />
        {!signed && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[15px] text-ink-3">{label}</span>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-2 text-[14px] font-semibold text-grass underline">
        ล้างลายเซ็น
      </button>
    </div>
  );
}
