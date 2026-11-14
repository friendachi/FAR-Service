import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BookingTimeline } from "@/components/booking-timeline";
import { DocReview } from "@/components/doc-review";
import { PaymentVerify } from "@/components/payment-verify";
import { SettlementPanel } from "@/components/settlement-panel";
import { NoAccess } from "@/components/no-access";
import { Badge, Button, KeyValue, Panel, YardShield } from "@/components/ui";
import { can, staffRole } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/data/store";
import { bookingStatusLabel, bookingStatusTone, channelLabel, money, thDateTime } from "@/lib/format";
import { rentalDays, tierLabel } from "@/lib/pricing";
import type { DocOwner } from "@/lib/types";

export const instant = false;

const groupTitle: Record<DocOwner, string> = {
  CUSTOMER: "ผู้เช่า",
  GUARANTOR: "ผู้ค้ำประกัน",
  TRACTOR: "หัวลาก",
  DRIVER: "คนขับ",
};

export default async function AdminBooking({ params }: PageProps<"/admin/bookings/[id]">) {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN", "SALES"))) return <NoAccess need="Super Admin และ Sales / CS" />;
  const b = db.getBooking((await params).id);
  if (!b) notFound();
  const role = await staffRole();
  const c = db.getCustomer(b.customerId)!;
  const tr = db.getTrailer(b.trailerId)!;
  const days = rentalDays(b.pickupAt, b.returnAt);
  const q = db.amountsFor(b);
  const g = db.getGuarantor(b.guarantorId)!;

  // BR-15: a Sales-created booking needs Super Admin; Super Admin may approve their own.
  const createdBySales = b.createdByRole === "SALES";
  const reviewable = ["PENDING_REVIEW", "NEED_MORE_DOCS"].includes(b.status);
  const canDecide = reviewable && (role === "SUPER_ADMIN" || (role === "SALES" && !createdBySales));

  const reqs = db.requirementsFor(c.kind);
  const owners: DocOwner[] = ["CUSTOMER", "GUARANTOR", "TRACTOR", "DRIVER"];
  const groups = owners
    .map((o) => ({
      title:
        o === "TRACTOR"
          ? `หัวลาก · ${db.getTractor(b.tractorId)?.plate}`
          : o === "DRIVER"
            ? `คนขับ · ${db.getDriver(b.driverIds[0])?.name}`
            : o === "GUARANTOR"
              ? `ผู้ค้ำประกัน · ${g.name}`
              : `${groupTitle[o]} · ${c.name}`,
      rows: reqs.filter((r) => r.owner === o).map((req) => ({ req, doc: db.docFor(req.key, db.ownerIdFor(req, b)) })),
    }))
    .filter((x) => x.rows.length);

  // Signed links (10 minutes) so reviewers can open the actual files from the private bucket.
  const paths = groups.flatMap((g) => g.rows.map((r) => r.doc.path).filter((x): x is string => !!x));
  if (paths.length) {
    const supabase = await createClient();
    const { data: signed } = await supabase.storage.from("documents").createSignedUrls(paths, 600);
    const urlOf = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
    for (const g of groups) for (const r of g.rows) if (r.doc.path) r.doc = { ...r.doc, url: urlOf.get(r.doc.path) ?? undefined };
  }

  const history = db.bookings.filter((x) => x.customerId === c.id && x.id !== b.id);

  return (
    <>
      <Link href="/admin/bookings" className="inline-flex items-center gap-1 text-[15px] font-semibold text-grass hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> คิวตรวจสอบ
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-route text-[28px] font-extrabold">{b.no}</h1>
        <Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge>
        {createdBySales && <Badge tone="action">สร้างโดย Sales · ต้องให้ Super Admin อนุมัติ</Badge>}
        {b.flagged && <Badge tone="danger">{b.flagged}</Badge>}
      </div>
      <div className="mt-5 max-w-3xl">
        <BookingTimeline status={b.status} />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-6">
          {b.status === "RETURNED_PENDING_SETTLEMENT" ? (
            <Panel title="สรุปค่าใช้จ่ายและเงินค้ำประกัน">
              <SettlementPanel bookingId={b.id} deposit={b.deposit?.amount ?? q.deposit} charges={b.charges ?? []} flagged={b.flagged} />
            </Panel>
          ) : b.status === "APPROVED_AWAITING_PAYMENT" ? (
            <Panel title="การชำระเงิน">
              <p className="text-[15px] text-ink-2">ส่งลิงก์ชำระเงินแล้ว · ครบกำหนด {b.paymentDueAt ? thDateTime(b.paymentDueAt) : "—"}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="outline">คัดลอกลิงก์ชำระเงิน</Button>
                <Button variant="outline">บันทึกการโอนแทนลูกค้า</Button>
              </div>
              <p className="mt-3 text-[13px] text-ink-3">การโอนที่ Sales บันทึกแทนลูกค้าต้องให้ Super Admin ยืนยัน</p>
              {b.pendingPaymentId && (
                <PaymentVerify
                  paymentId={b.pendingPaymentId}
                  blockedReason={
                    role === "SALES" && b.pendingPaymentRecordedByRole === "SALES"
                      ? "การชำระนี้ Sales บันทึกแทนลูกค้า ต้องให้ Super Admin ยืนยัน"
                      : undefined
                  }
                />
              )}
            </Panel>
          ) : (
            <DocReview bookingId={b.id} groups={groups} canDecide={canDecide} needsSuperAdmin={createdBySales && role === "SALES"} />
          )}
        </div>

        <aside className="space-y-6">
          <Panel title="การเช่า">
            <div className="mb-4 flex items-center gap-2">
              <YardShield n={db.getYard(tr.yard).number} size={22} />
              <span className="font-route text-[17px] font-extrabold">{tr.code}</span>
              <span className="font-semibold">{tr.model.name}</span>
            </div>
            <KeyValue
              items={[
                ["รับ", `${thDateTime(b.pickupAt)} · ลาน${db.getYard(b.pickupYard).short}`],
                ["คืน", `${thDateTime(b.returnAt)} · ลาน${db.getYard(b.returnYard).short}`],
                ["ระยะเช่า", `${days} วัน · ${tierLabel[q.tier]}`],
                ["ค่าเช่า + VAT", money(q.rental + q.vat)],
                ["เงินค้ำประกัน", money(q.deposit)],
                ["ช่องทาง", `${channelLabel[b.channel]} · ${db.staffName(b)}`],
              ]}
            />
          </Panel>
          <Panel title="ผู้เช่า">
            <KeyValue
              items={[
                ["ชื่อ", c.name],
                ["ประเภท", c.kind === "COMPANY" ? "นิติบุคคล" : "บุคคลธรรมดา"],
                ["เลขผู้เสียภาษี", c.taxId],
                ["ผู้ติดต่อ", `${c.contact} · ${c.phone}`],
                ["ผู้ค้ำประกัน", g.name],
              ]}
            />
            <p className="mt-4 text-[13px] font-semibold text-ink-3">ประวัติการเช่า</p>
            <ul className="mt-1 space-y-1 text-[14px]">
              {history.length ? history.map((h) => (
                <li key={h.id} className="flex justify-between gap-2">
                  <Link href={`/admin/bookings/${h.id}`} className="font-route text-grass hover:underline">{h.no}</Link>
                  <span className="text-ink-2">{bookingStatusLabel[h.status]}</span>
                </li>
              )) : <li className="text-ink-3">ลูกค้าใหม่</li>}
            </ul>
          </Panel>
          <Panel title="โน้ตภายใน">
            <textarea rows={3} placeholder="ลูกค้ามองไม่เห็นข้อความนี้" className="w-full rounded-lg border-2 border-line p-3 text-[14px] focus:border-sign focus:outline-none" />
          </Panel>
        </aside>
      </div>
    </>
  );
}
