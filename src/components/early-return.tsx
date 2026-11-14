"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { earlyReturn, tierLabel } from "@/lib/pricing";
import type { Trailer } from "@/lib/types";
import { Button, Field, inputClass } from "./ui";

export function EarlyReturn({
  trailer,
  pickupAt,
  returnAt,
  today,
}: {
  trailer: Trailer;
  pickupAt: string;
  returnAt: string;
  today: string;
}) {
  const booked = Math.round((+new Date(returnAt) - +new Date(pickupAt)) / 864e5);
  const [date, setDate] = useState(today);
  const actual = Math.max(1, Math.round((+new Date(`${date}T17:00`) - +new Date(pickupAt)) / 864e5));
  const valid = date < returnAt.slice(0, 10) && date >= today;
  const r = earlyReturn(trailer.pricing, booked, actual);
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-4">
      <Field label="วันที่จะนำหางมาคืน">
        <input type="date" value={date} min={today} max={returnAt.slice(0, 10)} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      {valid ? (
        <dl className="space-y-2 text-[15px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">ตามสัญญา {booked} วัน · {tierLabel[r.booked.tier]}</dt>
            <dd className="tabular">{money(r.booked.rental + r.booked.vat)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">เช่าจริง {actual} วัน · {tierLabel[r.actual.tier]}</dt>
            <dd className="tabular">{money(r.actual.rental + r.actual.vat)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <dt className="font-bold">{r.difference >= 0 ? "ประมาณยอดคืนให้คุณ" : "ประมาณยอดชำระเพิ่ม"}</dt>
            <dd className={`font-route text-[22px] font-extrabold tabular ${r.difference >= 0 ? "text-grass" : "text-danger"}`}>
              {money(Math.abs(r.difference))}
            </dd>
          </div>
          <p className="text-[13px] text-ink-3">
            คิดใหม่ตามวันที่เช่าจริงและเรทที่ตรงกับระยะนั้น เงินค้ำประกันคืนแยกหลังตรวจสภาพ
          </p>
        </dl>
      ) : (
        <p className="text-[14px] text-danger">เลือกวันที่ตั้งแต่วันนี้ถึงก่อนวันคืนตามสัญญา</p>
      )}
      {sent ? (
        <p className="rounded-lg bg-sign-tint px-4 py-3 font-semibold text-sign-deep">แจ้งคืนก่อนกำหนดแล้ว ลานจะเตรียมรับหางตามวันที่เลือก</p>
      ) : (
        <Button variant="outline" disabled={!valid} onClick={() => setSent(true)}>
          แจ้งคืนก่อนกำหนด
        </Button>
      )}
    </div>
  );
}
