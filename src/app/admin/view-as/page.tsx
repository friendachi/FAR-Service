import type { Metadata } from "next";
import { viewAsCustomer, viewAsDriver } from "@/app/actions/view-as";
import { NoAccess } from "@/components/no-access";
import { Badge, Button, PageHeader, Panel } from "@/components/ui";
import { can } from "@/lib/admin";
import { getStore } from "@/lib/data/store";

export const instant = false;

export const metadata: Metadata = { title: "ดูหน้าลูกค้า / คนขับ" };

export default async function ViewAs() {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN"))) return <NoAccess need="Super Admin" />;
  return (
    <>
      <PageHeader
        title="ดูหน้าลูกค้า / คนขับ"
        sub="Super Admin เปิดหน้าของลูกค้าหรือคนขับคนใดก็ได้ เพื่อดูสิ่งที่เขาเห็นและช่วยทำรายการแทน"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`ลูกค้า (${db.customers.length})`}>
          <ul className="divide-y divide-line">
            {db.customers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="text-[13px] text-ink-3">
                    {c.kind === "COMPANY" ? "นิติบุคคล" : "บุคคลธรรมดา"} · {c.phone}
                  </span>
                </span>
                <form action={viewAsCustomer.bind(null, c.id)}>
                  <Button type="submit" size="sm" variant="outline">เปิดหน้าลูกค้า</Button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`คนขับ (${db.drivers.length})`}>
          <ul className="divide-y divide-line">
            {db.drivers.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{d.name}</span>
                  <span className="text-[13px] text-ink-3">{d.phone}</span>{" "}
                  {!d.invited && <Badge tone="muted">ยังไม่สมัคร</Badge>}
                </span>
                <form action={viewAsDriver.bind(null, d.id)}>
                  <Button type="submit" size="sm" variant="outline">เปิดหน้าคนขับ</Button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
