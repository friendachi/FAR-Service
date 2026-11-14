import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { QuoteStatusButtons, quoteStatusLabel } from "@/components/quote-status-buttons";
import { Badge, PageHeader } from "@/components/ui";
import type { QuoteStatus } from "@/app/actions/quotes";
import { can } from "@/lib/admin";
import { thDate, thDateTimeIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "คำขอใบเสนอราคา" };

type Row = {
  id: string;
  company: string | null;
  contact_name: string;
  phone: string;
  email: string | null;
  line_id: string | null;
  customer_kind: "COMPANY" | "PERSON" | null;
  items: { label: string; qty: number }[];
  start_date: string | null;
  months: number | null;
  yard_code: string | null;
  tyre_service: boolean;
  note: string | null;
  status: QuoteStatus;
  created_at: string;
};

const tone: Record<QuoteStatus, "action" | "info" | "ok" | "muted" | "warn"> = {
  NEW: "action",
  CONTACTED: "info",
  QUOTED: "warn",
  WON: "ok",
  LOST: "muted",
};

export default async function Quotes() {
  if (!(await can("SUPER_ADMIN", "SALES"))) return <NoAccess need="Super Admin และ Sales / CS" />;
  const sb = await createClient();
  const { data, error } = await sb.from("quote_requests").select("*").order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as Row[];
  const open = rows.filter((r) => r.status === "NEW").length;

  return (
    <>
      <PageHeader title="คำขอใบเสนอราคา" sub={`ลูกค้าขอราคาผ่านหน้าเว็บ · รอติดต่อ ${open} รายการ`} />
      {error && (
        <p className="mb-5 rounded-xl border-2 border-warn/50 bg-paper p-4 text-[14px]">
          ยังไม่ได้รัน migration <code>20261113000013_quote_requests.sql</code> คำขอที่เข้ามาระหว่างนี้อยู่ในหน้า “คำขอบริการเสริม” หัวข้อข้อความจากหน้าติดต่อเรา
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-line bg-paper">
        <table className="w-full min-w-[960px] text-left text-[14px]">
          <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-semibold">ส่งเมื่อ</th>
              <th className="px-4 py-2.5 font-semibold">ลูกค้า</th>
              <th className="px-4 py-2.5 font-semibold">หางที่ต้องการ</th>
              <th className="px-4 py-2.5 font-semibold">ระยะเช่า / เริ่ม / ลาน</th>
              <th className="px-4 py-2.5 font-semibold">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{thDateTimeIso(r.created_at)}</td>
                <td className="px-4 py-3">
                  <span className="block font-semibold">{r.company ?? r.contact_name}</span>
                  {r.company && <span className="block text-ink-2">{r.contact_name}</span>}
                  <a href={`tel:${r.phone}`} className="block text-grass underline">{r.phone}</a>
                  {r.email && <a href={`mailto:${r.email}`} className="block text-grass underline">{r.email}</a>}
                  {r.line_id && <span className="block text-ink-3">LINE: {r.line_id}</span>}
                  <span className="block text-[12px] text-ink-3">{r.customer_kind === "PERSON" ? "บุคคลธรรมดา" : "นิติบุคคล"}</span>
                </td>
                <td className="px-4 py-3">
                  <ul className="space-y-0.5">
                    {r.items.map((i, n) => (
                      <li key={n}>{i.label} <strong>× {i.qty}</strong></li>
                    ))}
                  </ul>
                  {r.tyre_service && <span className="mt-1 block text-ink-3">+ บริการใส่/ถอดยาง</span>}
                  {r.note && <span className="mt-1 block text-ink-3">“{r.note}”</span>}
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {r.months ? `${r.months} เดือน` : "—"}
                  <span className="block">{r.start_date ? `เริ่ม ${thDate(r.start_date)}` : "ยังไม่ระบุวัน"}</span>
                  {r.yard_code && <span className="block text-ink-3">ลาน {r.yard_code}</span>}
                </td>
                <td className="space-y-2 px-4 py-3">
                  <Badge tone={tone[r.status]}>{quoteStatusLabel[r.status]}</Badge>
                  <QuoteStatusButtons id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-3">ยังไม่มีคำขอใบเสนอราคา</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
