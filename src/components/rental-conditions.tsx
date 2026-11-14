import { CircleAlert } from "lucide-react";
import { T } from "./t";

export const rentalScope = {
  th: "บริการให้เช่าหางเทรลเลอร์ (เฉพาะตัวหาง ไม่รวมยางและหัวลาก)",
  en: "Trailer rental service (trailer only, tires and tractor not included)",
};

export const rentalConditions: [string, string][] = [
  [
    "บริษัทฯ ให้เช่าเฉพาะตัวหางเทรลเลอร์เท่านั้น ไม่รวมยาง และไม่รวมรถหัวลาก",
    "We rent the trailer only. Tires and the tractor are not included.",
  ],
  [
    "ผู้เช่าจะต้องมีรถหัวลากและยางเป็นของตนเอง โดยยางต้องมีขนาดและสภาพที่เหมาะสมกับหางเทรลเลอร์",
    "You must have your own tractor and tires; the tires must be the right size and in suitable condition for the trailer.",
  ],
  [
    "บริษัทฯ เป็นผู้ดำเนินการติดตั้งยางในวันรับมอบ และถอดยางในวันส่งคืนหางเทรลเลอร์ โดยมีค่าบริการตามอัตราที่บริษัทฯ กำหนด",
    "We fit the tires on the day of handover and remove them on the day you return the trailer, at our published service rate.",
  ],
  [
    "ผู้เช่าจะต้องส่งคืนหางเทรลเลอร์ในสภาพเดิมตามที่ได้รับมอบ",
    "You must return the trailer in the same condition as it was handed over.",
  ],
];

const lowbedNote = {
  th: "หางโลว์เบดรวมยางในค่าเช่าแล้ว ไม่ต้องนำยางมาเอง",
  en: "Lowbed trailers come with tires included in the rent.",
};

/** The rental conditions box. `type` = a trailer type to show only what applies to it. */
export function RentalConditions({ type, className = "" }: { type?: string; className?: string }) {
  if (type === "LOWBED") {
    return (
      <div className={`rounded-xl border border-line bg-paper p-5 ${className}`}>
        <h2 className="text-[19px] font-bold"><T th="เงื่อนไขการเช่าหางเทรลเลอร์" en="Trailer rental conditions" /></h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
          <li><T th="ผู้เช่าจะต้องมีรถหัวลากเป็นของตนเอง" en="You must have your own tractor." /></li>
          <li><T th={lowbedNote.th} en={lowbedNote.en} /></li>
          <li><T th={rentalConditions[3][0]} en={rentalConditions[3][1]} /></li>
        </ul>
      </div>
    );
  }
  return (
    <div className={`rounded-xl border-2 border-sign bg-paper p-5 ${className}`}>
      <h2 className="flex items-center gap-2 text-[19px] font-bold">
        <CircleAlert className="size-5 shrink-0 text-reflect" aria-hidden />
        <T th="เงื่อนไขการเช่าหางเทรลเลอร์" en="Trailer rental conditions" />
      </h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
        {rentalConditions.map(([th, en]) => (
          <li key={en}><T th={th} en={en} /></li>
        ))}
      </ul>
      {!type && (
        <p className="mt-3 text-[13px] text-ink-3"><T th={`หมายเหตุ: ${lowbedNote.th}`} en={`Note: ${lowbedNote.en}`} /></p>
      )}
    </div>
  );
}
