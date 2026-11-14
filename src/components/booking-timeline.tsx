import { Check } from "lucide-react";
import type { BookingStatus } from "@/lib/types";
import { cx } from "./ui";

const LEGS = ["ส่งคำขอ", "อนุมัติเอกสาร", "ชำระเงิน", "รับหางที่ลาน", "คืนหาง", "ปิดงาน"];

const position: Record<BookingStatus, number> = {
  PENDING_REVIEW: 1,
  NEED_MORE_DOCS: 1,
  APPROVED_AWAITING_PAYMENT: 2,
  CONFIRMED: 3,
  READY_FOR_PICKUP: 3,
  IN_RENTAL: 4,
  RETURNED_PENDING_SETTLEMENT: 5,
  COMPLETED: 6,
  REJECTED: 1,
  CANCELLED: 0,
  EXPIRED: 0,
};

/** Horizontal route of the booking: passed legs green, current leg reflective yellow. */
export function BookingTimeline({ status }: { status: BookingStatus }) {
  const at = position[status];
  const ended = status === "CANCELLED" || status === "EXPIRED" || status === "REJECTED";
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="ความคืบหน้าการเช่า">
      {LEGS.map((l, i) => {
        const done = !ended && i < at;
        const on = !ended && i === at;
        return (
          <li key={l} aria-current={on ? "step" : undefined} className="min-w-0">
            <div
              className={cx(
                "flex h-2.5 items-center rounded-full",
                done ? "bg-sign" : on ? "bg-reflect" : "bg-line",
              )}
            />
            <p
              className={cx(
                "mt-2 flex items-center gap-1 text-[12px] font-semibold sm:text-[13px]",
                done ? "text-grass" : on ? "text-ink" : "text-ink-3",
              )}
            >
              {done && <Check className="hidden size-3.5 shrink-0 sm:block" strokeWidth={3} aria-hidden />}
              <span className="truncate">{l}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
