import type { Metadata } from "next";
import { YardShield } from "@/components/ui";
import { Badge } from "@/components/ui";
import { getDriverStore } from "@/lib/data/store";
import { thDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "ประวัติการรับ–คืนหาง" };

export default async function DriverHistory() {
  const db = await getDriverStore();
  const done = db.appointmentsFor(db.currentDriverId!).filter((a) => a.state === "DONE").reverse();
  return (
    <div>
      <h1 className="mb-4 text-[24px] font-bold">ประวัติการรับ–คืนหาง</h1>
      <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
        {done.map((a) => {
          const y = db.getYard(a.yard);
          return (
            <li key={a.id} className="flex items-center gap-4 p-4">
              <YardShield n={y.number} size={30} />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold">
                  {a.kind === "PICKUP" ? "รับหาง" : "คืนหาง"} <span className="font-route">{db.getTrailer(a.booking.trailerId)!.code}</span>
                </p>
                <p className="text-[15px] text-ink-2">
                  {thDateShort(a.at)} · ลาน{y.short} · {a.customerName ?? db.getCustomer(a.booking.customerId)?.name}
                </p>
              </div>
              {a.booking.flagged && a.kind === "RETURN" ? <Badge tone="danger">โต้แย้ง</Badge> : <Badge tone="ok">เซ็นแล้ว</Badge>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
