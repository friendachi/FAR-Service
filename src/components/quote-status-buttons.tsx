"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQuoteStatus, type QuoteStatus } from "@/app/actions/quotes";
import { cx } from "./ui";

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  NEW: "คำขอใหม่",
  CONTACTED: "ติดต่อแล้ว",
  QUOTED: "ส่งใบเสนอราคาแล้ว",
  WON: "ปิดการขาย",
  LOST: "ไม่ได้งาน",
};

export function QuoteStatusButtons({ id, status }: { id: string; status: QuoteStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="สถานะคำขอ">
      {(Object.keys(quoteStatusLabel) as QuoteStatus[]).map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending || s === status}
          aria-pressed={s === status}
          onClick={() =>
            start(async () => {
              const r = await setQuoteStatus(id, s);
              if (!r.ok) alert(r.error);
              router.refresh();
            })
          }
          className={cx(
            "rounded-md border px-2.5 py-1 text-[12px] font-semibold",
            s === status ? "border-sign bg-sign text-on-sign" : "border-line bg-paper text-ink-2 hover:border-sign",
          )}
        >
          {quoteStatusLabel[s]}
        </button>
      ))}
    </div>
  );
}
