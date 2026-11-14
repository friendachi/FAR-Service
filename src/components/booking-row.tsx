import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getReference, lookups } from "@/lib/data/reference";
import { bookingStatusLabel, bookingStatusTone, thDateShort } from "@/lib/format";
import { rentalDays } from "@/lib/pricing";
import type { Booking, Trailer } from "@/lib/types";
import { Badge, YardShield } from "./ui";

const nextAction: Partial<Record<Booking["status"], string>> = {
  NEED_MORE_DOCS: "ส่งเอกสารเพิ่ม",
  APPROVED_AWAITING_PAYMENT: "ชำระเงิน",
  READY_FOR_PICKUP: "ส่ง QR ให้คนขับ",
  IN_RENTAL: "แจ้งคืนก่อนกำหนด",
};

export async function BookingRow({ b, trailer: tr, href }: { b: Booking; trailer: Trailer; href: string }) {
  const ref = await getReference();
  const { getYard } = { ...ref, ...lookups(ref) };
  const py = getYard(b.pickupYard);
  const ry = getYard(b.returnYard);
  const act = nextAction[b.status];
  return (
    <li>
      <Link
        href={href}
        className="grid gap-3 rounded-xl border border-line bg-paper p-4 transition-colors hover:border-sign sm:grid-cols-[1fr_auto] sm:items-center sm:p-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-route text-[16px] font-extrabold text-ink">{b.no}</span>
            <Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge>
            {b.flagged && <Badge tone="danger">มีข้อโต้แย้ง</Badge>}
          </div>
          <p className="mt-1.5 text-[16px] font-semibold">
            {tr.model.name} · <span className="font-route">{tr.code}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-2">
            <YardShield n={py.number} size={18} /> {thDateShort(b.pickupAt)}
            <ArrowRight className="size-4 text-ink-3" aria-hidden />
            <YardShield n={ry.number} size={18} /> {thDateShort(b.returnAt)}
            <span className="text-ink-3">· {rentalDays(b.pickupAt, b.returnAt)} วัน</span>
          </p>
        </div>
        {act && (
          <span className="inline-flex h-10 items-center justify-center rounded-lg bg-reflect px-4 text-sm font-semibold text-sign-deep">
            {act}
          </span>
        )}
      </Link>
    </li>
  );
}
