"use client";

import { useState, useTransition } from "react";
import { verifyPayment } from "@/app/actions/admin";
import { Button } from "./ui";

export function PaymentVerify({ paymentId, blockedReason }: { paymentId: string; blockedReason?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (blockedReason) return <p className="mt-3 rounded-lg bg-reflect-tint px-4 py-3 text-[14px] text-sign-deep">{blockedReason}</p>;
  if (msg?.ok) return <p className="mt-3 rounded-lg bg-sign-tint px-4 py-3 font-semibold text-sign-deep">{msg.text}</p>;
  const run = (approve: boolean) =>
    start(async () => {
      const res = await verifyPayment(paymentId, approve);
      setMsg(res.ok ? { ok: true, text: res.message ?? "บันทึกแล้ว" } : { ok: false, text: res.error });
    });
  return (
    <div className="mt-4">
      <p className="text-[15px] font-semibold">ลูกค้าแจ้งชำระแล้ว รอตรวจสอบ</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button variant="sign" disabled={pending} onClick={() => run(true)}>ยืนยันการชำระ</Button>
        <Button variant="danger" disabled={pending} onClick={() => run(false)}>ปฏิเสธสลิป</Button>
      </div>
      {msg && !msg.ok && <p className="mt-2 text-[14px] font-semibold text-danger" role="alert">{msg.text}</p>}
    </div>
  );
}
