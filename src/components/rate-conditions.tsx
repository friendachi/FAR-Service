import Image from "next/image";
import { Phone } from "lucide-react";
import { LINE_QR, telHref } from "@/lib/company";
import { getReference } from "@/lib/data/reference";
import { LineIcon } from "./brand-icons";
import { LineQrButton } from "./line-qr-button";
import { T } from "./t";
import { cx } from "./ui";

/**
 * Rental conditions for the flatbed and chassis rates (owner's wording): the rates are for a minimum 1-month
 * contract; special rates for long contracts or several units — ask by phone or LINE.
 */
export async function RateConditions({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { company: c } = await getReference();
  return (
    <section className={cx("rounded-xl border border-line bg-paper p-5", className)} aria-labelledby="rate-conditions">
      <h2 id="rate-conditions" className={compact ? "text-[16px] font-bold" : "text-[19px] font-bold"}>
        <T th="เงื่อนไขการเช่า" en="Rental conditions" />
        <span className="ml-2 text-[13px] font-semibold text-ink-3"><T th="หางพื้นเรียบ · หางก้างปลา" en="Flatbed · chassis" /></span>
      </h2>
      <p className={cx("mt-2 leading-relaxed text-ink-2", compact ? "text-[14px]" : "text-[15px]")}>
        <T
          th="อัตราค่าเช่าข้างต้นเป็นอัตราสำหรับสัญญาเช่าขั้นต่ำ 1 เดือน ทั้งนี้ บริษัทฯ ยินดีพิจารณาอัตราค่าเช่าพิเศษสำหรับลูกค้าที่ทำสัญญาเช่าระยะยาว หรือเช่าเป็นจำนวนหลายคัน"
          en="The rates above are for a minimum 1-month contract. We are happy to consider special rates for long-term contracts or for renting several trailers."
        />
      </p>
      <p className={cx("mt-3 font-semibold text-ink", compact ? "text-[14px]" : "text-[15px]")}>
        <T th="สอบถามรายละเอียดเพิ่มเติมได้ที่" en="For more details, contact us:" />
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <a href={telHref(c.phone)} className="inline-flex items-center gap-2 rounded-lg bg-reflect px-4 py-2 text-white hover:bg-reflect-hover">
          <Phone className="size-4" aria-hidden />
          <span className="font-route text-[17px] font-extrabold tabular">{c.phone}</span>
        </a>
        <LineQrButton className="inline-flex items-center gap-2 rounded-lg border-2 border-[#06c755] px-3 py-1.5 font-semibold text-[#05a648] hover:bg-[#06c755]/10">
          <LineIcon className="size-6" />
          LINE
        </LineQrButton>
        {!compact && (
          <Image src={LINE_QR} alt="QR Code LINE FAR Service" width={84} height={84} className="rounded-md border border-line" />
        )}
      </div>
    </section>
  );
}
