import Image from "next/image";
import { photoSlots, type PhotoSlot } from "@/lib/handover";
import { cx } from "./ui";

/** Black-and-white example drawing showing staff what each hand-over / return photo should look like. */
export function SlotGuide({ slot, className }: { slot: PhotoSlot; className?: string }) {
  const s = photoSlots.find((x) => x.id === slot)!;
  return (
    <div className={cx("relative bg-white", className)}>
      <Image src={`/handover-guides/${s.guide}.webp`} alt={`ภาพตัวอย่าง: ${s.label}`} fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-contain p-1.5" />
    </div>
  );
}
