import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { NoAccess } from "@/components/no-access";
import { Badge, LinkButton, PageHeader, cx } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { bangkokToday } from "@/lib/fleet-admin";
import { CHECKUP_ALERT_DAYS, CHECKUP_MONTHS, checkupBoard, checkupItems, type CheckupState } from "@/lib/handover";
import { thDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "ตรวจเช็คสภาพหาง 6 เดือน" };

const badge: Record<CheckupState, { tone: "danger" | "warn" | "ok"; text: (days: number | null) => string }> = {
  OVERDUE: { tone: "danger", text: (d) => `เลยกำหนด ${Math.abs(d ?? 0)} วัน` },
  NEVER: { tone: "danger", text: () => "ยังไม่มีประวัติ · ตรวจได้เลย" },
  DUE: { tone: "warn", text: (d) => (d === 0 ? "ครบกำหนดวันนี้" : `ครบกำหนดใน ${d} วัน`) },
  OK: { tone: "ok", text: (d) => `อีก ${d} วัน` },
};

export default async function Checkups() {
  const role = await staffRole();
  if (!role) return <NoAccess need="พนักงาน" />;
  const sb = await createClient();
  const today = bangkokToday();
  const [{ data: contracts }, checks, { data: outs }] = await Promise.all([
    sb.from("rental_contracts").select("plate_no, customer_name, trailer_kind, start_date").eq("status", "ACTIVE").order("seq"),
    sb.from("trailer_checkups").select("id, plate_no, trailer_kind, inspected_on, repair_count, mechanic_name, inspector_name").order("inspected_on", { ascending: false }).limit(300),
    sb.from("rental_handovers").select("happened_on, rental_contracts(plate_no)").eq("kind", "HANDOVER"),
  ]);
  const ready = !checks.error;
  const history = checks.data ?? [];
  const handovers = (outs ?? []).flatMap((h) => {
    const c = h.rental_contracts as unknown as { plate_no: string } | null;
    return c ? [{ plate_no: c.plate_no, happened_on: h.happened_on }] : [];
  });
  const board = checkupBoard(contracts ?? [], history, handovers, today);
  const alerts = board.filter((b) => b.state !== "OK");

  return (
    <>
      <PageHeader
        title="ตรวจเช็คสภาพหาง 6 เดือน"
        sub={`หางที่ลูกค้าเช่าอยู่ต้องตรวจทุก ${CHECKUP_MONTHS} เดือน (นับจากการตรวจครั้งล่าสุด หรือวันส่งมอบ / วันเริ่มสัญญา) · แจ้งเตือนก่อนครบกำหนด ${CHECKUP_ALERT_DAYS} วัน`}
        actions={
          <LinkButton href="/admin/checkups/new">
            <ClipboardCheck className="size-4" aria-hidden /> บันทึกการตรวจเช็ค
          </LinkButton>
        }
      />
      {!ready && (
        <p className="mb-4 rounded-xl border-2 border-warn/50 bg-paper px-5 py-3 text-[15px]">
          ยังบันทึกการตรวจเช็คไม่ได้ · ให้รัน migration <code>20261117000017_handover_checkups.sql</code> ใน Supabase ก่อน
        </p>
      )}
      {alerts.length > 0 && (
        <p role="alert" className="mb-4 rounded-xl border-2 border-danger bg-danger-tint px-5 py-3 font-semibold text-danger">
          ถึงกำหนดตรวจเช็ค {alerts.length} คัน: {alerts.map((a) => a.plate_no).join(", ")}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-paper">
        <table className="w-full min-w-[860px] text-left text-[14px]">
          <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-semibold">ทะเบียน</th>
              <th className="px-4 py-2.5 font-semibold">ลูกค้า</th>
              <th className="px-4 py-2.5 font-semibold">ตรวจล่าสุด</th>
              <th className="px-4 py-2.5 font-semibold">ครบกำหนดตรวจ</th>
              <th className="px-4 py-2.5 font-semibold">สถานะ</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {board.map((b) => (
              <tr key={b.plate_no} className={cx((b.state === "OVERDUE" || b.state === "NEVER") && "bg-danger-tint/40", b.state === "DUE" && "bg-warn-tint/50")}>
                <td className="px-4 py-3 font-route text-[16px] font-extrabold">
                  {b.plate_no}
                  {b.trailer_kind && <span className="ml-1.5 text-[12px] font-semibold text-ink-3">{b.trailer_kind}</span>}
                </td>
                <td className="px-4 py-3">{b.customer_name}</td>
                <td className="px-4 py-3">{b.lastCheck ? thDate(b.lastCheck) : <span className="text-ink-3">—</span>}</td>
                <td className="px-4 py-3 font-semibold">{b.due ? thDate(b.due) : "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={badge[b.state].tone}>{b.state === "OVERDUE" && !b.lastCheck ? "ยังไม่เคยตรวจ · เลยกำหนดแล้ว" : badge[b.state].text(b.days)}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <LinkButton href={`/admin/checkups/new?plate=${encodeURIComponent(b.plate_no)}`} size="sm" variant={b.state === "OK" ? "ghost" : "sign"}>
                    ตรวจเช็ค
                  </LinkButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-8 text-[20px] font-bold">ประวัติการตรวจเช็ค</h2>
      {history.length === 0 ? (
        <p className="rounded-xl border border-line bg-paper p-6 text-center text-ink-2">ยังไม่มีประวัติ</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-semibold">วันที่ตรวจ</th>
                <th className="px-4 py-2.5 font-semibold">ทะเบียน</th>
                <th className="px-4 py-2.5 font-semibold">ผลตรวจ</th>
                <th className="px-4 py-2.5 font-semibold">ช่างผู้ซ่อม · ผู้ตรวจสอบ</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{thDate(c.inspected_on)}</td>
                  <td className="px-4 py-3 font-route font-extrabold">
                    {c.plate_no}
                    {c.trailer_kind && <span className="ml-1.5 text-[12px] font-semibold text-ink-3">{c.trailer_kind}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.repair_count ? <Badge tone="danger">ซ่อม / เสียหาย {c.repair_count} จาก {checkupItems.length}</Badge> : <Badge tone="ok">ปกติทุกรายการ</Badge>}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{[c.mechanic_name, c.inspector_name].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/checkups/${c.id}`} className="font-semibold text-grass underline">ดู / พิมพ์</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
