import { money, thDate } from "@/lib/format";
import type { PaymentSchedule } from "@/lib/pricing";

/**
 * The first payment before pickup (deposit + first month + tyre fitting + VAT) and, for rentals longer than a
 * month, the monthly rent due on the pickup date every month until the contract ends.
 */
export function PaymentPlan({ plan, showLater = true }: { plan: PaymentSchedule; showLater?: boolean }) {
  const f = plan.first;
  return (
    <div className="space-y-3 text-[15px]">
      <div>
        <p className="font-bold">ชำระครั้งแรก (ก่อนรับหาง)</p>
        <dl className="mt-2 space-y-1.5">
          <Row label="เงินค้ำประกัน (ได้คืนเมื่อคืนหาง)" value={f.deposit} />
          <Row label={plan.monthly ? "ค่าเช่าเดือนแรก" : "ค่าเช่า"} value={f.rent} />
          {f.tyreFee > 0 && <Row label="ค่าบริการใส่ยาง" value={f.tyreFee} />}
          <Row label="VAT 7%" value={f.vat} />
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <dt className="font-bold">ยอดชำระครั้งแรก</dt>
            <dd className="font-route text-[22px] font-extrabold tabular text-grass">{money(f.total)}</dd>
          </div>
        </dl>
      </div>
      {plan.monthly && (
        <div className="rounded-lg bg-sign-wash p-3">
          <p className="font-semibold text-ink">
            จากนั้นชำระค่าเช่ารายเดือนทุกวันที่ {plan.dueDay} ของเดือน (ตามวันที่รับหาง) จนครบสัญญาเช่า
          </p>
          <p className="mt-1 text-[14px] text-ink-2">
            อีก {plan.later.length} งวด งวดละ {money(plan.later[0].total)} (รวม VAT)
          </p>
          {showLater && (
            <ol className="mt-2 space-y-1 text-[14px] text-ink-2">
              {plan.later.map((l, i) => (
                <li key={l.due} className="flex justify-between gap-3">
                  <span>งวดที่ {i + 2} · {thDate(l.due)}</span>
                  <span className="tabular font-semibold text-ink">{money(l.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tabular font-semibold">{money(value)}</dd>
    </div>
  );
}
