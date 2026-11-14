import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Badge, PageHeader, YardShield, buttonClass, cx } from "@/components/ui";
import { can } from "@/lib/admin";
import { getStore } from "@/lib/data/store";
import { thDate, thDateShort, thTime } from "@/lib/format";
import { getRole } from "@/lib/session";
import type { YardId } from "@/lib/types";

export const instant = false;

export const metadata: Metadata = { title: "ตารางลาน" };

export default async function YardBoard({ searchParams }: PageProps<"/admin/yard">) {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN", "OPS"))) return <NoAccess need="Super Admin และ Staff (Ops)" />;
  const role = await getRole();
  const home = role === "OPS" ? db.staff.find((s) => s.role === "OPS")?.homeYard : undefined;
  const yardId = (((await searchParams).yard as string) ?? home ?? "BP") as YardId;
  const yard = db.yards.find((y) => y.id === yardId) ?? db.yards[0];

  // Show the next 14 days so the sample data has something to work on.
  const horizon = new Date(new Date(`${db.today}T00:00:00Z`).getTime() + 14 * 864e5).toISOString().slice(0, 10);
  const appts = db.appointmentsFor()
    .filter((a) => a.yard === yard.id && a.state === "UPCOMING" && a.at.slice(0, 10) >= db.today && a.at.slice(0, 10) <= horizon);
  const days = [...new Set(appts.map((a) => a.at.slice(0, 10)))];

  return (
    <>
      <PageHeader
        title="ตารางรับ–คืนหาง"
        sub={`วันนี้ ${thDate(db.today)} · 14 วันข้างหน้า`}
        actions={
          <div className="flex rounded-lg border-2 border-sign p-0.5">
            {db.yards.map((y) => (
              <Link
                key={y.id}
                href={`/admin/yard?yard=${y.id}`}
                className={cx("flex h-10 items-center gap-2 rounded-md px-3 text-[14px] font-semibold", y.id === yard.id ? "bg-sign text-on-sign" : "text-grass hover:bg-sign-wash")}
              >
                <YardShield n={y.number} size={18} inverse={y.id !== yard.id} /> ลาน{y.short}
              </Link>
            ))}
          </div>
        }
      />

      {days.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center text-ink-2">ยังไม่มีนัดที่ลาน{yard.short} ใน 14 วันข้างหน้า</div>
      )}

      <div className="space-y-6">
        {days.map((d) => (
          <section key={d}>
            <h2 className="mb-2 text-[17px] font-bold">
              {d === db.today ? "วันนี้" : thDateShort(d)}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
              {appts
                .filter((a) => a.at.startsWith(d))
                .map((a) => {
                  const tr = db.getTrailer(a.booking.trailerId)!;
                  const ready = a.kind === "PICKUP" && a.booking.status === "READY_FOR_PICKUP";
                  return (
                    <li key={a.id} className="grid gap-3 p-4 md:grid-cols-[90px_110px_1fr_1fr_auto] md:items-center">
                      <span className="font-route text-[22px] font-extrabold tabular">{thTime(a.at)}</span>
                      <Badge tone={a.kind === "PICKUP" ? "info" : "action"} className="w-fit">{a.kind === "PICKUP" ? "ส่งมอบ" : "รับคืน"}</Badge>
                      <div>
                        <p className="font-semibold"><span className="font-route">{tr.code}</span> · {tr.model.name}</p>
                        <p className="text-[13px] text-ink-3">{a.booking.no} · {db.getCustomer(a.booking.customerId)!.name}</p>
                      </div>
                      <div className="text-[14px]">
                        <p>คนขับ: <strong>{a.booking.driverIds.map((x) => db.getDriver(x)?.name).join(" / ")}</strong></p>
                        <p className="text-ink-2">หัวลาก <span className="font-route font-semibold">{db.getTractor(a.booking.tractorId)?.plate}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {a.kind === "PICKUP" && !ready && <Badge tone="warn">ยังไม่ได้ตรวจ OUT</Badge>}
                        <Link href={`/admin/inspections/${a.id}`} className={buttonClass(ready || a.kind === "RETURN" ? "sign" : "outline", "sm")}>
                          {a.kind === "PICKUP" ? (ready ? "เช็กอินคนขับ" : "ตรวจสภาพ OUT") : "เช็กอินและตรวจ IN"}
                        </Link>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
