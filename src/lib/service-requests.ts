/*
  Stand-alone services a customer can request without renting a trailer: tyre fitting, washing, parking.
  Rates are used for the estimate shown on the request form; staff confirm the final price.
*/

export type ServiceKind = "TYRE" | "WASH" | "PARKING";
export type ServiceStatus = "NEW" | "CONTACTED" | "DONE" | "CANCELLED";

export const SERVICE_RATES = {
  /** per tyre, trailer rented from FAR */
  tyreOwn: 100,
  /** per tyre, an outside trailer */
  tyreOutside: 300,
  /** per unit (tractor or trailer) */
  wash: 1000,
  parkingDay: 200,
  parkingMonth: 2000,
} as const;

export const serviceKinds: { id: ServiceKind; slug: string; th: string; en: string; priceTh: string; priceEn: string }[] = [
  {
    id: "TYRE",
    slug: "tyre",
    th: "ใส่ / ถอดยาง",
    en: "Tire mounting / removal",
    priceTh: "หางที่เช่ากับเรา 100 บาท/เส้น · หางภายนอก 300 บาท/เส้น",
    priceEn: "Our rental trailers THB 100/tire · Outside trailers THB 300/tire",
  },
  {
    id: "WASH",
    slug: "wash",
    th: "ล้างทำความสะอาดหัวลาก / หางลาก",
    en: "Tractor / trailer washing",
    priceTh: "1,000 บาท/คัน",
    priceEn: "THB 1,000 per unit",
  },
  {
    id: "PARKING",
    slug: "parking",
    th: "ฝากจอดรถเทรลเลอร์",
    en: "Trailer parking",
    priceTh: "รายวัน 200 บาท/วัน · รายเดือน 2,000 บาท/เดือน",
    priceEn: "Daily THB 200/day · Monthly THB 2,000/month",
  },
];

export const serviceStatusLabel: Record<ServiceStatus, string> = {
  NEW: "คำขอใหม่",
  CONTACTED: "ติดต่อลูกค้าแล้ว",
  DONE: "ให้บริการแล้ว",
  CANCELLED: "ยกเลิก",
};

export const parkingDocuments = [
  { th: "สำเนาหน้าเล่มทะเบียนหัวลาก / หางลาก 1 ชุด", en: "Copy of the tractor / trailer registration book (1 set)" },
  { th: "สำเนาบัตรประชาชนเจ้าของกรรมสิทธิ์ 1 ชุด", en: "Copy of the owner's ID card (1 set)" },
  { th: "สำเนาใบขับขี่เจ้าของกรรมสิทธิ์ 1 ชุด", en: "Copy of the owner's driving licence (1 set)" },
];

/** Parking is only at yard 2 (Nong Yai); yard 1 (Si Racha) has no parking service. */
export const PARKING_YARD = "NY";

export const parkingPlace = {
  th: "ฝากจอดที่ลานหนองใหญ่ ต.หนองใหญ่ อ.หนองใหญ่ จ.ชลบุรี",
  en: "Parking at the Nong Yai yard, Nong Yai, Chonburi",
  noteTh: "ไม่มีบริการฝากจอดที่ลาน 1 (บางพระ อ.ศรีราชา จ.ชลบุรี)",
  noteEn: "No parking service at yard 1 (Bang Phra, Si Racha, Chonburi)",
};

export const parkingHours = {
  th: "เวลาเข้าฝากจอดและเวลารับรถออก ต้องอยู่ในช่วงเวลาทำการของลานเท่านั้น",
  en: "Drop-off and pickup must be within the yard's business hours.",
};

export const parkingDisclaimer = {
  th: "บริการนี้เป็นการให้เช่าพื้นที่จอดเท่านั้น ทางเราไม่มีบริการรักษาความปลอดภัย เฝ้าดูแล หรือรับผิดชอบต่อความสูญหายหรือเสียหายของรถ ทรัพย์สิน และสิ่งของภายในรถทุกกรณี ผู้เช่าควรล็อกรถและทำประกันภัยด้วยตนเอง",
  en: "This service rents parking space only. We provide no security or guarding and accept no responsibility for loss of or damage to vehicles, property or items inside them in any case. Please lock your vehicle and arrange your own insurance.",
};

export type ServiceDetails = {
  /** TYRE: whose trailer */
  source?: "OWN" | "OUTSIDE";
  tyres?: number;
  /** WASH / PARKING: number of tractors or trailers */
  units?: number;
  /** PARKING */
  plan?: "DAILY" | "MONTHLY";
  length?: number;
  plate?: string;
};

/** Estimated price in baht before VAT. */
export function serviceEstimate(kind: ServiceKind, d: ServiceDetails) {
  const n = (v: number | undefined) => Math.max(0, Math.floor(v ?? 0));
  if (kind === "TYRE") return n(d.tyres) * (d.source === "OUTSIDE" ? SERVICE_RATES.tyreOutside : SERVICE_RATES.tyreOwn);
  if (kind === "WASH") return n(d.units) * SERVICE_RATES.wash;
  return n(d.units) * n(d.length) * (d.plan === "MONTHLY" ? SERVICE_RATES.parkingMonth : SERVICE_RATES.parkingDay);
}

/** One-line Thai summary for staff lists and the fallback contact message. */
export function serviceSummary(kind: ServiceKind, d: ServiceDetails) {
  if (kind === "TYRE") return `ใส่/ถอดยาง ${d.tyres ?? 0} เส้น · ${d.source === "OUTSIDE" ? "หางภายนอก" : "หางที่เช่ากับ FAR"}`;
  if (kind === "WASH") return `ล้างหัวลาก/หางลาก ${d.units ?? 0} คัน`;
  return `ฝากจอด ${d.units ?? 0} คัน · ${d.length ?? 0} ${d.plan === "MONTHLY" ? "เดือน" : "วัน"}`;
}
