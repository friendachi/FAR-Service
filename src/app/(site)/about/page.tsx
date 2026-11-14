import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ClipboardCheck, FileText, Landmark, Repeat, Wrench } from "lucide-react";
import { T } from "@/components/t";
import { Photo, YardShield, buttonClass, cx } from "@/components/ui";
import { getReference } from "@/lib/data/reference";
import { getStore } from "@/lib/data/store";
import { typeNameEn, typeUseEn, yardEn } from "@/lib/i18n";
import { typePhoto, workPhotos } from "@/lib/photos";

export const metadata: Metadata = { title: "เกี่ยวกับเรา · About FAR Service" };

/** Commitments taken from the rental terms (what every contract includes), not marketing claims. */
const reasons = [
  {
    icon: Repeat,
    th: "รับลานหนึ่ง คืนอีกลานได้ฟรี",
    en: "Return to either yard, free",
    bodyTh: "ลานบางพระ (ศรีราชา) และลานหนองใหญ่ คืนต่างลานไม่มีค่าใช้จ่าย",
    bodyEn: "Bang Phra (Si Racha) and Nong Yai yards; returning to the other yard costs nothing.",
  },
  {
    icon: Wrench,
    th: "ดูแลช่วงล่างตลอดสัญญา",
    en: "Suspension care for the whole term",
    bodyTh: "ซ่อมและเปลี่ยนอะไหล่ช่วงล่างฟรี (ยกเว้นอุบัติเหตุหรือใช้งานผิดวิธี) ตรวจสภาพฟรีทุก 6 เดือน",
    bodyEn: "Free suspension repair and parts (except accidents or misuse), free inspection every 6 months.",
  },
  {
    icon: ClipboardCheck,
    th: "ตรวจสภาพก่อนส่งมอบทุกคัน",
    en: "Every trailer inspected before handover",
    bodyTh: "ตรวจร่วมกับคนขับของลูกค้าที่ลาน พร้อมบันทึกภาพสภาพหาง",
    bodyEn: "Checked with your driver at the yard, with photos of the trailer's condition.",
  },
  {
    icon: Landmark,
    th: "ภาษี พ.ร.บ. และใบอนุญาต เราดูแลให้",
    en: "Tax, CTPL and licences covered",
    bodyTh: "ผู้ให้เช่ารับผิดชอบภาษีประจำปี พ.ร.บ. และใบอนุญาตประกอบการของหาง",
    bodyEn: "We pay the annual vehicle tax, compulsory insurance and the trailer's operating licence.",
  },
];

export default async function About() {
  const [{ company: c, yards }, db] = await Promise.all([getReference(), getStore()]);

  return (
    <div className="pb-4">
      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-8">
          <div>
            <h1 className="text-[32px] font-bold leading-tight sm:text-[40px]">
              <T th="เกี่ยวกับ FAR Service" en="About FAR Service" />
            </h1>
            <p className="mt-2 text-[18px] font-semibold text-reflect">
              <T th="ผู้ให้เช่าหางเทรลเลอร์ สำหรับบริษัทขนส่งและผู้ประกอบการรถบรรทุก" en="Semi-trailer rental for transport companies and truck operators" />
            </p>
            <div className="mt-5 text-[16px] leading-relaxed text-ink-2 [&_p+p]:mt-3">
              <div lang="th" className="i18n-th">{c.profileTh.split("\n").map((p) => <p key={p}>{p}</p>)}</div>
              <div lang="en" className="i18n-en">{c.profileEn.split("\n").map((p) => <p key={p}>{p}</p>)}</div>
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-xl border border-line bg-ground p-5 text-[15px] sm:grid-cols-[max-content_1fr]">
              <dt className="flex items-center gap-2 text-ink-3"><Building2 className="size-4" aria-hidden /><T th="ชื่อบริษัท" en="Company" /></dt>
              <dd className="font-semibold"><T th={c.nameTh} en={c.nameEn} /></dd>
              <dt className="text-ink-3"><T th="เลขประจำตัวผู้เสียภาษี" en="Tax ID" /></dt>
              <dd className="tabular">{c.taxId}</dd>
              <dt className="text-ink-3"><T th="ที่อยู่" en="Address" /></dt>
              <dd><T th={c.addressTh} en={c.addressEn} /></dd>
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {workPhotos.map((p, i) => (
              <Photo
                key={p.src}
                src={p.src}
                alt={p.alt}
                sizes="(min-width: 1024px) 25vw, 50vw"
                className={i === 0 ? "col-span-2 aspect-[16/9]" : "aspect-[4/3]"}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-[28px] font-bold"><T th="หางที่เรามีให้เช่า" en="What we rent" /></h2>
        <p className="mt-1 text-ink-2">
          <T th="หางพื้นเรียบ หางก้างปลา และหางโลว์เบด หลายรุ่นให้เลือกตามงาน" en="Flatbed, chassis and lowbed trailers in several models to suit the job" />
        </p>
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {db.trailerTypes.map((t) => (
            <Link key={t.id} href={`/trailers?type=${t.id}`} className="group rounded-xl border border-line bg-paper p-4 hover:border-sign">
              <Photo src={typePhoto(t.id)} alt={t.name} className="aspect-[16/10]" />
              <h3 className="mt-4 text-[20px] font-bold">
                <T th={t.name} en={`${typeNameEn[t.id] ?? t.english} trailer`} />
              </h3>
              <p className="mt-1 text-[15px] text-ink-2"><T th={t.use} en={typeUseEn[t.id] ?? t.use} /></p>
              <p className="mt-3 font-semibold text-grass">
                <T th="ดูหางรุ่นนี้" en="See these trailers" />{" "}
                <ArrowRight className="inline size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-sign-wash">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-[28px] font-bold"><T th="สิ่งที่ลูกค้าได้รับทุกสัญญา" en="What every contract includes" /></h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {reasons.map((r) => (
              <li key={r.en} className="rounded-xl border border-line bg-paper p-5">
                <span className="flex size-11 items-center justify-center rounded-lg bg-sign text-on-sign">
                  <r.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-[17px] font-bold"><T th={r.th} en={r.en} /></h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2"><T th={r.bodyTh} en={r.bodyEn} /></p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-[28px] font-bold"><T th="ลานจอดของเรา" en="Our yards" /></h2>
        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {yards.map((y) => (
            <li key={y.id} className="flex gap-4 rounded-xl border border-line bg-paper p-5">
              <YardShield n={y.number} size={44} />
              <div className="text-[15px]">
                <p className="text-[18px] font-bold"><T th={y.name} en={yardEn[y.id]?.name ?? y.name} /></p>
                <p className="text-ink-2"><T th={y.address} en={yardEn[y.id]?.address ?? y.address} /></p>
                <p className="text-ink-3">{y.hours}</p>
                <a href={y.mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-grass underline">
                  <T th="เปิดแผนที่" en="Open map" />
                </a>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-xl border-2 border-sign bg-paper p-6">
          <p className="min-w-0 flex-1 text-[18px] font-bold">
            <T th="สนใจเช่าหางกับเรา? ขอใบเสนอราคาได้ทันที" en="Interested? Ask for a quotation now" />
          </p>
          <Link href="/quote" className={cx(buttonClass("primary", "lg"))}>
            <FileText className="size-5" aria-hidden /> <T th="ขอใบเสนอราคา" en="Request a quotation" />
          </Link>
        </div>
      </section>
    </div>
  );
}
