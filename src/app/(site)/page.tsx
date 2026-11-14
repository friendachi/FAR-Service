import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarRange, FileCheck2, FileText, Handshake, KeyRound, Phone, Repeat, ShieldCheck, Timer, Wallet, Wrench, Zap } from "lucide-react";
import { LineIcon } from "@/components/brand-icons";
import { FestivalBadge } from "@/components/festival";
import { ArticleCard } from "@/components/article-card";
import { RateConditions } from "@/components/rate-conditions";
import { bangkokToday, publishedArticles } from "@/lib/articles";
import { RentalConditions, rentalScope } from "@/components/rental-conditions";
import { ExtraServices, ServiceTerms } from "@/components/service-terms";
import { T } from "@/components/t";
import { LinkButton, Photo, YardShield, buttonClass, cx } from "@/components/ui";
import { LINE_QR, telHref } from "@/lib/company";
import { getReference } from "@/lib/data/reference";
import { getStore } from "@/lib/data/store";
import { money } from "@/lib/format";
import { modelNameEn, typeNameEn, typeUseEn, yardEn } from "@/lib/i18n";
import { typePhoto, workPhotos } from "@/lib/photos";
import { minTermNote, startingPrice } from "@/lib/pricing";

const steps = [
  {
    icon: FileText,
    th: "ขอใบเสนอราคา",
    en: "Request a quotation",
    bodyTh: "บอกรุ่นหาง จำนวน และระยะเวลาเช่า ผ่านฟอร์ม โทร หรือ LINE",
    bodyEn: "Tell us the model, quantity and rental length by form, phone or LINE.",
  },
  {
    icon: Handshake,
    th: "ยืนยันราคาและวันรับหาง",
    en: "Confirm price and pickup date",
    bodyTh: "เจ้าหน้าที่ส่งใบเสนอราคา แจ้งหางที่ว่าง และนัดวันรับหางที่ลาน",
    bodyEn: "We send the quotation, confirm availability and set the pickup date.",
  },
  {
    icon: FileCheck2,
    th: "ส่งเอกสารทำสัญญา",
    en: "Send contract documents",
    bodyTh: "ส่งเอกสารผู้เช่า ผู้ค้ำ หัวลาก และคนขับ ให้เจ้าหน้าที่ตรวจ",
    bodyEn: "Send the renter, guarantor, tractor and driver documents for review.",
  },
  {
    icon: Wallet,
    th: "ชำระเงินครั้งแรก",
    en: "First payment",
    bodyTh: "เงินค้ำประกัน + ค่าเช่าเดือนแรก (+ ค่าใส่ยาง) จากนั้นชำระรายเดือนตามวันรับหาง",
    bodyEn: "Deposit + first month (+ tire fitting), then monthly on the pickup date.",
  },
  {
    icon: KeyRound,
    th: "รับหางที่ลาน",
    en: "Pick up at the yard",
    bodyTh: "ตรวจสภาพร่วมกันแล้วต่อหางออกได้เลย คืนได้ทั้งบางพระและหนองใหญ่",
    bodyEn: "Inspect together and hook up. Return to Bang Phra or Nong Yai.",
  },
];

const services = [
  {
    icon: Timer,
    th: "เช่าระยะสั้น",
    en: "Short-term rental",
    bodyTh: "เหมาะกับงานเร่งด่วน งานตามฤดูกาล หรือช่วงที่หางของคุณเข้าซ่อมบำรุง",
    bodyEn: "For urgent jobs, seasonal work, or while your own trailers are in for maintenance.",
  },
  {
    icon: CalendarRange,
    th: "เช่าระยะยาว",
    en: "Long-term rental",
    bodyTh: "ลดภาระการลงทุนและค่าบำรุงรักษา พร้อมอัตราค่าเช่าที่คุ้มค่ากว่าสำหรับสัญญาต่อเนื่อง",
    bodyEn: "Cut capital and maintenance costs, with better-value rates for continuing contracts.",
  },
];

