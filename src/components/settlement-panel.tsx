"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleBooking } from "@/app/actions/yard";
import { money } from "@/lib/format";
import type { ExtraCharge } from "@/lib/types";
import { Button } from "./ui";

const kindLabel: Record<ExtraCharge["kind"], string> = {
  DAMAGE: "ค่าเสียหาย",
  LATE_RETURN: "ค่าปรับคืนช้า",
  EARLY_RETURN_DIFF: "ส่วนต่างคืนก่อนกำหนด",
  CANCELLATION_FEE: "ค่าธรรมเนียมยกเลิก",
  OTHER: "อื่นๆ",
};

/** Close a returned booking: approve or waive proposed charges, deduct from the deposit, release the rest. */
export function SettlementPanel({
  bookingId,
  deposit,
  charges,
  flagged,
}: {
  bookingId: string;
  deposit: number;
  charges: ExtraCharge[];
  flagged?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const open = charges.filter((c) => c.status === "PROPOSED" || c.status === "APPROVED");
  const deductFor = (waive: boolean) =>
    Math.min(deposit, open.filter((c) => c.amount > 0 && !(waive && c.kind === "DAMAGE")).reduce((s, c) => s + c.amount, 0));
  const owed = -open.filter((c) => c.amount < 0).reduce((s, c) => s + c.amount, 0);
  const hasDamage = open.some((c) => c.kind === "DAMAGE");

  const run = (waive: boolean) =>
    start(async () => {
      const res = await settleBooking(bookingId, waive);
      setMsg(res.ok ? { ok: true, text: res.message ?? "ปิดงานแล้ว" } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });

  if (msg?.ok) return <p className="rounded-lg bg-sign-tint px-4 py-3 font-semibold text-sign-deep">{msg.text}</p>;

  return (
    <div>
      <dl className="space-y-2 text-[15px]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">เงินค้ำประกันที่ถืออยู่</dt>
          <dd className="tabular font-semibold">{money(deposit)}</dd>
        </div>
        {open.length === 0 && <p className="text-ink-3">ไม่มีค่าใช้จ่ายเพิ่มเติม</p>}
        {open.map((c, i) => (
          <div key={i} className="flex justify-between gap-3">
            <dt className="text-ink-2">
              {kindLabel[c.kind]} {c.description && <span className="text-ink-3">· {c.description}</span>}
            </dt>
            <dd className={`tabular font-semibold ${c.amount > 0 ? "text-danger" : "text-grass"}`}>
              {c.amount > 0 ? "−" : "+"}
              {money(Math.abs(c.amount))}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
          <dt className="font-bold">คืนเงินค้ำประกัน</dt>
          <dd className="font-route text-[22px] font-extrabold tabular text-grass">{money(deposit - deductFor(false))}</dd>
        </div>
        {owed > 0 && <p className="text-[14px] text-ink-2">และต้องคืนส่วนต่างค่าเช่าให้ลูกค้า {money(owed)} (บันทึกการโอนคืนแยก)</p>}
      </dl>
      {flagged && <p className="mt-3 rounded-lg bg-danger-tint px-4 py-2.5 text-[14px] text-danger">{flagged} · ตรวจรูปเทียบผลตรวจ OUT ก่อนยืนยัน</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="sign" disabled={pending} onClick={() => run(false)}>
          ยืนยันยอดและปิดงาน
        </Button>
        {hasDamage && (
          <Button variant="outline" disabled={pending} onClick={() => run(true)}>
            ยกเว้นค่าเสียหายแล้วปิดงาน (คืน {money(deposit - deductFor(true))})
          </Button>
        )}
      </div>
      {msg && !msg.ok && (
        <p className="mt-2 text-[14px] font-semibold text-danger" role="alert">
          {msg.text}
        </p>
      )}
    </div>
  );
}
