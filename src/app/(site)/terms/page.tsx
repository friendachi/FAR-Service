import type { Metadata } from "next";
import { ExtraServices } from "@/components/service-terms";
import { T } from "@/components/t";
import { RentalConditions, rentalScope } from "@/components/rental-conditions";
import { RateConditions } from "@/components/rate-conditions";

export const metadata: Metadata = { title: "เงื่อนไขการเช่า · Rental terms" };

const terms: [string, string][] = [
  [
    "ให้เช่าเฉพาะหางเทรลเลอร์ ผู้เช่าใช้หัวลากและคนขับของตนเอง และต้องแจ้งทะเบียนหัวลากกับคนขับในการทำสัญญาทุกครั้ง",
    "We rent trailers only. You use your own tractor and driver and give their details with every contract.",
  ],
  [
    "รับและคืนหางที่ลานจอดบางพระหรือหนองใหญ่เท่านั้น คืนต่างลานได้ไม่มีค่าใช้จ่าย",
    "Pick up and return only at the Bang Phra or Nong Yai yard. Returning to the other yard is free.",
  ],
  [
    "หางพื้นเรียบและหางก้างปลาไม่มีเช่ารายวัน อัตราค่าเช่าเป็นอัตราสำหรับสัญญาเช่าขั้นต่ำ 1 เดือน ไม่รวมยาง สัญญาเช่าระยะยาวหรือเช่าหลายคัน บริษัทฯ ยินดีพิจารณาอัตราพิเศษ หางโลว์เบดรวมยาง เช่ารายวัน รายสัปดาห์ หรือรายเดือนได้ ราคายังไม่รวม VAT",
    "Flatbed and chassis trailers have no daily rental; rates are for a minimum 1-month contract, tires not included. We consider special rates for long-term contracts or several units. Lowbeds include tires and rent by the day, week or month. Prices exclude VAT.",
  ],
  [
    "หางพื้นเรียบและหางก้างปลา ผู้เช่านำยางมาลงที่ลานให้ช่างของผู้ให้เช่าใส่ก่อนรับหาง (100 บาท/เส้น) แนะนำให้นำยางมาลงก่อนวันรับหาง 1 วัน",
    "For flatbed and chassis trailers, bring your tires to the yard and our technicians fit them before pickup (THB 100 per tire), ideally 1 day before.",
  ],
  [
    "ผู้ให้เช่าเช็คสภาพหางก่อนปล่อยเช่าทุกคัน ดูแล ซ่อม และเปลี่ยนอะไหล่ช่วงล่างตลอดการใช้งานโดยไม่มีค่าใช้จ่าย (ยกเว้นอุบัติเหตุหรือใช้งานผิดวิธี) และตรวจสภาพฟรีทุก 6 เดือน",
    "Every trailer is inspected before rental. Suspension maintenance, repair and parts are free for the whole rental (except accidents or misuse), with a free inspection every 6 months.",
  ],
  [
    "ภาษีประจำปี พ.ร.บ. และใบอนุญาตประกอบการของหาง ผู้ให้เช่าเป็นผู้รับผิดชอบทั้งหมด",
    "Annual vehicle tax, compulsory insurance (CTPL) and registration/licensing are paid by the lessor.",
  ],
  [
    "ไม่ว่าจะเช่ากี่เดือน ชำระครั้งแรกก่อนรับหาง: เงินค้ำประกัน (หางพื้นเรียบและหางก้างปลา 20,000 บาท/หาง หางโลว์เบด 30,000 บาท/หาง คืนเมื่อปิดงาน หักได้หากมีความเสียหาย) ค่าเช่าเดือนแรก และค่าบริการใส่ยาง (กรณีใส่ยาง) พร้อม VAT",
    "However many months you rent, the first payment before pickup is the refundable deposit (flatbed and chassis THB 20,000, lowbed THB 30,000 per unit, returned when the rental closes, less any damage), the first month's rent and tire fitting if used, plus VAT.",
  ],
  [
    "จากนั้นชำระค่าเช่ารายเดือนทุกเดือน ตามวันที่รับหาง จนครบสัญญาเช่า",
    "After that, the rent is paid every month on the pickup date until the contract ends.",
  ],
  [
    "หลังชำระเงิน เจ้าหน้าที่จะตรวจสอบและติดต่อกลับตามเบอร์โทรและข้อมูลติดต่อที่ลูกค้าให้ไว้ เพื่อยืนยันการจองและนัดวันรับหาง",
    "After you pay, our staff check the payment and contact you on the phone number and details you gave to confirm the booking and pickup.",
  ],
  [
    "ราคาเป็นไปตามใบเสนอราคาที่เจ้าหน้าที่ออกให้ ชำระด้วยการโอนเงินหรือ PromptPay ตามใบแจ้งหนี้ ไม่รับบัตรเครดิต",
    "Prices follow the quotation we issue. Pay by bank transfer or PromptPay against our invoice. Credit cards are not accepted.",
  ],
  [
    "ยกเลิกก่อนวันรับหางมีค่าธรรมเนียมยกเลิก ยกเลิกสัญญาระหว่างเช่าคิดราคาตามเรทและระยะเวลาเช่าจริง",
    "Cancelling before pickup has a fee. Ending a contract early is re-priced on the actual rental days at the matching rate.",
  ],
];

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-[30px] font-bold"><T th="เงื่อนไขการเช่า" en="Rental terms" /></h1>
      <p className="mt-2 text-ink-3"><T th="ร่างสรุป · รอฝ่ายกฎหมายของบริษัทตรวจทาน" en="Summary draft · pending legal review" /></p>
      <p className="mt-6 text-[18px] font-bold text-reflect"><T th={rentalScope.th} en={rentalScope.en} /></p>
      <RentalConditions className="mt-4" />
      <RateConditions className="mt-4" />
      <ol className="mt-8 list-decimal space-y-4 pl-5 text-[16px] leading-relaxed text-ink-2">
        {terms.map(([th, en]) => (
          <li key={en}><T th={th} en={en} /></li>
        ))}
      </ol>
      <h2 className="mt-10 text-[22px] font-bold"><T th="บริการเสริม (มีค่าบริการ)" en="Additional services (charges apply)" /></h2>
      <div className="mt-4">
        <ExtraServices />
      </div>
    </article>
  );
}