const reasons = [
  {
    icon: ShieldCheck,
    th: "หางสภาพพร้อมใช้งาน",
    en: "Road-ready trailers",
    bodyTh: "ทุกคันผ่านการตรวจเช็กระบบเบรก ยาง ไฟ และโครงสร้างก่อนส่งมอบ",
    bodyEn: "Every trailer has its brakes, tires, lights and structure checked before handover.",
  },
  {
    icon: Zap,
    th: "ส่งมอบรวดเร็ว",
    en: "Fast handover",
    bodyTh: "จัดเตรียมหางให้พร้อมรับงานภายใน 1 วัน",
    bodyEn: "We get your trailer ready for work within 1 day.",
  },
  {
    icon: Wrench,
    th: "ทีมซ่อมบำรุงคอยดูแล",
    en: "Maintenance team on hand",
    bodyTh: "มีบริการตรวจเช็กและซ่อมบำรุงตลอดระยะเวลาเช่า",
    bodyEn: "Inspection and maintenance throughout the rental.",
  },
  {
    icon: BadgeCheck,
    th: "เงื่อนไขชัดเจน",
    en: "Clear terms",
    bodyTh: "ค่าเช่าโปร่งใส ไม่มีค่าใช้จ่ายแอบแฝง",
    bodyEn: "Transparent rates, no hidden costs.",
  },
];

const heroPhoto = "/photos/models/work-1.jpg";

