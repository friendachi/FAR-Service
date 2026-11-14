import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { can } from "@/lib/admin";
import { getStore } from "@/lib/data/store";

export const instant = false;

export const metadata: Metadata = { title: "ลูกค้า" };

export default async function Customers() {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN", "SALES"))) return <NoAccess need="Super Admin และ Sales / CS" />;
  return (
    <>
      <PageHeader title="ลูกค้า" sub="ข้อมูลผู้เช่า หัวลาก และคนขับที่ผูกกับบัญชี" actions={<LinkButton href="/admin/bookings/new" variant="primary">จองแทนลูกค้า</LinkButton>} />
      <div className="overflow-x-auto rounded-xl border border-line bg-paper">
        <table className="w-full min-w-[820px] text-left text-[14px]">
          <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-semibold">ผู้เช่า</th>
              <th className="px-4 py-2.5 font-semibold">ประเภท</th>
              <th className="px-4 py-2.5 font-semibold">ผู้ติดต่อ</th>
              <th className="px-4 py-2.5 text-right font-semibold">หัวลาก</th>
              <th className="px-4 py-2.5 text-right font-semibold">คนขับ</th>
              <th className="px-4 py-2.5 text-right font-semibold">การจอง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {db.customers.map((c) => (
              <tr key={c.id} className="hover:bg-sign-wash">
                <td className="px-4 py-3">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-[13px] tabular text-ink-3">{c.taxId}</p>
                </td>
                <td className="px-4 py-3"><Badge tone="muted">{c.kind === "COMPANY" ? "นิติบุคคล" : "บุคคลธรรมดา"}</Badge></td>
                <td className="px-4 py-3">{c.contact}<p className="text-[13px] text-ink-3">{c.phone}</p></td>
                <td className="px-4 py-3 text-right tabular">{db.tractors.filter((t) => t.customerId === c.id).length}</td>
                <td className="px-4 py-3 text-right tabular">{db.drivers.filter((d) => d.customerIds.includes(c.id)).length}</td>
                <td className="px-4 py-3 text-right tabular">{db.bookings.filter((b) => b.customerId === c.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
