/** Paid extra services (prices exclude VAT). Super Admin edits them in settings; stored in settings.extra_services. */
export const extraServiceIcons = ["tyre", "wash", "parking", "repair", "truck", "other"] as const;
export type ExtraServiceIcon = (typeof extraServiceIcons)[number];

export const extraServiceIconLabel: Record<ExtraServiceIcon, string> = {
  tyre: "ยาง",
  wash: "ล้าง",
  parking: "ที่จอด",
  repair: "ซ่อม",
  truck: "ขนส่ง",
  other: "อื่น ๆ",
};

export type ExtraService = {
  id: string;
  icon: ExtraServiceIcon;
  th: string;
  en: string;
  priceTh: string;
  priceEn: string;
  noteTh: string;
  noteEn: string;
};

export const DEFAULT_EXTRA_SERVICES: ExtraService[] = [
  { id: "tyre", icon: "tyre", th: "บริการใส่ / ถอดยาง", en: "Tire mounting / removal", priceTh: "หางที่เช่ากับเรา 100 บาท/เส้น · หางภายนอก 300 บาท/เส้น", priceEn: "Our rental trailers THB 100/tire · Outside trailers THB 300/tire", noteTh: "หางที่เช่ากับเรา หรือหางภายนอก", noteEn: "Our rental trailers or outside trailers" },
  { id: "wash", icon: "wash", th: "บริการล้างหัวลากและหาง", en: "Tractor & trailer washing", priceTh: "1,000 บาท/คัน", priceEn: "THB 1,000 per unit", noteTh: "ล้างด้วยน้ำแรงดันสูง", noteEn: "High-pressure cleaning" },
  { id: "parking", icon: "parking", th: "บริการรับฝากจอด", en: "Parking & storage", priceTh: "รายวัน 200 บาท/วัน · รายเดือน 2,000 บาท/เดือน", priceEn: "Daily THB 200/day · Monthly THB 2,000/month", noteTh: "ฝากจอดที่ลานหนองใหญ่ อ.หนองใหญ่ จ.ชลบุรี · เข้า–ออกในเวลาทำการ · ไม่มีบริการเฝ้าดูแล", noteEn: "At the Nong Yai yard, Chonburi · in and out during business hours · no guarding" },
];

/** Cleans a saved list: keeps rows with a Thai name, fills missing fields. */
export function parseExtraServices(value: unknown): ExtraService[] | null {
  if (!Array.isArray(value)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return value
    .map((r: Record<string, unknown>, i) => ({
      id: str(r?.id) || `s${i + 1}`,
      icon: (extraServiceIcons as readonly string[]).includes(str(r?.icon)) ? (str(r?.icon) as ExtraServiceIcon) : "other",
      th: str(r?.th),
      en: str(r?.en),
      priceTh: str(r?.priceTh),
      priceEn: str(r?.priceEn),
      noteTh: str(r?.noteTh),
      noteEn: str(r?.noteEn),
    }))
    .filter((r) => r.th);
}
