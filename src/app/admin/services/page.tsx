import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { ServiceStatusButtons } from "@/components/service-status-buttons";
import { Badge, PageHeader } from "@/components/ui";
import { can } from "@/lib/admin";
import { money, thDateTimeIso, thDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  serviceKinds,
  serviceStatusLabel,
  serviceSummary,
  type ServiceDetails,
  type ServiceKind,
  type ServiceStatus,
} from "@/lib/service-requests";

export const instant = false;

export const metadata: Metadata = { title: "คำขอบริการเสริม" };

type Row = {
  id: string;
  kind: ServiceKind;
  name: string;
  phone: string;
  company: string | null;
  yard_code: string | null;
  preferred_date: string | null;
  details: ServiceDetails;
  estimate: number | null;
  note: string | null;
  status: ServiceStatus;
  created_at: string;
};

const tone: Record<ServiceStatus, "action" | "info" | "ok" | "muted"> = { NEW: "action", CONTACTED: "info", DONE: "ok", CANCELLED: "muted" };

export default async function ServiceRequests() {
  if (!(await can("SUPER_ADMIN", "SALES", "OPS"))) return <NoAccess need="พนักงาน" />;
  const sb = await createClient();
  const [req, msgs] = await Promise.all([
    sb.from("service_requests").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("contact_messages").select("id, name, phone, message, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const rows = (req.data ?? []) as Row[];
  const missingTable = !!req.error;

  return (
    <>
      <PageHeader title="คำขอบริการเสริม" sub="ใส่/ถอดยาง ล้างหัวลาก/หางลาก และฝากจอด ที่ลูกค้าขอผ่านหน้าเว็บ (ไม่ต้องเช่าหาง)" />
      {missingTable && (
        <p className="mb-5 rounded-xl border-2 border-warn/50 bg-paper p-4 text-[14px]">
          ยังไม่ได้รัน migration <code>20261111000011_service_requests.sql</code> คำขอที่เข้ามาระหว่างนี้จะอยู่ในหัวข้อ “ข้อความจากหน้าติดต่อเรา” ด้านล่าง
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-line bg-paper">
        <table className="w-full min-w-[900px] text-left text-[14px]">
          <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-semibold">ส่งเมื่อ</th>
              <th className="px-4 py-2.5 font-semibold">บริการ</th>
              <th className="px-4 py-2.5 font-semibold">ผู้ติดต่อ</th>
              <th className="px-4 py-2.5 font-semibold">วันที่ / ลาน</th>
              <th className="px-4 py-2.5 text-right font-semibold">ราคาประมาณ</th>
              <th className="px-4 py-2.5 font-semibold">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{thDateTimeIso(r.created_at)}</td>
                <td className="px-4 py-3">
                  <span className="block font-semibold">{serviceKinds.find((k) => k.id === r.kind)?.th}</span>
                  <span className="block text-ink-2">{serviceSummary(r.kind, r.details)}</span>
                  {r.details.plate && <span className="block text-ink-3">ทะเบียน {r.details.plate}</span>}
                  {r.note && <span className="mt-1 block text-ink-3">“{r.note}”</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="block font-semibold">{r.name}</span>
                  <a href={`tel:${r.phone}`} className="block text-grass underline">{r.phone}</a>
                  {r.company && <span className="block text-ink-3">{r.company}</span>}
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {r.preferred_date ? thDate(r.preferred_date) : "—"}
                  {r.yard_code && <span className="block text-ink-3">ลาน {r.yard_code}</span>}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular">{r.estimate != null ? money(Number(r.estimate)) : "—"}</td>
                <td className="space-y-2 px-4 py-3">
                  <Badge tone={tone[r.status]}>{serviceStatusLabel[r.status]}</Badge>
                  <ServiceStatusButtons id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">ยังไม่มีคำขอบริการ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!msgs.error && (
        <section className="mt-8">
          <h2 className="mb-3 text-[19px] font-bold">ข้อความจากหน้าติดต่อเรา</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
            {(msgs.data ?? []).map((m) => (
              <li key={m.id} className="px-4 py-3 text-[14px]">
                <span className="font-semibold">{m.name}</span> · <a href={`tel:${m.phone}`} className="text-grass underline">{m.phone}</a>
                <span className="ml-2 text-ink-3">{thDateTimeIso(m.created_at)}</span>
                <p className="mt-1 whitespace-pre-line text-ink-2">{m.message}</p>
              </li>
            ))}
            {(msgs.data ?? []).length === 0 && <li className="px-4 py-6 text-center text-ink-3">ยังไม่มีข้อความ</li>}
          </ul>
        </section>
      )}
    </>
  );
}
