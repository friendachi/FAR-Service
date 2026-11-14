import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ParkingSquare, Truck, User } from "lucide-react";
import { PARKING_YARD, parkingDisclaimer, parkingDocuments } from "@/lib/service-requests";
import { ParkingInfo } from "@/components/parking-info";
import { T } from "@/components/t";
import { getStore } from "@/lib/data/store";
import { docEn } from "@/lib/i18n";
import type { DocRequirement } from "@/lib/types";

export const metadata: Metadata = { title: "เอกสารที่ต้องใช้ · Documents" };

function List({ items }: { items: DocRequirement[] }) {
  return (
    <ol className="mt-4 divide-y divide-line">
      {items.map((r, i) => (
        <li key={r.key} className="flex gap-4 py-3.5">
          <span className="font-route text-[18px] font-extrabold text-grass">{i + 1}</span>
          <span>
            <span className="block font-semibold"><T th={r.label} en={docEn[r.key]?.label ?? r.label} /></span>
            <span className="text-[14px] text-ink-2">
              <T th={r.rule ?? "สำเนา 1 ชุด"} en={docEn[r.key]?.rule ?? "1 copy"} />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function DocumentsPage() {
  const db = await getStore();
  const company = db.docRequirements.filter((r) => r.appliesTo !== "ALL" && r.appliesTo.includes("COMPANY"));
  const person = db.docRequirements.filter((r) => r.appliesTo !== "ALL" && r.appliesTo.includes("PERSON"));
  const all = db.docRequirements.filter((r) => r.appliesTo === "ALL");
  const nongYai = db.yards.find((y) => y.id === PARKING_YARD);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold"><T th="เอกสารประกอบสัญญาเช่า" en="Rental contract documents" /></h1>
          <p className="mt-2 max-w-2xl text-[16px] text-ink-2">
            <T
              th="ทุกสัญญามีผู้ค้ำประกัน เตรียมเอกสารตามรายการนี้ แล้วส่งให้เจ้าหน้าที่เป็นไฟล์ JPG, PNG หรือ PDF ทางอีเมลหรือ LINE หลังยืนยันใบเสนอราคา"
              en="Every contract has a guarantor. Prepare the documents below and send them to us as JPG, PNG or PDF files by email or LINE once the quotation is confirmed."
            />
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-paper p-6">
          <h2 className="flex items-center gap-2 text-[20px] font-bold">
            <Building2 className="size-5 text-grass" aria-hidden />
            <T th="นิติบุคคล" en="Companies" />
          </h2>
          <List items={company} />
        </section>
        <section className="rounded-xl border border-line bg-paper p-6">
          <h2 className="flex items-center gap-2 text-[20px] font-bold">
            <User className="size-5 text-grass" aria-hidden />
            <T th="บุคคลธรรมดา" en="Individuals" />
          </h2>
          <List items={person} />
        </section>
        <section className="rounded-xl border-2 border-sign bg-paper p-6">
          <h2 className="flex items-center gap-2 text-[20px] font-bold">
            <Truck className="size-5 text-grass" aria-hidden />
            <T th="เพิ่มเติม ทุกสัญญา" en="Every contract, in addition" />
          </h2>
          <List items={all} />
          <p className="mt-3 text-[14px] text-ink-3">
            <T
              th="คนขับและหัวลากที่มารับหางต้องตรงกับเอกสารที่ส่ง เจ้าหน้าที่ลานจะตรวจก่อนส่งมอบ"
              en="The driver and tractor at pickup must match the documents sent; yard staff check before handover."
            />
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-paper p-6" aria-labelledby="parking-docs">
        <h2 id="parking-docs" className="flex items-center gap-2 text-[20px] font-bold">
          <ParkingSquare className="size-5 text-grass" aria-hidden />
          <T th="เอกสารสำหรับฝากจอด" en="Documents for parking" />
        </h2>
        <p className="mt-1 text-[14px] text-ink-3">
          <T th="บริการให้เช่าพื้นที่จอดรถเทรลเลอร์ รายวันและรายเดือน" en="Daily and monthly trailer parking space" />
        </p>
        <div className="mt-3">
          <ParkingInfo mapUrl={nongYai?.mapUrl} hours={nongYai?.hours} />
        </div>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">
          {parkingDocuments.map((d) => (
            <li key={d.en}><T th={d.th} en={d.en} /></li>
          ))}
        </ul>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-3">
          <strong><T th="หมายเหตุ: " en="Note: " /></strong>
          <T th={parkingDisclaimer.th} en={parkingDisclaimer.en} />
        </p>
        <Link href="/services?s=parking" className="mt-3 inline-block font-semibold text-grass underline">
          <T th="ขอใช้บริการฝากจอด" en="Request parking" />
        </Link>
      </section>
    </div>
  );
}
