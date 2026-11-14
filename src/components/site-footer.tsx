import Image from "next/image";
import Link from "next/link";
import { getReference } from "@/lib/data/reference";
import { telHref } from "@/lib/company";
import { hoursEn, yardEn } from "@/lib/i18n";
import { T } from "./t";
import { YardShield } from "./ui";
import { Suspense } from "react";
import { SchemaVersionLine } from "./schema-version";

/** Compact footer: same green and white keyline as the header. */
export async function SiteFooter() {
  const ref = await getReference();
  const c = ref.company;
  return (
    <footer className="on-sign mt-auto border-t-[3px] border-sign bg-sign text-[14px] text-on-sign">
      <div className="border-t-4 border-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start gap-x-10 gap-y-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-start gap-3">
            <span className="shrink-0 rounded-md bg-white px-1.5 py-1">
              <Image src="/brand/far-logo.png" alt="FAR Service" width={1063} height={591} className="h-7 w-auto" />
            </span>
            <p className="leading-snug">
              <span className="font-bold">
                <T th={c.nameTh} en={c.nameEn} />
              </span>
              <br />
              <a href={telHref(c.phone)} className="font-route font-bold hover:underline">{c.phone}</a>
              {" · "}
              <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
              {" · "}
              <a href={c.facebookUrl} target="_blank" rel="noreferrer" className="font-semibold hover:underline">Facebook</a>
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            {ref.yards.map((y) => (
              <li key={y.id} className="flex items-center gap-2">
                <YardShield n={y.number} size={24} />
                <span className="leading-snug">
                  <span className="font-bold">
                    <T th={`ลาน${y.short}`} en={`${yardEn[y.id]?.short ?? y.short} Yard`} />
                  </span>{" "}
                  · <T th={y.hours} en={hoursEn(y.hours)} />
                  <br />
                  <a href={y.mapUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                    <T th="เปิดแผนที่" en="Open map" />
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-on-sign/20">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-x-5 gap-y-1 px-4 py-2 text-[12px] sm:px-6 lg:px-8">
            <span>© {ref.year} FAR Service · <T th={`เลขผู้เสียภาษี ${c.taxId}`} en={`Tax ID ${c.taxId}`} /></span>
            <Link href="/terms" className="hover:underline"><T th="เงื่อนไขการเช่า" en="Rental terms" /></Link>
            <Link href="/privacy" className="hover:underline"><T th="นโยบายความเป็นส่วนตัว" en="Privacy policy" /></Link>
            <Link href="/quote" className="font-semibold hover:underline"><T th="ขอใบเสนอราคา" en="Request a quote" /></Link>
            <span className="ml-auto flex items-center gap-4 opacity-80">
              <Suspense fallback={null}>
                <SchemaVersionLine />
              </Suspense>
              <Link href="/login" className="hover:underline"><T th="สำหรับพนักงาน" en="Staff sign-in" /></Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
