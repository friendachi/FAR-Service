import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, QrCode } from "lucide-react";
import { YardShield, buttonClass, cx } from "@/components/ui";
import { getDriverStore } from "@/lib/data/store";
import { thDateShort, thTime, thWeekday } from "@/lib/format";

export const metadata: Metadata = { title: "นัดของฉัน" };

export default async function DriverHome() {
  const db = await getDriverStore();
  const upcoming = db.appointmentsFor(db.currentDriverId!).filter((a) => a.state === "UPCOMING");
  const [next, ...rest] = upcoming;

  if (!next) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-paper p-8 text-center">
        <p className="text-[20px] font-bold">ยังไม่มีนัดรับหรือคืนหาง</p>
        <p className="mt-2 text-ink-2">เมื่อผู้เช่าระบุชื่อคุณในการจอง นัดจะขึ้นที่นี่พร้อม QR เช็กอิน</p>
      </div>
    );
  }

  const y = db.getYard(next.yard);
  const tr = db.getTrailer(next.booking.trailerId)!;

  return (
    <div className="space-y-6">
      {/* The next appointment owns the screen, written like a destination sign */}
      <section className="sign-panel on-sign px-6 py-6">
        <p className="text-[17px] font-semibold text-sign-ink">
          {next.kind === "PICKUP" ? "ไปรับหาง" : "ไปคืนหาง"} · {thWeekday(next.at)} {thDateShort(next.at)}
        </p>
        <p className="font-route text-[48px] font-extrabold leading-none tabular">{thTime(next.at)}</p>
        <div className="mt-5 flex items-center gap-4 border-t-2 border-white/35 pt-5">
          <YardShield n={y.number} size={54} />
          <div className="min-w-0">
            <p className="text-[28px] font-bold leading-tight">ลาน{y.short}</p>
            <p className="text-[16px] text-sign-ink">{y.address}</p>
          </div>
          <ArrowRight className="ml-auto size-10 shrink-0" strokeWidth={2.5} aria-hidden />
        </div>
        <div className="mt-5 rounded-lg bg-white/40 px-4 py-3">
          <p className="text-[15px] text-sign-ink">หางที่จะ{next.kind === "PICKUP" ? "รับ" : "คืน"}</p>
          <p className="text-[20px] font-bold">
            <span className="font-route">{tr.code}</span> · {tr.model.name}
          </p>
          <p className="text-[15px] text-sign-ink">ทะเบียน {tr.plate}</p>
        </div>
      </section>

      <div className="grid gap-3">
        <Link href={`/driver/appointments/${next.id}`} className={cx(buttonClass("primary", "lg"), "h-16 text-[19px]")}>
          <QrCode className="size-6" aria-hidden /> เปิด QR เช็กอิน
        </Link>
        <a href={y.mapUrl} target="_blank" rel="noreferrer" className={cx(buttonClass("outline", "lg"), "h-16 text-[19px]")}>
          <MapPin className="size-6" aria-hidden /> นำทางไปลาน{y.short}
        </a>
      </div>

      {rest.length > 0 && (
        <section>
          <h2 className="mb-3 text-[19px] font-bold">นัดถัดไป</h2>
          <ul className="space-y-3">
            {rest.map((a) => {
              const ay = db.getYard(a.yard);
              return (
                <li key={a.id}>
                  <Link href={`/driver/appointments/${a.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-paper p-4">
                    <YardShield n={ay.number} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-bold">
                        {a.kind === "PICKUP" ? "รับหาง" : "คืนหาง"} · ลาน{ay.short}
                      </span>
                      <span className="text-[15px] text-ink-2">
                        {thDateShort(a.at)} {thTime(a.at)} น. · {db.getTrailer(a.booking.trailerId)!.code}
                      </span>
                    </span>
                    <ArrowRight className="size-6 text-grass" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
