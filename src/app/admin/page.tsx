import { Suspense } from "react";
import { SchemaVersionPanel } from "@/components/schema-version";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NoAccess } from "@/components/no-access";
import { PageHeader, Panel, YardShield } from "@/components/ui";
import { can } from "@/lib/admin";
import { getStore } from "@/lib/data/store";
import { channelLabel, money } from "@/lib/format";
import type { Channel } from "@/lib/types";

export const instant = false;

export const metadata: Metadata = { title: "แดชบอร์ด" };

export default async function Dashboard() {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN"))) return <NoAccess need="Super Admin" />;

  // Rental revenue (before VAT) for the last 6 months, by pickup month; current month is partial.
  const counted = ["CONFIRMED", "READY_FOR_PICKUP", "IN_RENTAL", "RETURNED_PENDING_SETTLEMENT", "COMPLETED"];
  const [ty, tm] = db.today.split("-").map(Number);
  const revenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 6 + i, 1));
    const key = d.toISOString().slice(0, 7);
    return {
      key,
      month: d.toLocaleDateString("th-TH", { month: "short", timeZone: "UTC" }),
      value: db.bookings
        .filter((b) => counted.includes(b.status) && b.pickupAt.startsWith(key))
        .reduce((sum, b) => sum + db.amountsFor(b).rental, 0),
    };
  });
  const max = Math.max(1, ...revenue.map((r) => r.value));
  const lastFull = revenue[4];
  const prev = revenue[3];
  const change = prev.value ? ((lastFull.value - prev.value) / prev.value) * 100 : null;
  const depositHeld = db.bookings
    .filter((b) => ["CONFIRMED", "READY_FOR_PICKUP", "IN_RENTAL", "RETURNED_PENDING_SETTLEMENT"].includes(b.status))
    .reduce((s, b) => s + db.getType(db.trailers.find((t) => t.id === b.trailerId)!.type).deposit, 0);
  const saQueue = db.bookings.filter((b) => b.status === "PENDING_REVIEW" && b.createdByRole === "SALES");
  const channels = (["WEB", "PHONE", "LINE"] as Channel[]).map((c) => ({ c, n: db.bookings.filter((b) => b.channel === c).length }));

  const flaggedCount = db.bookings.filter((b) => b.status === "RETURNED_PENDING_SETTLEMENT" && b.flagged).length;

  // Utilisation over the last 30 days: rented days ÷ (trailers × 30), per trailer type
  const DAY = 864e5;
  const windowEnd = new Date(`${db.today}T00:00:00+07:00`).getTime() + DAY;
  const windowStart = windowEnd - 30 * DAY;
  const used = ["IN_RENTAL", "RETURNED_PENDING_SETTLEMENT", "COMPLETED"];
  const utilisation = (type: string) => {
    const fleet = db.trailers.filter((t) => t.type === type && t.status !== "RETIRED");
    if (!fleet.length) return 0;
    const days = db.bookings
      .filter((b) => used.includes(b.status) && fleet.some((t) => t.id === b.trailerId))
      .reduce((sum, b) => {
        const s = Math.max(new Date(b.pickupAt).getTime(), windowStart);
        const e = Math.min(new Date(b.returnAt).getTime(), windowEnd);
        return sum + Math.max(0, e - s) / DAY;
      }, 0);
    return Math.round((days / (fleet.length * 30)) * 100);
  };
  const monthLabel = new Date(`${db.today}T00:00:00+07:00`).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  const tasks = [
    { n: saQueue.length, label: "การจองที่ Sales สร้าง รอคุณอนุมัติ", href: "/admin/bookings?tab=sa" },
    { n: db.bookings.filter((b) => b.status === "RETURNED_PENDING_SETTLEMENT").length, label: `งานคืนหางรอสรุปยอด${flaggedCount ? ` มีข้อโต้แย้ง ${flaggedCount} รายการ` : ""}`, href: "/admin/bookings?tab=settle" },
    { n: db.bookings.filter((b) => b.status === "APPROVED_AWAITING_PAYMENT").length, label: "รอลูกค้าชำระเงิน", href: "/admin/bookings?tab=payment" },
  ];

  return (
    <>
      <PageHeader title="ภาพรวม" sub={monthLabel} />
      <div className="mb-6">
        <Suspense fallback={null}>
          <SchemaVersionPanel />
        </Suspense>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="รายได้ค่าเช่ารายเดือน (ก่อน VAT)">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-route text-[34px] font-extrabold tabular">{money(lastFull.value)}</p>
            <p className="text-[15px] text-ink-2">
              เดือน{lastFull.month}{" "}
              {change !== null && (
                <>
                  <span className={change >= 0 ? "font-semibold text-grass" : "font-semibold text-danger"}>
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(1)}%
                  </span>{" "}
                  จาก{prev.month}
                </>
              )}
            </p>
          </div>
          <div className="mt-5 flex h-48 items-end gap-3" role="img" aria-label="กราฟรายได้ 6 เดือนล่าสุด">
            {revenue.map((r, i) => {
              const partial = i === revenue.length - 1;
              return (
                <div key={r.key} className="flex h-full flex-1 flex-col justify-end">
                  <span className="mb-1 text-center text-[12px] tabular text-ink-3">{Math.round(r.value / 1000)}k</span>
                  <div
                    className={partial ? "rounded-t-md border-2 border-dashed border-sign bg-sign-wash" : "rounded-t-md bg-sign"}
                    style={{ height: `${(r.value / max) * 100}%` }}
                  />
                  <span className="mt-1.5 text-center text-[13px] text-ink-2">{r.month}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-ink-3">แท่งเส้นประคือเดือนปัจจุบัน (ยังไม่จบเดือน)</p>
        </Panel>

        <Panel title="ต้องจัดการ">
          <ul className="-my-2 divide-y divide-line">
            {tasks.map((t) => (
              <li key={t.label}>
                <Link href={t.href} className="flex items-center gap-4 py-3 hover:text-grass">
                  <span className="font-route w-8 text-[26px] font-extrabold tabular text-grass">{t.n}</span>
                  <span className="flex-1 text-[15px]">{t.label}</span>
                  <ArrowRight className="size-4 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-[14px]">
            <div>
              <dt className="text-ink-3">เงินค้ำประกันที่ถืออยู่</dt>
              <dd className="font-route text-[22px] font-extrabold tabular">{money(depositHeld)}</dd>
            </div>
            <div>
              <dt className="text-ink-3">ช่องทางการจอง</dt>
              <dd className="mt-1 space-y-0.5">
                {channels.map(({ c, n }) => (
                  <p key={c} className="flex justify-between"><span>{channelLabel[c]}</span><span className="tabular font-semibold">{n}</span></p>
                ))}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="หางตามลานและสถานะ">
          <ul className="space-y-4">
            {db.yards.map((y) => {
              const here = db.trailers.filter((t) => t.yard === y.id);
              const free = here.filter((t) => t.status === "AVAILABLE").length;
              const out = here.filter((t) => ["RENTED", "RESERVED"].includes(t.status)).length;
              const other = here.length - free - out;
              return (
                <li key={y.id}>
                  <p className="mb-1.5 flex items-center gap-2 font-semibold">
                    <YardShield n={y.number} size={20} /> ลาน{y.short}
                    <span className="ml-auto text-[14px] font-normal text-ink-2">ว่าง {free} · ออกให้เช่า {out} · อื่นๆ {other}</span>
                  </p>
                  <div className="flex h-4 overflow-hidden rounded-full bg-line">
                    <span className="bg-sign" style={{ width: `${(free / here.length) * 100}%` }} />
                    <span className="bg-reflect" style={{ width: `${(out / here.length) * 100}%` }} />
                    <span className="bg-warn/60" style={{ width: `${(other / here.length) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="อัตราการใช้หาง 30 วันล่าสุด">
          <ul className="space-y-3">
            {db.trailerTypes.map((t) => {
              const u = utilisation(t.id);
              return (
                <li key={t.id} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 text-[15px]">
                  <span>{t.name}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-sign" style={{ width: `${u}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular">{u}%</span>
                </li>
              );
            })}
          </ul>
          {(() => {
            const low = [...db.trailerTypes].sort((a, b) => utilisation(a.id) - utilisation(b.id))[0];
            return low && utilisation(low.id) < 50 ? (
              <p className="mt-4 text-[13px] text-ink-3">{low.name}ใช้งานต่ำสุด พิจารณาย้ายไปลานที่มีความต้องการมากกว่า</p>
            ) : null;
          })()}
        </Panel>
      </div>
    </>
  );
}
