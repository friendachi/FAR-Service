import Link from "next/link";
import { getReference, lookups } from "@/lib/data/reference";
import { money } from "@/lib/format";
import { minTermNote, quote, specLine, startingPrice, tierLabel, tierLabelEn } from "@/lib/pricing";
import { modelNameEn, yardEn } from "@/lib/i18n";
import { T } from "./t";
import type { Availability } from "@/lib/availability";
import type { Trailer } from "@/lib/types";
import { Badge, Photo, YardShield, cx } from "./ui";
import { trailerPhotos } from "@/lib/photos";

const availBadge: Record<Availability, [string, string, "ok" | "muted" | "danger" | "info"]> = {
  FREE: ["ว่าง", "Available", "ok"],
  BOOKED: ["ไม่ว่าง", "Not available", "muted"],
  SERVICE: ["ซ่อมบำรุง", "Maintenance", "danger"],
  UNKNOWN: ["เลือกวันเพื่อตรวจว่าง", "Pick dates to check", "info"],
};

export async function TrailerCard({
  trailer,
  availability,
  days,
  months,
  query,
}: {
  trailer: Trailer;
  availability: Availability;
  days?: number;
  /** Calendar months of the searched range (prices monthly plans). */
  months?: number;
  query?: string;
}) {
  const ref = await getReference();
  const { getYard } = { ...ref, ...lookups(ref) };
  const yard = getYard(trailer.yard);
  const q = days ? quote(trailer.pricing, days, 0, months) : null;
  const blocked = availability === "BOOKED" || availability === "SERVICE";
  const [label, labelEn, tone] = availBadge[availability];
  const nameEn = modelNameEn[trailer.model.code] ?? trailer.model.name;

  return (
    <Link
      href={`/trailers/${trailer.id}${query ? `?${query}` : ""}`}
      className={cx(
        "group flex flex-col rounded-xl border border-line bg-paper p-4 transition-colors hover:border-sign",
        blocked && "opacity-70",
      )}
    >
      <div className="relative">
        <Photo src={trailerPhotos(trailer).photos[0]} alt={`${trailer.model.name} · ${nameEn}`} className="aspect-[16/10]" />
        <span className="absolute left-3 top-3">
          <Badge tone={tone}><T th={label} en={labelEn} /></Badge>
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[18px] font-bold leading-snug">
            <T th={trailer.model.name} en={nameEn} />
          </h3>
          <p className="mt-0.5 text-[14px] text-ink-3">
            <T th={`${specLine(trailer)} · ทะเบียน ${trailer.plate}`} en={`${specLine(trailer, "en")} · plate ${trailer.plate}`} />
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-md bg-sign-wash px-2 py-1">
          <YardShield n={yard.number} size={20} />
          <span className="font-route text-[15px] font-extrabold text-sign-deep">{trailer.code}</span>
        </span>
      </div>
      <div className="mt-auto border-t border-line pt-3">
        {q ? (
          <div className="mt-1 flex items-end justify-between gap-3">
            <span className="text-[14px] text-ink-2">
              <T
                th={`${trailer.pricing.plan === "MONTHLY_TIERED" ? `${q.months} เดือน` : `${q.days} วัน`} · ${tierLabel[q.tier]}`}
                en={`${trailer.pricing.plan === "MONTHLY_TIERED" ? `${q.months} mo` : `${q.days} days`} · ${tierLabelEn[q.tier]}`}
              />
            </span>
            <span className="font-route text-[22px] font-extrabold tabular text-grass">{money(q.rental)}</span>
          </div>
        ) : (
          <div className="mt-1 flex items-end justify-between gap-3">
            <span className="text-[14px] text-ink-2"><T th={`ลาน${yard.short}`} en={`${yardEn[yard.id]?.short ?? yard.short} Yard`} /></span>
            <span className="font-route text-[22px] font-extrabold tabular text-grass">
              {money(startingPrice(trailer.pricing).amount)}
              <span className="font-sans text-[13px] font-medium text-ink-3">
                <T th={startingPrice(trailer.pricing).unit} en={startingPrice(trailer.pricing).unit === "/วัน" ? "/day" : "/month"} />
              </span>
              {trailer.pricing.plan === "MONTHLY_TIERED" && (
                <span className="block text-right font-sans text-[12px] font-semibold text-reflect"><T th={minTermNote.shortTh} en={minTermNote.shortEn} /></span>
              )}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
