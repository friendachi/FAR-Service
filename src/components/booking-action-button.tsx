"use client";

import { useState, useTransition } from "react";
import { cancelBooking, resubmitDocuments } from "@/app/actions/customer";
import { Button } from "./ui";

/** Customer-side booking actions that need a server round trip. */
export function BookingActionButton({
  bookingId,
  action,
  label,
  confirmText,
  variant = "sign",
}: {
  bookingId: string;
  action: "cancel" | "resubmit";
  label: string;
  confirmText?: string;
  variant?: "sign" | "danger";
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const res = action === "cancel" ? await cancelBooking(bookingId) : await resubmitDocuments(bookingId);
      setResult(res.ok ? { ok: true, text: res.message ?? "สำเร็จ" } : { ok: false, text: res.error });
    });
  };

  return (
    <div className="mt-4">
      {result?.ok ? (
        <p className="rounded-lg bg-sign-tint px-4 py-3 font-semibold text-sign-deep" role="status">
          {result.text}
        </p>
      ) : (
        <>
          <Button variant={variant} disabled={pending} onClick={run}>
            {pending ? "กำลังดำเนินการ…" : label}
          </Button>
          {result && (
            <p className="mt-2 text-[14px] font-semibold text-danger" role="alert">
              {result.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
