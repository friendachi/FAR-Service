"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import { addMonths, quote, rentalDays, tierLabel, tierLabelEn } from "@/lib/pricing";
import { T } from "./t";
import type { Trailer } from "@/lib/types";
import { buttonClass, cx, inputClass } from "./ui";

const addDays = (iso: string, d: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + d * 864e5).toISOString().slice(0, 10);

/**
 * Live price for one trailer. Tiered (skeletal / flatbed): pick the contract length in months and
 * optionally the tyre-fitting service. Daily/monthly (lowbed): pick the number of days.
 */
export function RateCalculator({
  trailer,
  initialFrom,
  initialTo,
  today,
}: {
  trailer: Trailer;
  initialFrom?: string;
  initialTo?: string;
  today: string;
}) {
  const p = trailer.pricing;
  const tiered = p.plan === "MONTHLY_TIERED";
  const [from, setFrom] = useState(initialFrom ?? addDays(today, 3));
  const initDays =
    initialFrom && initialTo ? Math.max(1, Math.round((+new Date(initialTo) - +new Date(initialFrom)) / 864e5)) : tiered ? 30 : 7;
  const [months, setMonths] = useState(Math.max(1, Math.round(initDays / 30)));
  const [days, setDays] = useState(initDays);
  const [tyres, setTyres] = useState(false);

  const to = tiered ? addMonths(`${from}T08:00`, months).slice(0, 10) : addDays(from, days);
  const span = tiered ? rentalDays(`${from}T08:00`, `${to}T08:00`) : days;
  const q = useMemo(() => quote(p, span, tyres ? p.tyreCount : 0, tiered ? months : undefined), [p, span, tyres, tiered, months]);

  const tiers = tiered
    ? [
        { id: "MONTHLY_1_5", rate: p.m1_5, unit: <T th="/เดือน" en="/mo" />, rule: <T th="1–5 เดือน" en="1–5 months" /> },
        { id: "MONTHLY_6_11", rate: p.m6_11, unit: <T th="/เดือน" en="/mo" />, rule: <T th="6–11 เดือน" en="6–11 months" /> },
        { id: "MONTHLY_12", rate: p.m12, unit: <T th="/เดือน" en="/mo" />, rule: <T th="12 เดือนขึ้นไป" en="12+ months" /> },
      ]
    : [
        { id: "DAILY", rate: p.daily, unit: <T th="/วัน" en="/day" />, rule: <T th="รายวัน" en="Daily" /> },
        ...(p.weekly
          ? [{ id: "WEEKLY", rate: p.weekly, unit: <T th="/สัปดาห์" en="/week" />, rule: <T th="รายสัปดาห์ (7 วัน)" en="Weekly (7 days)" /> }]
          : []),
        ...(p.monthly
          ? [{ id: "MONTHLY", rate: p.monthly, unit: <T th="/เดือน" en="/mo" />, rule: <T th="รายเดือน (30 วัน)" en="Monthly (30 days)" /> }]
          : []),
      ];

  return (
    <div className="rounded-xl border-2 border-sign bg-paper">
      <div className={cx("grid border-b border-line", tiers.length === 3 ? "grid-cols-3" : tiers.length === 2 ? "grid-cols-2" : "grid-cols-1")} role="list" aria-label="เรทราคา · Rates">
        {tiers.map((t, i) => {
          const on = q.tier === t.id;
          return (
            <div
              key={t.id}
              role="listitem"
              aria-current={on ? "true" : undefined}
              className={cx("px-3 py-3 transition-colors duration-200 sm:px-4", on ? "bg-sign text-on-sign" : "text-ink", i > 0 && "border-l border-line")}
            >
              <p className={cx("text-[13px] font-semibold", on ? "text-on-sign-2" : "text-ink-3")}>{t.rule}</p>
              <p className="font-route text-[19px] font-extrabold tabular sm:text-[22px]">
                {money(t.rate ?? 0)}
                <span className={cx("font-sans text-[12px] font-medium", on ? "text-on-sign-2" : "text-ink-3")}>{t.unit}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2"><T th="วันรับหาง" en="Pickup date" /></span>
            <input type="date" value={from} min={today} onChange={(e) => e.target.value && setFrom(e.target.value)} className={inputClass} />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink-2"><T th="วันคืนหาง" en="Return date" /></span>
            <p className="flex h-12 items-center rounded-lg border-2 border-line bg-ground px-3.5 text-[15px] tabular">
              <T
                th={new Date(`${to}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                en={new Date(`${to}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              />
            </p>
          </div>
        </div>

        {tiered ? (
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-semibold text-ink-2">
              <T th="ระยะสัญญา" en="Contract length" />
              <span className="font-route text-[20px] font-extrabold text-ink tabular"><T th={`${months} เดือน`} en={`${months} months`} /></span>
            </span>
            <input
              type="range"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-grass)]"
              aria-valuetext={`${months} เดือน`}
            />
            <span className="mt-1 flex justify-between text-[12px] text-ink-3">
              <span>1</span>
              <span><T th="6 เดือน" en="6 mo" /></span>
              <span><T th="12 เดือน" en="12 mo" /></span>
              <span>24</span>
            </span>
          </label>
        ) : (
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-semibold text-ink-2">
              <T th="ระยะเช่า" en="Rental length" />
              <span className="font-route text-[20px] font-extrabold text-ink tabular"><T th={`${days} วัน`} en={`${days} days`} /></span>
            </span>
            <input
              type="range"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-grass)]"
              aria-valuetext={`${days} วัน`}
            />
            <span className="mt-1 flex justify-between text-[12px] text-ink-3">
              <span>1</span>
              <span><T th="30 วัน" en="30 days" /></span>
              <span>60</span>
              <span>90</span>
            </span>
          </label>
        )}

        {p.tyreFee > 0 && (
          <label className="flex items-start gap-3 rounded-lg bg-ground p-3 text-[15px]">
            <input type="checkbox" checked={tyres} onChange={(e) => setTyres(e.target.checked)} className="mt-1 size-5 accent-[var(--color-grass)]" />
            <span>
              <T th={`ใช้บริการใส่ยาง ${p.tyreCount} เส้น (${money(p.tyreFee)}/เส้น)`} en={`Tire fitting, ${p.tyreCount} tires (${money(p.tyreFee)} per tire)`} />
              <span className="block text-[13px] text-ink-3">
                <T
                  th="ค่าเช่าไม่รวมยาง นำยางมาลงที่ลานให้ช่างเราใส่ก่อนรับหาง (แนะนำก่อนวันรับ 1 วัน)"
                  en="Tires not included — bring them to the yard and we fit them before pickup (ideally 1 day before)"
                />
              </span>
            </span>
          </label>
        )}

        <dl className="space-y-2 border-t border-line pt-4 text-[15px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">
              <T
                th={`ค่าเช่า ${tiered ? `${q.months} เดือน` : `${days} วัน`} (${tierLabel[q.tier]})`}
                en={`Rent, ${tiered ? `${q.months} months` : `${days} days`} (${tierLabelEn[q.tier]})`}
              />
            </dt>
            <dd className="tabular font-semibold">{money(q.rental)}</dd>
          </div>
          {q.tyreFee > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2"><T th="ค่าบริการใส่ยาง" en="Tire fitting" /></dt>
              <dd className="tabular font-semibold">{money(q.tyreFee)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">VAT 7%</dt>
            <dd className="tabular font-semibold">{money(q.vat)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2"><T th="เงินค้ำประกัน (ได้คืนเมื่อคืนหาง)" en="Deposit (refunded at return)" /></dt>
            <dd className="tabular font-semibold">{money(q.deposit)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
            <dt className="font-bold"><T th="ประมาณการค่าใช้จ่ายทั้งสัญญา" en="Estimated total for the term" /></dt>
            <dd className="font-route text-[26px] font-extrabold tabular text-grass">{money(q.total)}</dd>
          </div>
        </dl>

        {trailer.status === "RENTED" && (
          <p className="rounded-lg bg-warn-tint px-4 py-3 text-[14px] font-semibold text-warn">
            <T th="หางคันนี้มีผู้เช่าอยู่ ขอใบเสนอราคาได้ เจ้าหน้าที่จะแนะนำคันอื่นในรุ่นเดียวกัน" en="This trailer is on rent — ask for a quote and we'll offer another of the same model" />
          </p>
        )}
        <Link
          href={`/quote?model=${trailer.model.code}&trailer=${encodeURIComponent(`${trailer.code} (${trailer.plate})`)}${tiered ? `&months=${months}` : ""}${tyres ? "&tyres=1" : ""}`}
          className={cx(buttonClass("primary", "lg"), "w-full")}
        >
          <T th="ขอใบเสนอราคาหางรุ่นนี้" en="Request a quotation" />
        </Link>
        <p className="text-[12px] text-ink-3">
          <T th="ราคาประมาณการ ยังไม่รวม VAT · ราคาจริงตามใบเสนอราคา · ชำระครั้งแรก: เงินค้ำ + ค่าเช่าเดือนแรก (+ ค่าใส่ยาง)" en="Estimate, excluding VAT · final price per quotation · first payment: deposit + first month (+ tire fitting)" />
        </p>
      </div>
    </div>
  );
}
