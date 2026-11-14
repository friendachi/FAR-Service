import { Suspense } from "react";
import { PageFallback } from "@/components/page-fallback";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { StartingPrice } from "@/components/starting-price";
import { RateConditions } from "@/components/rate-conditions";
import { TrailerStaffEditor } from "@/components/trailer-staff-editor";
import { staffRole } from "@/lib/admin";
import { ServiceTerms } from "@/components/service-terms";
import { RentalConditions } from "@/components/rental-conditions";
import { T } from "@/components/t";
import { hoursEn, modelNameEn, typeUseEn, yardEn } from "@/lib/i18n";
import { Badge, KeyValue, Photo, YardShield } from "@/components/ui";
import { trailerPhotos } from "@/lib/photos";
import { getStore } from "@/lib/data/store";
import { trailerStatusLabel, trailerStatusLabelEn, trailerStatusTone } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/trailers/[id]">) {
  const db = await getStore();
  const tr = db.getTrailer((await params).id);
  return { title: tr ? `${tr.model.name} ${tr.code} · ${modelNameEn[tr.model.code] ?? ""}` : "ไม่พบหาง · Not found" };
}

export default function TrailerPage(props: PageProps<"/trailers/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <TrailerPageContent {...props} />
    </Suspense>
  );
}

async function TrailerPageContent({ params }: PageProps<"/trailers/[id]">) {
  const db = await getStore();
  const { id } = await params;
  const tr = db.getTrailer(id);
  if (!tr) notFound();
  const type = db.getType(tr.type);
  const isStaff = !!(await staffRole());
  const yard = db.getYard(tr.yard);
  const nameEn = modelNameEn[tr.model.code] ?? tr.model.name;
  const ye = yardEn[yard.id];
  const m = (v: number | string) => <T th={`${v} เมตร`} en={`${v} m`} />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/trailers" className="inline-flex items-center gap-1 text-[15px] font-semibold text-grass hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> <T th="กลับไปหางให้เช่าทั้งหมด" en="Back to all trailers" />
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="sign-panel-sm inline-flex items-center gap-2 px-3 py-1.5">
                <YardShield n={yard.number} size={22} />
                <span className="font-route text-[18px] font-extrabold">{tr.code}</span>
              </span>
              <Badge tone={trailerStatusTone[tr.status]}>
                <T th={trailerStatusLabel[tr.status]} en={trailerStatusLabelEn[tr.status]} />
              </Badge>
            </div>
            <h1 className="mt-3 text-[28px] font-bold leading-tight sm:text-[34px]">
              <T th={tr.model.name} en={nameEn} />
            </h1>
          </div>

          <figure>
            <div className="grid grid-cols-12 gap-3">
              {(() => {
                const { photos } = trailerPhotos(tr);
                if (!photos.length) return <Photo alt={tr.model.name} className="col-span-12 aspect-[16/8]" />;
                return photos.map((src, i) => (
                  <Photo
                    key={src}
                    src={src}
                    alt={`${tr.model.name} · ${nameEn} (${i + 1})`}
                    priority={i === 0}
                    sizes={i === 0 ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 15vw, 50vw"}
                    className={
                      photos.length === 2
                        ? "col-span-6 aspect-[4/3]"
                        : i === 0
                          ? "col-span-12 aspect-[16/10]"
                          : photos.length === 3
                            ? "col-span-6 aspect-[4/3]"
                            : photos.length === 4
                              ? "col-span-4 aspect-[4/3]"
                              : "col-span-6 aspect-[4/3] sm:col-span-3"
                    }
                  />
                ));
              })()}
            </div>
            <figcaption className="mt-2 text-[13px] text-ink-3">
              {trailerPhotos(tr).own ? (
                <T th={`ภาพจริงของหางคันนี้ · ทะเบียน ${tr.plate}`} en={`Photos of this trailer · plate ${tr.plate}`} />
              ) : (
                <T th="ภาพตัวอย่างหางรุ่นนี้ของบริษัท" en="Sample photos of this model from our fleet" />
              )}
            </figcaption>
          </figure>

          <section>
            <h2 className="mb-4 text-[21px] font-bold"><T th="สเปกหาง" en="Specifications" /></h2>
            <KeyValue
              items={[
                [<T key="k" th="ประเภท" en="Type" />, <T key="v" th={`${type.name} (${type.english}) — ${type.use}`} en={`${type.english} — ${typeUseEn[type.id] ?? ""}`} />],
                [<T key="k" th="รุ่น" en="Model" />, <T key="v" th={tr.model.name} en={nameEn} />],
                [<T key="k" th="จำนวนเพลา" en="Axles" />, <T key="v" th={`${tr.axles} เพลา`} en={`${tr.axles}`} />],
                ...(tr.lengthFt ? [[<T key="k" th="ความยาว" en="Length" />, <T key="v" th={`${tr.lengthFt} ฟุต`} en={`${tr.lengthFt} ft`} />] as const] : []),
                ...(tr.model.widthM ? [[<T key="k" th="ความกว้าง" en="Width" />, m(tr.model.widthM)] as const] : []),
                ...(tr.model.lengthM ? [[<T key="k" th="ความยาวหาง" en="Trailer length" />, m(tr.model.lengthM)] as const] : []),
                ...(tr.model.deckLength ? [[<T key="k" th="พื้นที่ใช้งาน" en="Usable deck length" />, m(tr.model.deckLength)] as const] : []),
                ...(tr.model.deckHeightM ? [[<T key="k" th="ความสูงพื้น" en="Deck height" />, m(tr.model.deckHeightM)] as const] : []),
                [<T key="k" th="ทะเบียน" en="Plate" />, tr.plate],
                tr.pricing.tyreFee > 0
                  ? [<T key="k" th="ยาง" en="Tires" />, <T key="v" th="ไม่รวมยาง · มีบริการใส่/ถอดยาง" en="Not included · fitting service available" />]
                  : [<T key="k" th="ยาง" en="Tires" />, <T key="v" th="รวมยาง" en="Included" />],
              ].map(([k, v]) => [k, v] as [React.ReactNode, React.ReactNode])}
            />
          </section>

          <section className="rounded-xl border border-line bg-paper p-5">
            <h2 className="text-[19px] font-bold"><T th={`รับหางที่ลาน${yard.short}`} en={`Pick up at ${ye?.short ?? yard.short} Yard`} /></h2>
            <p className="mt-1 flex items-start gap-2 text-[15px] text-ink-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-grass" aria-hidden />
              <T th={`${yard.name} ${yard.address} · ${yard.hours}`} en={`${ye?.name ?? yard.name}, ${ye?.address ?? ""} · ${hoursEn(yard.hours)}`} />
            </p>
            <p className="mt-3 text-[15px] text-ink-2">
              <T
                th="คืนหางได้ทั้งลานบางพระและลานหนองใหญ่ ไม่มีค่าใช้จ่าย · คืนก่อนกำหนดคิดค่าเช่าตามระยะเวลาเช่าจริงและเรทที่ตรงกัน"
                en="Return to Bang Phra or Nong Yai at no cost · Early returns are re-priced on the actual days at the matching rate"
              />
            </p>
          </section>

          {isStaff && (
            <TrailerStaffEditor
              trailerId={tr.id}
              status={tr.status}
              yard={tr.yard}
              yards={db.yards}
              photos={(tr.uploadedPhotos ?? []).map((p) => ({ id: p.id, url: p.url }))}
              usingBuiltIn={!tr.uploadedPhotos?.length}
            />
          )}

          <RentalConditions type={tr.type} />

          <section className="rounded-xl border border-line bg-paper p-5">
            <h2 className="mb-4 text-[19px] font-bold"><T th="รวมอยู่ในการเช่า" en="Included with the rental" /></h2>
            <ServiceTerms compact type={tr.type} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-5">
            <StartingPrice trailer={tr} />
            {tr.pricing.plan === "MONTHLY_TIERED" && <RateConditions compact />}
          </div>
        </aside>
      </div>
    </div>
  );
}
