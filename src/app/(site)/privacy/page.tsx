import type { Metadata } from "next";
import { T } from "@/components/t";

export const metadata: Metadata = { title: "นโยบายความเป็นส่วนตัว · Privacy" };

const parts: [string, string][] = [
  [
    "เราเก็บเอกสารของผู้เช่า ผู้ค้ำประกัน หัวลาก และคนขับ เพื่อทำสัญญาเช่าและตรวจตัวตนตอนรับหางเท่านั้น",
    "We keep renter, guarantor, tractor and driver documents only to make the rental contract and to check identity at pickup.",
  ],
  [
    "เอกสารเข้าถึงได้เฉพาะเจ้าของบัญชี ฝ่ายขาย และผู้ดูแลระบบ เจ้าหน้าที่ลานเห็นเฉพาะใบขับขี่และทะเบียนหัวลากตอนเช็กอิน",
    "Documents are visible only to the account owner, sales and administrators. Yard staff see only the driver's licence and tractor plate at check-in.",
  ],
  [
    "ท่านขอดู แก้ไข หรือขอลบข้อมูลส่วนบุคคลได้ทุกเมื่อผ่านช่องทางติดต่อบริษัท",
    "You can ask to see, correct or delete your personal data at any time through our contact channels.",
  ],
];

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-[30px] font-bold"><T th="นโยบายความเป็นส่วนตัว" en="Privacy policy" /></h1>
      <p className="mt-2 text-ink-3"><T th="ร่าง · รอฝ่ายกฎหมายของบริษัทตรวจทานตาม PDPA" en="Draft · pending legal review under Thailand's PDPA" /></p>
      <div className="mt-8 space-y-4 text-[16px] leading-relaxed text-ink-2">
        {parts.map(([th, en]) => (
          <p key={en}><T th={th} en={en} /></p>
        ))}
      </div>
    </article>
  );
}
