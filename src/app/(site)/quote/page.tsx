import { Suspense } from "react";
import type { Metadata } from "next";
import { FileText, Phone } from "lucide-react";
import { LineIcon } from "@/components/brand-icons";
import { PageFallback } from "@/components/page-fallback";
import { QuoteForm } from "@/components/quote-form";
import { RentalConditions } from "@/components/rental-conditions";
import { T } from "@/components/t";
import { LINE_QR, telHref } from "@/lib/company";
import { getReference } from "@/lib/data/reference";
import { searchOptions } from "@/lib/search-options";
import Image from "next/image";

export const metadata: Metadata = { title: "ขอใบเสนอราคา · Request a quotation" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default function QuotePage(props: PageProps<"/quote">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <QuoteContent {...props} />
    </Suspense>
  );
}

async function QuoteContent({ searchParams }: PageProps<"/quote">) {
  const [{ yards, company: c }, sp] = await Promise.all([getReference(), searchParams]);
  const asked = one(sp.model);
  // ?model= takes a search option id or a model code (LB2-2S, LB3-SPO …)
  const model = searchOptions.find((o) => o.id === asked || o.models.includes(asked ?? ""))?.id;
  const months = Number(one(sp.months)) || undefined;
  const trailer = one(sp.trailer);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-[32px] font-bold"><T th="ขอใบเสนอราคา" en="Request a quotation" /></h1>
      <p className="mt-2 max-w-2xl text-[16px] text-ink-2">
        <T
          th="บอกรุ่นหาง จำนวน และระยะเวลาเช่าที่ต้องการ เจ้าหน้าที่จะติดต่อกลับพร้อมใบเสนอราคา หางที่ว่าง และขั้นตอนทำสัญญา"
          en="Tell us the trailer model, quantity and rental length. We will contact you with a quotation, availability and the contract steps."
        />
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <QuoteForm
          options={searchOptions.map((o) => ({ id: o.id, label: o.th, type: o.type }))}
          yards={yards.map((y) => ({ id: y.id, label: `ลาน${y.short}` }))}
          initial={{ model, months, tyres: one(sp.tyres) === "1", note: trailer ? `สนใจหางทะเบียน/รหัส ${trailer}` : undefined }}
        />
        <aside className="space-y-5">
          <div className="rounded-xl border-2 border-sign bg-paper p-5">
            <p className="font-bold"><T th="ต้องการคุยกับเจ้าหน้าที่เลย?" en="Rather talk to us now?" /></p>
            <a href={telHref(c.phone)} className="mt-3 flex items-center gap-3 rounded-lg bg-reflect px-4 py-3 text-white hover:bg-reflect-hover">
              <Phone className="size-5" aria-hidden />
              <span className="font-route text-[22px] font-extrabold tabular">{c.phone}</span>
            </a>
            <div className="mt-4 flex items-center gap-4">
              <Image src={LINE_QR} alt="QR Code LINE FAR Service" width={112} height={112} className="rounded-md border border-line" />
              <p className="flex items-center gap-2 text-[15px] text-ink-2">
                <LineIcon className="size-7 shrink-0" />
                <T th="สแกนเพื่อแชททาง LINE" en="Scan to chat on LINE" />
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-sign-wash p-5 text-[15px] text-ink-2">
            <p className="flex items-center gap-2 font-bold text-ink">
              <FileText className="size-5 text-grass" aria-hidden />
              <T th="หลังได้รับใบเสนอราคา" en="After the quotation" />
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li><T th="ยืนยันรุ่นหาง จำนวน และวันรับหาง" en="Confirm models, quantity and pickup date" /></li>
              <li><T th="ส่งเอกสารประกอบสัญญาให้เจ้าหน้าที่" en="Send the contract documents" /></li>
              <li><T th="ชำระเงินค้ำประกัน + ค่าเช่าเดือนแรก (+ ค่าใส่ยาง)" en="Pay the deposit + first month (+ tire fitting)" /></li>
              <li><T th="รับหางที่ลานตามนัด" en="Pick up at the yard" /></li>
            </ol>
          </div>
          <RentalConditions />
        </aside>
      </div>
    </div>
  );
}
