import { Suspense } from "react";
import { PageFallback } from "@/components/page-fallback";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Phone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { DriverAcknowledge } from "@/components/driver-acknowledge";
import { YardShield, buttonClass, cx } from "@/components/ui";
import { getDriverStore } from "@/lib/data/store";
import { thDateShort, thTime } from "@/lib/format";
import { COMPANY_PHONE_TEL } from "@/lib/company";

export default function AppointmentPage(props: PageProps<"/driver/appointments/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AppointmentPageContent {...props} />
    </Suspense>
  );
}

async function AppointmentPageContent({ params, searchParams }: PageProps<"/driver/appointments/[id]">) {
  const db = await getDriverStore();
  const a = db.getAppointment((await params).id);
  if (!a) notFound();
  const step = (await searchParams).step;
  const y = db.getYard(a.yard);
  const tr = db.getTrailer(a.booking.trailerId)!;
  const tractor = db.getTractor(a.booking.tractorId)!;

  return (
    <div className="space-y-6">
      <Link href="/driver" className="inline-flex items-center gap-1 text-[16px] font-semibold text-grass">
        <ChevronLeft className="size-5" aria-hidden /> นัดของฉัน
      </Link>

      <header className="flex items-center gap-4">
        <YardShield n={y.number} size={48} />
        <div>
          <h1 className="text-[24px] font-bold leading-tight">
            {a.kind === "PICKUP" ? "รับหาง" : "คืนหาง"} · ลาน{y.short}
          </h1>
          <p className="text-[16px] text-ink-2">
            {thDateShort(a.at)} เวลา {thTime(a.at)} น.
          </p>
        </div>
      </header>

      {step === "check" ? (
        <DriverAcknowledge
          kind={a.kind}
          bookingId={a.booking.id}
          checkedIn={!!a.checkedIn}
          inspection={a.inspection}
          totalItems={db.checklistTemplate.reduce((n, g) => n + g.items.length, 0)}
        />
      ) : (
        <>
          <section className="rounded-xl border-2 border-sign bg-paper p-5 text-center">
            <p className="text-[17px] font-semibold">ยื่นให้เจ้าหน้าที่ลานสแกน</p>
            <div className="mx-auto mt-4 w-full max-w-[280px]">
              <QRCodeSVG value={`FAR-CHECKIN|${a.id}|${a.code}`} size={280} fgColor="#003b20" className="h-auto w-full" />
            </div>
            <p className="mt-4 text-[15px] text-ink-3">หรือบอกรหัส</p>
            <p className="font-route text-[44px] font-extrabold tracking-[0.12em] tabular">{a.code}</p>
          </section>

          <section className="rounded-xl border border-line bg-paper p-5 text-[17px]">
            <p className="text-[15px] text-ink-3">เจ้าหน้าที่จะตรวจให้ตรงกับการจอง</p>
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
              <dt className="text-ink-2">หาง</dt>
              <dd className="font-bold"><span className="font-route">{tr.code}</span> {db.getType(tr.type).name}</dd>
              <dt className="text-ink-2">หัวลาก</dt>
              <dd className="font-route font-bold">{tractor.plate}</dd>
              <dt className="text-ink-2">ใบขับขี่</dt>
              <dd className="font-bold">นำบัตรตัวจริงมาด้วย</dd>
            </dl>
          </section>

          <div className="grid gap-3">
            <Link href={`/driver/appointments/${a.id}?step=check`} className={cx(buttonClass("primary", "lg"), "h-16 text-[19px]")}>
              เจ้าหน้าที่ตรวจเสร็จแล้ว · ดูผลและเซ็น
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <a href={y.mapUrl} target="_blank" rel="noreferrer" className={cx(buttonClass("outline", "lg"), "h-14")}>
                <MapPin className="size-5" aria-hidden /> แผนที่
              </a>
              <a href={COMPANY_PHONE_TEL} className={cx(buttonClass("outline", "lg"), "h-14")}>
                <Phone className="size-5" aria-hidden /> โทรหาลาน
              </a>
            </div>
          </div>
          <p className="text-center text-[13px] text-ink-3">QR และรหัสใช้ได้เฉพาะวันนัด ±1 วัน</p>
        </>
      )}
    </div>
  );
}
