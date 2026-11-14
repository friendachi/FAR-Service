import { CalendarRange, CircleDot, ClipboardCheck, Droplets, Landmark, Package, ParkingSquare, Truck, Wrench } from "lucide-react";
import Link from "next/link";
import { getReference } from "@/lib/data/reference";
import { PriceLines } from "./price-lines";
import type { ExtraServiceIcon } from "@/lib/extra-services";
import { T } from "./t";

type Term = {
  icon: typeof CalendarRange;
  th: string;
  en: string;
  bodyTh: string;
  bodyEn: string;
  /** Trailer types the term applies to (all when omitted). */
  only?: string[];
};

/** What every rental includes (free). Shown on the home page, trailer pages and the rental terms. */
export const serviceTerms: Term[] = [
  {
    icon: CalendarRange,
    only: ["FLATBED", "SKELETAL"],
    th: "พื้นเรียบและก้างปลา เช่าขั้นต่ำ 1 เดือน",
    en: "Flatbed and chassis: minimum 1 month",
    bodyTh: "หางพื้นเรียบและหางก้างปลาไม่มีเช่ารายวัน เริ่มต้นที่สัญญารายเดือน ยิ่งสัญญายาวเรทยิ่งถูก",
    bodyEn: "No daily rental for flatbed and chassis trailers. Contracts start monthly; longer terms get lower rates.",
  },
  {
    icon: CircleDot,
    only: ["FLATBED", "SKELETAL"],
    th: "นำยางมาให้ช่างเราใส่ก่อนรับหาง",
    en: "Bring your tires, our technicians fit them",
    bodyTh: "ค่าเช่าไม่รวมยาง ลูกค้านำยางมาลงที่ลาน ช่างของเราใส่ให้ก่อนรับหาง แนะนำให้นำยางมาลงก่อนวันรับหาง 1 วัน",
    bodyEn: "Tires are not included. Drop your tires at the yard and we fit them before pickup — ideally 1 day before.",
  },
  {
    icon: ClipboardCheck,
    th: "เช็คสภาพหางก่อนปล่อยเช่าทุกคัน",
    en: "Every trailer inspected before rental",
    bodyTh: "ทุกคันผ่านการตรวจสภาพที่ลานก่อนส่งมอบ และคนขับตรวจรับร่วมกับเจ้าหน้าที่",
    bodyEn: "Each trailer is inspected at the yard before handover, and your driver checks it with our staff.",
  },
  {
    icon: Wrench,
    th: "ดูแลช่วงล่างตลอดการใช้งาน ไม่มีค่าใช้จ่ายเพิ่ม",
    en: "Free suspension care for the whole rental",
    bodyTh: "ซ่อมและเปลี่ยนอะไหล่ช่วงล่างฟรีตลอดสัญญา (ยกเว้นอุบัติเหตุหรือใช้งานผิดวิธี) และตรวจสภาพฟรีทุก 6 เดือน",
    bodyEn: "Free suspension repair and parts throughout the contract (except accidents or misuse), plus a free inspection every 6 months.",
  },
  {
    icon: Landmark,
    th: "ภาษี พ.ร.บ. และใบอนุญาตประกอบการ ผู้ให้เช่ารับผิดชอบทั้งหมด",
    en: "Tax, CTPL insurance and licensing covered by us",
    bodyTh: "ลูกค้าไม่ต้องต่อภาษีหรือ พ.ร.บ. ของหางเอง",
    bodyEn: "Annual vehicle tax, compulsory insurance and registration are all paid by the lessor.",
  },
];

const extraIcon: Record<ExtraServiceIcon, typeof CircleDot> = {
  tyre: CircleDot,
  wash: Droplets,
  parking: ParkingSquare,
  repair: Wrench,
  truck: Truck,
  other: Package,
};

/** `type` limits the list to terms that apply to that trailer type (all terms when omitted). */
export function ServiceTerms({ compact = false, type }: { compact?: boolean; type?: string }) {
  return (
    <ul className={compact ? "space-y-3" : "grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"}>
      {serviceTerms
        .filter((t) => !type || !t.only || t.only.includes(type))
        .map((t) => (
          <li key={t.en} className="flex gap-3">
            <span
              className={`flex shrink-0 items-center justify-center rounded-lg bg-sign text-on-sign ${compact ? "size-8" : "size-10"}`}
            >
              <t.icon className={compact ? "size-4" : "size-5"} aria-hidden />
            </span>
            <span>
              <span className={`block font-bold ${compact ? "text-[15px]" : "text-[17px]"}`}>
                <T th={t.th} en={t.en} />
              </span>
              <span className={`mt-0.5 block leading-relaxed text-ink-2 ${compact ? "text-[14px]" : "text-[15px]"}`}>
                <T th={t.bodyTh} en={t.bodyEn} />
              </span>
            </span>
          </li>
        ))}
    </ul>
  );
}

/** Paid extra services, as edited by Super Admin in settings. */
export async function ExtraServices() {
  const { extraServices } = await getReference();
  if (!extraServices.length) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {extraServices.map((s) => {
        const Icon = extraIcon[s.icon];
        return (
        <li key={s.id} className="flex gap-3 rounded-xl border border-line bg-paper p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sign-wash text-grass">
            <Icon className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block font-bold"><T th={s.th} en={s.en || s.th} /></span>
            <PriceLines th={s.priceTh} en={s.priceEn} />
            {(s.noteTh || s.noteEn) && (
              <span className="block text-[14px] text-ink-3"><T th={s.noteTh} en={s.noteEn || s.noteTh} /></span>
            )}
            {["tyre", "wash", "parking"].includes(s.id) && (
              <Link href={`/services?s=${s.id}`} className="mt-2 inline-block text-[14px] font-semibold text-grass underline">
                <T th="ขอใช้บริการนี้" en="Request this service" />
              </Link>
            )}
          </span>
        </li>
        );
      })}
    </ul>
  );
}
