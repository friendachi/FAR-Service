import type { Metadata } from "next";
import Image from "next/image";
import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/auth-forms";
import { T } from "@/components/t";
import { YardShield } from "@/components/ui";
import { LINE_QR, telHref } from "@/lib/company";
import { getReference } from "@/lib/data/reference";
import { hoursEn, yardEn } from "@/lib/i18n";

export const metadata: Metadata = { title: "ติดต่อเรา · Contact" };

export default async function ContactPage() {
  const { yards, company: c } = await getReference();
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:px-8">
      <section>
        <h1 className="text-[30px] font-bold"><T th="ติดต่อเรา" en="Contact us" /></h1>
        <p className="mt-2 text-ink-2">
          <T
            th="สอบถามหางว่าง ราคา เอกสาร หรือขอใบเสนอราคาทางโทรศัพท์และ LINE"
            en="Ask about available trailers or documents, or have our staff book for you by phone."
          />
        </p>
        <a
          href={telHref(c.phone)}
          className="mt-6 flex items-center gap-4 rounded-xl border-2 border-sign bg-paper p-4 hover:bg-sign-wash"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-sign text-on-sign">
            <Phone className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-[14px] text-ink-3"><T th="โทรสอบถามและขอใบเสนอราคา" en="Call to ask or get a quote" /></span>
            <span className="font-route text-[26px] font-extrabold tabular text-grass">{c.phone}</span>
          </span>
        </a>
        <ul className="mt-6 space-y-5">
          {yards.map((y) => (
            <li key={y.id}>
              <a
                href={y.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex gap-3 rounded-lg p-2 -m-2 hover:bg-sign-wash"
                aria-label={`${y.name} · เปิด Google Maps`}
              >
                <YardShield n={y.number} size={32} />
                <span className="text-[15px]">
                  <span className="flex items-center gap-1.5 font-bold text-grass underline-offset-2 group-hover:underline">
                    <T th={y.name} en={yardEn[y.id]?.name ?? y.name} />
                    <MapPin className="size-4 shrink-0" aria-hidden />
                  </span>
                  <T th={`${y.address} · ${y.hours}`} en={`${yardEn[y.id]?.address ?? y.address} · ${hoursEn(y.hours)}`} />
                  <span className="block text-[13px] font-semibold text-reflect"><T th="เปิด Google Maps" en="Open in Google Maps" /></span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3 text-[15px]">
            <a href={`mailto:${c.email}`} className="flex items-center gap-2 font-semibold text-grass hover:underline">
              <Mail className="size-4" aria-hidden /> {c.email}
            </a>
            <a href={c.facebookUrl} target="_blank" rel="noreferrer" className="block font-semibold text-grass hover:underline">
              Facebook: {c.facebook}
            </a>
          </div>
          <figure className="w-36 text-center">
            <Image src={LINE_QR} alt="QR Code LINE Official · FAR Service" width={540} height={540} className="rounded-lg border border-line" />
            <figcaption className="mt-1 text-[13px] text-ink-3">
              <T th="สแกนเพิ่มเพื่อน LINE Official" en="Scan to add our LINE Official" />
            </figcaption>
          </figure>
        </div>
        <section className="mt-8 rounded-xl border border-line bg-paper p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Building2 className="size-5 text-grass" aria-hidden /> <T th="ข้อมูลบริษัท" en="Company details" />
          </h2>
          <dl className="mt-3 space-y-1.5 text-[15px] text-ink-2">
            <div>
              <dt className="inline text-ink-3"><T th="ชื่อบริษัท: " en="Company: " /></dt>
              <dd className="inline">{c.nameTh}<br />{c.nameEn}</dd>
            </div>
            <div>
              <dt className="inline text-ink-3"><T th="เลขประจำตัวผู้เสียภาษี: " en="Tax ID: " /></dt>
              <dd className="inline tabular">{c.taxId}</dd>
            </div>
            <div>
              <dt className="inline text-ink-3"><T th="ที่อยู่: " en="Address: " /></dt>
              <dd className="inline"><T th={c.addressTh} en={c.addressEn} /></dd>
            </div>
          </dl>
        </section>
      </section>
      <ContactForm />
    </div>
  );
}