export default async function Home() {
  const [db, { models, company, festival }] = await Promise.all([getStore(), getReference()]);
  const countAt = (y: string) => db.trailers.filter((t) => t.yard === y && t.status === "AVAILABLE").length;
  const fromRate = (type: string) => {
    const prices = models.filter((m) => m.type === type).map((m) => startingPrice(m.pricing));
    const best = prices.sort((a, b) => a.amount - b.amount)[0];
    return best ?? { amount: 0, unit: "" };
  };
  const unit = (u: string) => <T th={u} en={u === "/วัน" ? "/day" : "/month"} />;
  const latest = publishedArticles(bangkokToday()).slice(0, 3);
  const facts = [
    { icon: FileText, labelTh: "รุ่นให้เลือก", labelEn: "Models to choose from", th: `${models.length} รุ่น · 3 ประเภท`, en: `${models.length} models · 3 types` },
    { icon: ShieldCheck, labelTh: "ลานรับ–คืนหาง", labelEn: "Pickup & return yards", th: "2 ลาน ชลบุรี", en: "2 yards, Chonburi" },
    { icon: Repeat, labelTh: "คืนต่างลาน", labelEn: "Return to the other yard", th: "ไม่มีค่าใช้จ่าย", en: "Free of charge" },
    { icon: Wrench, labelTh: "ดูแลช่วงล่างตลอดสัญญา", labelEn: "Suspension care, full term", th: "ไม่มีค่าใช้จ่าย", en: "Free of charge" },
  ];

  return (
    <>
      {/* First viewport: full-width banner of our own trailers at work */}
      <section data-hero className="relative isolate overflow-hidden bg-on-sign">
        <Image
          src={heroPhoto}
          alt=""
          aria-hidden
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="-z-10 object-cover object-[center_62%]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,20,4,0.82)_0%,rgba(10,20,4,0.55)_45%,rgba(10,20,4,0.15)_75%,rgba(10,20,4,0.55)_100%)]" />

        <div className="mx-auto flex min-h-[540px] max-w-7xl flex-col px-4 pb-6 pt-10 sm:px-6 lg:min-h-[600px] lg:px-8 lg:pt-14">
          <h1 className="hero-title text-white">
            <span className="hero-in-left block font-route text-[54px] font-extrabold italic leading-[0.95] tracking-[-0.02em] sm:text-[84px] lg:text-[112px]">
              FAR <span className="text-sign">SERVICE</span>
            </span>
            <span className="hero-in-right mt-4 block" style={{ animationDelay: "120ms" }}>
              <span className="inline-block -skew-x-12 bg-reflect px-5 py-2 text-[16px] font-bold sm:text-[22px] lg:text-[26px]">
                <span className="inline-block skew-x-12">
                  <T th="ให้เช่าหางพื้นเรียบ · หางก้างปลา · หางโลว์เบด" en="Flatbed · chassis · lowbed trailers for rent" />
                </span>
              </span>
            </span>
            <span style={{ animationDelay: "240ms" }} className="hero-in-zoom mt-4 block max-w-4xl text-[28px] font-bold italic leading-tight sm:text-[40px] lg:text-[48px]">
              <T th="หางเทรลเลอร์พร้อมใช้ ให้ธุรกิจขนส่งของคุณไม่ต้องหยุดวิ่ง" en="Trailers ready to roll, so your haulage business never stops" />
            </span>
          </h1>
          <p style={{ animationDelay: "360ms" }} className="hero-in-up hero-title mt-3 max-w-2xl text-[16px] font-semibold text-white sm:text-[19px]">
            <T
              th="FAR Service ให้เช่าหางเทรลเลอร์คุณภาพสำหรับบริษัทขนส่งและผู้ประกอบการรถบรรทุก เพิ่มกำลังการขนส่งได้ทันที โดยไม่ต้องลงทุนซื้อหางเอง"
              en="FAR Service rents quality trailers to transport companies and truck operators. Add hauling capacity right away, without buying trailers yourself."
            />
          </p>

          <div style={{ animationDelay: "420ms" }} className="hero-in-up mt-6 flex flex-wrap gap-3">
            <Link href="/quote" className={cx(buttonClass("primary", "lg"), "h-13 px-7 text-[17px] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)]")}>
              <FileText className="size-5" aria-hidden /> <T th="ขอใบเสนอราคา" en="Request a quotation" />
            </Link>
            <Link href="/trailers" className="inline-flex h-13 items-center gap-2 rounded-lg border-2 border-white px-6 text-[17px] font-semibold text-white hover:bg-white/15">
              <T th="ดูหางให้เช่า" en="See our trailers" /> <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
            <ul style={{ animationDelay: "480ms" }} className="hero-in-down flex flex-wrap gap-3" aria-label="ลานจอด · Yards">
              {db.yards.map((y) => (
                <li key={y.id}>
                  <Link
                    href={`/trailers?yard=${y.id}`}
                    className="group flex items-center gap-3 rounded-xl bg-paper/95 py-2.5 pl-3 pr-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] hover:bg-paper"
                  >
                    <YardShield n={y.number} size={36} />
                    <span className="leading-tight">
                      <span className="block text-[17px] font-bold text-ink">
                        <T th={`ลาน${y.short}`} en={`${yardEn[y.id]?.short ?? y.short} Yard`} />
                      </span>
                      <span className="block text-[13px] text-ink-2">
                        <T th={`ว่าง ${countAt(y.id)} คัน`} en={`${countAt(y.id)} available`} />
                      </span>
                    </span>
                    <ArrowRight className="size-6 text-reflect transition-transform group-hover:translate-x-1" strokeWidth={2.5} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            {festival && (
              <div style={{ animationDelay: "560ms" }} className="hero-in-right">
                <FestivalBadge festival={festival} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Facts from the fleet itself (live counts), not marketing numbers */}
      <section className="border-b border-line bg-paper">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4 [&>div+div]:border-l [&>div]:border-line max-lg:[&>div:nth-child(3)]:border-l-0 max-lg:[&>div:nth-child(n+3)]:border-t">
          {facts.map((f) => (
            <div key={f.labelEn} className="flex items-center gap-3 bg-paper px-4 py-5 sm:px-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sign-wash text-grass">
                <f.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <dt className="text-[13px] text-ink-2"><T th={f.labelTh} en={f.labelEn} /></dt>
                <dd className="font-route text-[22px] font-extrabold leading-tight text-ink">
                  <T th={f.th} en={f.en} />
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* Our services and why FAR Service (owner's copy) */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8" aria-labelledby="our-services">
        <h2 id="our-services" className="text-[28px] font-bold"><T th="บริการของเรา" en="Our services" /></h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {services.map((sv) => (
            <div key={sv.en} className="flex gap-4 rounded-xl border-2 border-sign bg-paper p-6">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-sign text-on-sign">
                <sv.icon className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="text-[20px] font-bold"><T th={sv.th} en={sv.en} /></h3>
                <p className="mt-1 text-[16px] leading-relaxed text-ink-2"><T th={sv.bodyTh} en={sv.bodyEn} /></p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-[28px] font-bold"><T th="ทำไมต้อง FAR Service" en="Why FAR Service" /></h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((r) => (
            <li key={r.en} className="rounded-xl border border-line bg-paper p-5">
              <span className="flex size-11 items-center justify-center rounded-lg bg-sign-wash text-grass">
                <r.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-[17px] font-bold"><T th={r.th} en={r.en} /></h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2"><T th={r.bodyTh} en={r.bodyEn} /></p>
            </li>
          ))}
        </ul>
      </section>

      {/* Company profile, Thai and English */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-12 sm:px-6 lg:px-8" aria-labelledby="profile">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="font-route text-[13px] font-extrabold tracking-[0.14em] text-grass">COMPANY PROFILE</p>
            <h2 id="profile" className="mt-1 text-[28px] font-bold leading-tight">
              {company.nameTh}
              <span className="block text-[20px] font-semibold text-ink-2">{company.nameEn}</span>
            </h2>
            <div className="mt-4 grid gap-4 text-[15px] leading-relaxed text-ink-2 sm:grid-cols-2 lg:grid-cols-1">
              <div lang="th" className="space-y-2 border-l-4 border-sign pl-4">
                {company.profileTh.split("\n").map((p) => <p key={p}>{p}</p>)}
              </div>
              <div lang="en" className="space-y-2 border-l-4 border-line-strong pl-4">
                {company.profileEn.split("\n").map((p) => <p key={p}>{p}</p>)}
              </div>
              <Link href="/about" className="inline-flex items-center gap-1 font-semibold text-grass underline">
                <T th="อ่านเพิ่มเติมเกี่ยวกับเรา" en="More about us" /> <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr]">
            {workPhotos.map((p, i) => (
              <Photo
                key={p.src}
                src={p.src}
                alt={p.alt}
                sizes="(min-width: 1024px) 30vw, 50vw"
                className={i === 0 ? "col-span-2 aspect-[16/9] md:col-span-1 md:row-span-2 md:aspect-auto" : "aspect-[4/3]"}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Trailer types with real rate structure */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-bold"><T th="หางที่ให้เช่า" en="Trailers for rent" /></h2>
            <p className="mt-1 font-semibold text-reflect"><T th={rentalScope.th} en={rentalScope.en} /></p>
          </div>
          <Link href="/trailers" className="font-semibold text-grass underline">
            <T th="ดูหางทั้งหมด" en="See all trailers" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {db.trailerTypes.map((t) => (
            <Link
              key={t.id}
              href={`/trailers?type=${t.id}`}
              className="group flex flex-col rounded-xl border border-line bg-paper p-4 transition-colors hover:border-sign"
            >
              <Photo src={typePhoto(t.id)} alt={`${t.name} · ${t.english}`} className="aspect-[16/10]" />
              <h3 className="mt-4 text-[21px] font-bold">
                <T th={t.name} en={`${typeNameEn[t.id] ?? t.english} trailer`} />{" "}
                <span className="font-route text-[15px] font-semibold text-ink-3">
                  <T th={typeNameEn[t.id] ?? t.english} en={t.name} />
                </span>
              </h3>
              <p className="mt-1 text-[15px] text-ink-2"><T th={t.use} en={typeUseEn[t.id] ?? t.use} /></p>
              <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
                <span className="text-[14px] text-ink-3">
                  <T th="ราคาเช่าเริ่มต้น" en="Rent from" />
                  {t.id !== "LOWBED" && (
                    <span className="block text-[12px] font-semibold text-reflect"><T th={minTermNote.shortTh} en={minTermNote.shortEn} /></span>
                  )}
                </span>
                <span className="font-route text-[24px] font-extrabold text-grass tabular">
                  {money(fromRate(t.id).amount)}
                  <span className="font-sans text-[13px] font-medium text-ink-3">{unit(fromRate(t.id).unit)}*</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-ink-3">
          <T
            th="* ราคายังไม่รวม VAT · หางพื้นเรียบและหางก้างปลา เป็นอัตราสำหรับสัญญาเช่าขั้นต่ำ 1 เดือน · หางโลว์เบดเป็นอัตรารายวัน"
            en="* Prices exclude VAT · flatbed and chassis rates are for a minimum 1-month contract · lowbed rates are per day"
          />
        </p>

        <h3 id="prices" className="mt-12 text-[22px] font-bold"><T th="ราคาเช่าเริ่มต้นตามรุ่น" en="Starting rent by model" /></h3>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[520px] text-left text-[15px]">
            <thead className="border-b-2 border-sign bg-sign-wash text-[13px] text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold"><T th="รุ่น" en="Model" /></th>
                <th scope="col" className="px-4 py-3 font-semibold"><T th="ราคาเช่าเริ่มต้น*" en="Rent from*" /></th>
                <th scope="col" className="px-4 py-3"><span className="sr-only"><T th="ขอราคา" en="Quote" /></span></th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const from = startingPrice(m.pricing);
                return (
                  <tr key={m.code} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      <Link href={`/trailers?type=${m.type}`} className="hover:text-grass hover:underline">
                        <T th={m.name} en={modelNameEn[m.code] ?? m.name} />
                      </Link>
                    </th>
                    <td className="px-4 py-3 font-route text-[18px] font-extrabold text-grass tabular">
                      {money(from.amount)}
                      <span className="font-sans text-[13px] font-medium text-ink-3">{unit(from.unit)}</span>
                      {m.pricing.plan === "MONTHLY_TIERED" && (
                        <span className="block font-sans text-[12px] font-semibold text-reflect"><T th={minTermNote.shortTh} en={minTermNote.shortEn} /></span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/quote?model=${m.code}`} className="whitespace-nowrap text-[14px] font-semibold text-reflect underline">
                        <T th="ขอราคา" en="Get a quote" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <RateConditions className="mt-5" />
      </section>

      {/* What every rental includes, and paid extras */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <RentalConditions className="mb-12" />
        <h2 className="text-[28px] font-bold"><T th="เช่ากับเรา ได้อะไรบ้าง" en="Included with every rental" /></h2>
        <p className="mt-1 text-ink-2"><T th="ฟรี ไม่มีค่าใช้จ่ายเพิ่ม" en="Free of charge" /></p>
        <div className="mt-7">
          <ServiceTerms />
        </div>
        <h3 className="mt-12 text-[22px] font-bold"><T th="บริการเสริม" en="Additional services" /></h3>
        <p className="mt-1 text-ink-2"><T th="มีค่าบริการ · ราคายังไม่รวม VAT" en="Charges apply · prices exclude VAT" /></p>
        <div className="mt-5">
          <ExtraServices />
        </div>
      </section>

      {/* The route: how renting works */}
      <section className="border-y border-line bg-sign-wash">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-[28px] font-bold"><T th="ขั้นตอนการเช่าหาง" en="How renting works" /></h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-5 md:gap-0">
            {steps.map((s, i) => (
              <li key={s.en} className="relative md:pr-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sign text-on-sign">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  {i < steps.length - 1 && <span aria-hidden className="hidden h-[3px] flex-1 bg-sign md:block" />}
                  {i < steps.length - 1 && (
                    <ArrowRight aria-hidden className="-ml-3 hidden size-5 text-grass md:block" strokeWidth={3} />
                  )}
                </div>
                <h3 className="mt-3 text-[17px] font-bold"><T th={s.th} en={s.en} /></h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2"><T th={s.bodyTh} en={s.bodyEn} /></p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Documents */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.4fr] lg:px-8">
        <div>
          <h2 className="text-[28px] font-bold"><T th="เอกสารประกอบการทำสัญญา" en="Contract documents" /></h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
            <T
              th="ทุกสัญญามีผู้ค้ำประกัน และต้องมีเอกสารของหัวลากกับคนขับที่จะมารับหาง ส่งให้เจ้าหน้าที่ทางอีเมลหรือ LINE หลังยืนยันใบเสนอราคา"
              en="Every contract has a guarantor and needs documents for the tractor and the driver who picks up. Send them to us by email or LINE once the quotation is confirmed."
            />
          </p>
          <LinkButton href="/documents" variant="outline" className="mt-6">
            <T th="ดูรายการเอกสารทั้งหมด" en="See all documents" />
          </LinkButton>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-paper p-5">
            <h3 className="font-bold"><T th="นิติบุคคล" en="Companies" /></h3>
            <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
              <li><T th="หนังสือรับรองบริษัท" en="Company certificate" /> <span className="text-ink-3"><T th="(ประทับตรา · ไม่เกิน 6 เดือน)" en="(company stamp · issued within 6 months)" /></span></li>
              <li><T th="ภ.พ.20" en="VAT registration (P.P.20)" /> <span className="text-ink-3"><T th="(ประทับตรา)" en="(company stamp)" /></span></li>
              <li>
                <T th="บัตรประชาชนและทะเบียนบ้านกรรมการผู้ค้ำ" en="Guarantor director's ID card and house registration" />{" "}
                <span className="text-ink-3"><T th="(เซ็นรับรอง ไม่ประทับตรา)" en="(signed, no stamp)" /></span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-paper p-5">
            <h3 className="font-bold"><T th="บุคคลธรรมดา" en="Individuals" /></h3>
            <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
              <li><T th="บัตรประชาชนและทะเบียนบ้านผู้เช่า" en="Renter's ID card and house registration" /></li>
              <li><T th="บัตรประชาชนและทะเบียนบ้านผู้ค้ำประกัน" en="Guarantor's ID card and house registration" /></li>
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-paper p-5 sm:col-span-2">
            <h3 className="font-bold"><T th="ทุกสัญญา" en="Every contract" /></h3>
            <p className="mt-2 text-[15px] text-ink-2">
              <T
                th="สำเนาหน้าเล่มทะเบียนหัวลาก · สำเนากรมธรรม์หัวลาก · สำเนาใบขับขี่คนขับหัวลาก · สำเนาบัตรประชาชนคนขับหัวลาก"
                en="Tractor registration book · Tractor insurance policy · Driver's licence · Driver's ID card"
              />
            </p>
          </div>
        </div>
      </section>

      {/* Weekly know-how articles */}
      {latest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-bold"><T th="สาระน่ารู้เรื่องหางเทรลเลอร์" en="Trailer know-how" /></h2>
              <p className="mt-1 text-ink-2"><T th="บทความใหม่ทุกสัปดาห์ เรื่องหางพื้นเรียบ ก้างปลา และโลว์เบด" en="New every week: flatbed, chassis and lowbed trailers" /></p>
            </div>
            <Link href="/knowledge" className="font-semibold text-grass underline">
              <T th="ดูบทความทั้งหมด" en="All articles" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {latest.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* Closing call to action */}
      <section className="bg-sign-deep text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:px-8">
          <div>
            <h2 className="text-[28px] font-bold sm:text-[34px]">
              <T th="ต้องการเช่าหางเทรลเลอร์? ขอใบเสนอราคาได้เลย" en="Need trailers? Ask us for a quotation" />
            </h2>
            <p className="mt-2 max-w-xl text-[16px] text-sign-ink">
              <T
                th="แจ้งรุ่น จำนวน และระยะเวลาเช่า เจ้าหน้าที่จะติดต่อกลับพร้อมราคาและหางที่ว่าง ไม่มีค่าใช้จ่าย"
                en="Tell us the model, quantity and rental length; we'll come back with prices and availability. Free of charge."
              />
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/quote" className={cx(buttonClass("primary", "lg"), "h-13 px-7 text-[17px]")}>
                <FileText className="size-5" aria-hidden /> <T th="ขอใบเสนอราคา" en="Request a quotation" />
              </Link>
              <a href={telHref(company.phone)} className="inline-flex h-13 items-center gap-2 rounded-lg border-2 border-white px-6 text-[17px] font-semibold hover:bg-white/15">
                <Phone className="size-5" aria-hidden /> <span className="font-route font-extrabold tabular">{company.phone}</span>
              </a>
            </div>
          </div>
          <div className="flex items-center gap-5 lg:justify-end">
            <Image src={LINE_QR} alt="QR Code LINE FAR Service" width={140} height={140} className="rounded-lg bg-white p-1.5" />
            <p className="flex items-center gap-2 text-[16px] font-semibold">
              <LineIcon className="size-8 shrink-0" />
              <T th="หรือสแกนแชทกับเราทาง LINE" en="Or scan to chat on LINE" />
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
