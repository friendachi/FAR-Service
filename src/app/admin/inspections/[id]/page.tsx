import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { InspectionForm } from "@/components/inspection-form";
import { NoAccess } from "@/components/no-access";
import { YardShield } from "@/components/ui";
import { can } from "@/lib/admin";
import { getStore } from "@/lib/data/store";
import { thDateShort, thTime } from "@/lib/format";

export const instant = false;

export default async function InspectionPage({ params }: PageProps<"/admin/inspections/[id]">) {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN", "OPS"))) return <NoAccess need="Super Admin และ Staff (Ops)" />;
  const a = db.getAppointment((await params).id);
  if (!a) notFound();
  const tr = db.getTrailer(a.booking.trailerId)!;
  const y = db.getYard(a.yard);

  return (
    <>
      <Link href={`/admin/yard?yard=${a.yard}`} className="inline-flex items-center gap-1 text-[15px] font-semibold text-grass hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> ตารางลาน{y.short}
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-4">
        <span className="sign-panel-sm inline-flex items-center gap-2 px-3 py-2">
          <YardShield n={y.number} size={24} />
          <span className="font-route text-[20px] font-extrabold">{tr.code}</span>
        </span>
        <div>
          <h1 className="text-[24px] font-bold leading-tight">
            {a.kind === "PICKUP" ? "ส่งมอบหาง" : "รับหางคืน"} · {tr.model.name}
          </h1>
          <p className="text-[15px] text-ink-2">
            {a.booking.no} · {db.getCustomer(a.booking.customerId)!.name} · นัด {thDateShort(a.at)} {thTime(a.at)} น.
          </p>
        </div>
      </div>
      <div className="max-w-4xl">
        <InspectionForm
          appointmentId={a.id}
          bookingId={a.booking.id}
          checklistTemplate={db.checklistTemplate}
          kind={a.kind === "PICKUP" ? "OUT" : "IN"}
          driverName={a.booking.driverIds.map((d) => db.getDriver(d)?.name).join(" / ")}
          tractorPlate={db.getTractor(a.booking.tractorId)?.plate ?? "—"}
          checkedIn={!!a.checkedIn}
          identityMatch={a.identityMatch}
          inspection={a.inspection}
          completed={a.state === "DONE"}
          previousDamage={
            a.kind === "RETURN"
              ? db.appointments.find((x) => x.booking.id === a.booking.id && x.kind === "PICKUP")?.inspection?.damaged ?? []
              : []
          }
        />
      </div>
    </>
  );
}
