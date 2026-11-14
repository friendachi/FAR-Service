import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Badge, PageHeader, YardShield, cx } from "@/components/ui";
import { can } from "@/lib/admin";
import { getStore } from "@/lib/data/store";
import { trailerStatusLabel, trailerStatusTone } from "@/lib/format";
import type { BookingStatus, TrailerStatus } from "@/lib/types";

export const instant = false;

export const metadata: Metadata = { title: "สถานะและตำแหน่งหาง" };

const tile: Record<TrailerStatus, string> = {
  AVAILABLE: "bg-sign text-on-sign",
  RESERVED: "bg-info text-white",
  RENTED: "bg-reflect text-white",
  INSPECTION: "bg-warn-tint text-warn border-2 border-warn",
  MAINTENANCE: "bg-danger-tint text-danger border-2 border-danger",
  RETIRED: "bg-muted-tint text-ink-3",
};

const barTone: Partial<Record<BookingStatus, string>> = {
  IN_RENTAL: "bg-reflect text-white",
  READY_FOR_PICKUP: "bg-info text-white",
  CONFIRMED: "bg-info text-white",
  APPROVED_AWAITING_PAYMENT: "bg-info-tint text-info border border-info",
  PENDING_REVIEW: "bg-warn-tint text-warn border border-warn",
  NEED_MORE_DOCS: "bg-warn-tint text-warn border border-warn",
  RETURNED_PENDING_SETTLEMENT: "bg-muted-tint text-ink-2 border border-line-strong",
};

const DAY = 864e5;

export default async function Fleet() {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN", "OPS"))) return <NoAccess need="Super Admin และ Staff (Ops)" />;

  // Timeline window: 7 days back, 35 days ahead. Bar length is the real rental length.
  const start = new Date(`${db.today}T00:00:00`).getTime() - 7 * DAY;
  const span = 42;
  const pct = (iso: string) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - start) / DAY / span) * 100));
  const todayPct = pct(`${db.today}T00:00`);
  const ticks = Array.from({ length: span / 7 + 1 }, (_, i) => new Date(start + i * 7 * DAY));

  return (
    <>
      <PageHeader title="สถานะและตำแหน่งหาง" sub="แยกตามลานที่หางอยู่ตอนนี้ · คืนต่างลานจะย้ายหางไปลานใหม่อัตโนมัติ" />

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(trailerStatusLabel) as TrailerStatus[]).filter((s) => s !== "RETIRED").map((s) => (
          <Badge key={s} tone={trailerStatusTone[s]}>{trailerStatusLabel[s]} {db.trailers.filter((t) => t.status === s).length}</Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {db.yards.map((y) => {
          const here = db.trailers.filter((t) => t.yard === y.id);
          return (
            <section key={y.id} className="rounded-xl border border-line bg-paper p-4">
              <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
                <YardShield n={y.number} size={24} /> ลาน{y.short}
                <span className="text-[14px] font-normal text-ink-3">· {here.length} คัน</span>
              </h2>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {here.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/trailers?focus=${t.id}`} className={cx("flex h-[104px] flex-col justify-between rounded-lg p-2.5", tile[t.status])}>
                      <span>
                        <span className="block font-route text-[19px] font-extrabold leading-none">{t.code}</span>
                        <span className="mt-1 inline-block rounded border border-current px-1.5 py-px font-route text-[13px] font-extrabold leading-tight tabular">
                          {t.plate || "ไม่มีทะเบียน"}
                        </span>
                      </span>
                      <span className="text-[12px] font-semibold leading-tight">
                        {db.getType(t.type).name}
                        <br />
                        {trailerStatusLabel[t.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-paper">
        <header className="border-b border-line px-5 py-3.5">
          <h2 className="text-[17px] font-bold">ตารางการใช้หาง</h2>
          <p className="text-[13px] text-ink-3">ความยาวแท่งเท่ากับจำนวนวันเช่าจริง · เส้นแนวตั้งคือวันนี้</p>
        </header>
        <div className="overflow-x-auto">
          <div className="min-w-[860px] px-5 py-4">
            <div className="relative ml-[140px] h-6 text-[12px] text-ink-3">
              {ticks.map((d, i) => (
                <span key={d.getTime()} className={cx("absolute whitespace-nowrap", i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${((d.getTime() - start) / DAY / span) * 100}%` }}>
                  {d.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </span>
              ))}
            </div>
            <ul className="space-y-1.5">
              {db.trailers.map((t) => {
                const bks = db.bookings.filter((b) => b.trailerId === t.id && barTone[b.status]);
                return (
                  <li key={t.id} className="flex items-center">
                    <span className="w-[140px] shrink-0 pr-3 text-[13px]">
                      <span className="font-route font-extrabold">{t.code}</span>{" "}
                      <span className="font-route text-[12px] text-ink-2">{t.plate}</span>
                    </span>
                    <div className="relative h-8 flex-1 rounded bg-ground">
                      <span aria-hidden className="absolute inset-y-0 w-0.5 bg-sign" style={{ left: `${todayPct}%` }} />
                      {t.status === "MAINTENANCE" && (
                        <span className="absolute inset-y-1 flex items-center rounded bg-danger-tint px-2 text-[12px] font-semibold text-danger" style={{ left: `${todayPct}%`, width: "12%" }}>
                          ซ่อม
                        </span>
                      )}
                      {bks.map((b) => {
                        const l = pct(b.pickupAt);
                        const w = Math.max(1.5, pct(b.returnAt) - l);
                        return (
                          <Link
                            key={b.id}
                            href={`/admin/bookings/${b.id}`}
                            title={`${b.no} · ${db.getCustomer(b.customerId)!.name}`}
                            className={cx("absolute inset-y-1 flex items-center overflow-hidden whitespace-nowrap rounded px-2 text-[12px] font-semibold", barTone[b.status])}
                            style={{ left: `${l}%`, width: `${w}%` }}
                          >
                            {db.getCustomer(b.customerId)!.name.replace("บริษัท ", "").replace(" จำกัด", "")}
                          </Link>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
