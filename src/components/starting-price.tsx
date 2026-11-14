import Link from "next/link";
import { FileText } from "lucide-react";
import { money } from "@/lib/format";
import { minTermNote, startingPrice } from "@/lib/pricing";
import type { Trailer } from "@/lib/types";
import { T } from "./t";
import { buttonClass, cx } from "./ui";

/** Public price box: the starting rent only; everything else comes with the quotation. */
export function StartingPrice({ trailer }: { trailer: Trailer }) {
  const from = startingPrice(trailer.pricing);
  return (
    <div className="rounded-xl border-2 border-sign bg-paper p-5">
      <p className="text-[14px] text-ink-3"><T th="ราคาเช่าเริ่มต้น" en="Rent from" /></p>
      <p className="font-route text-[38px] font-extrabold leading-tight text-grass tabular">
        {money(from.amount)}
        <span className="font-sans text-[16px] font-medium text-ink-3">
          <T th={from.unit} en={from.unit === "/วัน" ? "/day" : "/month"} />
        </span>
      </p>
      {trailer.pricing.plan === "MONTHLY_TIERED" && (
        <p className="mt-2 rounded-lg bg-reflect-tint px-3 py-2 text-[14px] font-semibold text-reflect">
          <T th={minTermNote.th} en={minTermNote.en} />
          <span className="mt-0.5 block font-normal text-ink-2">
            <T th="เช่าระยะยาวหรือหลายคัน สอบถามอัตราพิเศษได้" en="Long-term or multi-unit? Ask about special rates." />
          </span>
        </p>
      )}
      <p className="mt-2 text-[13px] text-ink-3">
        <T
          th="ยังไม่รวม VAT · ราคาจริงขึ้นกับจำนวนและระยะเวลาเช่า ตามใบเสนอราคา"
          en="Excluding VAT · the actual price depends on quantity and rental length, per our quotation"
        />
      </p>
      {trailer.status === "RENTED" && (
        <p className="mt-4 rounded-lg bg-warn-tint px-4 py-3 text-[14px] font-semibold text-warn">
          <T th="คันนี้มีผู้เช่าอยู่ ขอใบเสนอราคาได้ เจ้าหน้าที่จะแนะนำคันอื่นในรุ่นเดียวกัน" en="This one is on rent — ask for a quote and we'll offer another of the same model" />
        </p>
      )}
      <Link
        href={`/quote?model=${trailer.model.code}&trailer=${encodeURIComponent(`${trailer.code} (${trailer.plate})`)}`}
        className={cx(buttonClass("primary", "lg"), "mt-5 w-full")}
      >
        <FileText className="size-5" aria-hidden />
        <T th="ขอใบเสนอราคาหางรุ่นนี้" en="Request a quotation" />
      </Link>
    </div>
  );
}
