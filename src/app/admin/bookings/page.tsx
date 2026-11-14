import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Badge, LinkButton, PageHeader, YardShield, cx } from "@/components/ui";
import { can, staffRole } from "@/lib/admin";
import { getStore } from "@/lib/data/store";
import { bookingStatusLabel, bookingStatusTone, channelLabel, thDateShort, thTime } from "@/lib/format";
import type { Booking } from "@/lib/types";

export const instant = false;

export const metadata: Metadata = { title: "ตรวจเอกสารและอนุมัติ" };


export default async function Queue({ searchParams }: PageProps<"/admin/bookings">) {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN", "SALES"))) return <NoAccess need="Super Admin และ Sales / CS" />;
  const role = await staffRole();
  const tab = ((await searchParams).tab as string) ?? "review";
  const hoursUntil = (iso: string) => (new Date(iso).getTime() - new Date(`${db.today}T09:00`).getTime()) / 36e5;

  const tabs: { id: string; label: string; filter: (b: Booking) => boolean }[] = [
    { id: "review", label: "รอตรวจเอกสาร", filter: (b) => ["PENDING_REVIEW", "NEED_MORE_DOCS"].includes(b.status) && !(b.createdByRole === "SALES" && b.status === "PENDING_REVIEW") },
    { id: "sa", label: "รอ Super Admin อนุมัติ", filter: (b) => b.status === "PENDING_REVIEW" && b.createdByRole === "SALES" },
    { id: "payment", label: "รอชำระ / ตรวจสลิป", filter: (b) => b.status === "APPROVED_AWAITING_PAYMENT" },
    { id: "settle", label: "รอสรุปยอดหลังคืน", filter: (b) => b.status === "RETURNED_PENDING_SETTLEMENT" },
    { id: "all", label: "ทั้งหมด", filter: () => true },
  ];
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];
  const rows = db.bookings.filter(active.filter).sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));

  return (
    <>
      <PageHeader
        title="ตรวจเอกสารและอนุมัติการจอง"
        sub="เรียงตามวันรับหางที่ใกล้ที่สุด · ป้ายด่วนคือรับหางภายใน 48 ชั่วโมง"
        actions={<LinkButton href="/admin/bookings/new" variant="primary">จองแทนลูกค้า</LinkButton>}
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => {
          const n = db.bookings.filter(t.filter).length;
          const on = t.id === active.id;
          return (
            <Link
              key={t.id}
              href={`/admin/bookings?tab=${t.id}`}
              role="tab"
              aria-selected={on}
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-full border-2 px-3.5 text-[14px] font-semibold",
                on ? "border-sign bg-sign text-on-sign" : "border-line bg-paper text-ink-2 hover:border-line-strong",
              )}
            >
              {t.label}
              <span className={cx("font-route", on ? "text-sign-ink" : "text-ink-3")}>{n}</span>
            </Link>
          );
        })}
      </div>
      {active.id === "sa" && role === "SALES" && (
        <p className="mb-4 rounded-lg bg-reflect-tint px-4 py-2.5 text-[14px] text-sign-deep">
          การจองที่ Sales สร้างแทนลูกค้าต้องให้ Super Admin อนุมัติ คุณดูสถานะได้แต่อนุมัติไม่ได้
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-paper">
        <table className="w-full min-w-[920px] text-left text-[14px]">
          <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-semibold">เลขการจอง</th>
              <th className="px-4 py-2.5 font-semibold">ลูกค้า</th>
              <th className="px-4 py-2.5 font-semibold">หาง</th>
              <th className="px-4 py-2.5 font-semibold">รับหาง ↑</th>
              <th className="px-4 py-2.5 font-semibold">ช่องทาง / ผู้สร้าง</th>
              <th className="px-4 py-2.5 font-semibold">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((b) => {
              const tr = db.getTrailer(b.trailerId)!;
              const h = hoursUntil(b.pickupAt);
              const urgent = h >= 0 && h <= 48 && ["PENDING_REVIEW", "NEED_MORE_DOCS", "APPROVED_AWAITING_PAYMENT"].includes(b.status);
              return (
                <tr key={b.id} className="hover:bg-sign-wash">
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="font-route font-extrabold text-grass hover:underline">
                      {b.no}
                    </Link>
                    {urgent && <Badge tone="danger" className="ml-2">ด่วน</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{db.getCustomer(b.customerId)!.name}</p>
                    <p className="text-[13px] text-ink-3">{db.getCustomer(b.customerId)!.kind === "COMPANY" ? "นิติบุคคล" : "บุคคลธรรมดา"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <YardShield n={db.getYard(tr.yard).number} size={16} />
                      <span className="font-route font-semibold">{tr.code}</span>
                    </span>
                    <p className="text-[13px] text-ink-3">{db.getType(tr.type).name}</p>
                  </td>
                  <td className="px-4 py-3 tabular">
                    {thDateShort(b.pickupAt)} {thTime(b.pickupAt)}
                    <p className="text-[13px] text-ink-3">ถึง {thDateShort(b.returnAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {channelLabel[b.channel]}
                    <p className="text-[13px] text-ink-3">{db.staffName(b)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-2">ไม่มีรายการในคิวนี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
