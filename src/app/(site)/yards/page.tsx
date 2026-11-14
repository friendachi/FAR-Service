import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { LinkButton, YardShield, buttonClass } from "@/components/ui";
import { yardMapEmbed } from "@/lib/yard-maps";
import { getStore } from "@/lib/data/store";
import { T } from "@/components/t";
import { hoursEn, yardEn } from "@/lib/i18n";

export const metadata: Metadata = { title: "ลานจอด · Yards" };

export default async function YardsPage() {
  const db = await getStore();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold"><T th="ลานจอดรับ–คืนหาง" en="Pickup and return yards" /></h1>
          <p className="mt-2 max-w-2xl text-[16px] text-ink-2">
            <T
              th="FAR Service ไม่มีบริการจัดส่ง ลูกค้านำหัวลากมารับและคืนหางเองที่ลาน รับที่ลานหนึ่งแล้วคืนอีกลานได้โดยไม่มีค่าใช้จ่าย"
              en="FAR Service does not deliver. Bring your tractor to pick up and return at the yard — pick up at one yard and return to the other at no cost."
            />
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {db.yards.map((y) => (
          <section key={y.id} className="overflow-hidden rounded-xl border border-line bg-paper">
            <div className="sign-panel on-sign m-3 flex items-center gap-4 px-6 py-5">
              <YardShield n={y.number} size={48} />
              <div>
                <h2 className="text-[24px] font-bold leading-tight">
                  <T th={`ลาน${y.short}`} en={`${yardEn[y.id]?.short ?? y.short} Yard`} />
                </h2>
                <p className="text-sign-ink"><T th={y.address} en={yardEn[y.id]?.address ?? y.address} /></p>
              </div>
            </div>
            <div className="space-y-4 px-6 pb-6">
              <iframe
                src={yardMapEmbed(y.id, `${y.name} ${y.address}`)}
                title={`ภาพดาวเทียมลาน${y.short} · ${yardEn[y.id]?.short ?? ""} Yard satellite view (Google Maps)`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="aspect-[16/9] w-full rounded-lg border border-line bg-sign-wash"
              />
              <p className="text-[15px] text-ink-2">
                <T th={`${y.note} · เปิด ${y.hours}`} en={`${yardEn[y.id]?.note ?? y.note} · Open ${hoursEn(y.hours)}`} />
              </p>
              <ul className="flex flex-wrap gap-2 text-[14px]">
                {db.trailerTypes.map((t) => (
                  <li key={t.id} className="rounded-full bg-sign-wash px-3 py-1 text-sign-deep">
                    <T
                      th={`${t.name} ${db.trailers.filter((x) => x.yard === y.id && x.type === t.id).length} คัน`}
                      en={`${t.english} ${db.trailers.filter((x) => x.yard === y.id && x.type === t.id).length}`}
                    />
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <LinkButton href={`/trailers?yard=${y.id}`} variant="sign"><T th="ดูหางที่ลานนี้" en="Trailers at this yard" /></LinkButton>
                <a href={y.mapUrl} target="_blank" rel="noreferrer" className={buttonClass("outline")}>
                  <T th="เปิด Google Maps" en="Open Google Maps" /> <ExternalLink className="size-4" aria-hidden />
                </a>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
