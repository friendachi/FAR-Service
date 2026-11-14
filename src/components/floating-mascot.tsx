"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Mascot, type MascotPose } from "./mascot";
import { T } from "./t";

type Line = { pose: MascotPose; th: string; en: string };

/** What น้องฟาร์ says on each page (first matching prefix wins). */
const lines: [string, Line][] = [
  ["/trailers/", { pose: "point", th: "สนใจรุ่นนี้ กดขอใบเสนอราคาได้เลยครับ", en: "Like this one? Ask us for a quotation!" }],
  ["/trailers", { pose: "point", th: "เลือกรุ่นหางที่สนใจ แล้วขอใบเสนอราคาได้เลยครับ", en: "Pick the model you like and ask for a quotation." }],
  ["/quote", { pose: "documents", th: "กรอกรุ่น จำนวน และระยะเช่า เดี๋ยวเจ้าหน้าที่ติดต่อกลับครับ", en: "Tell us the model, quantity and length — we'll call you back." }],
  ["/knowledge", { pose: "documents", th: "มีบทความใหม่ทุกสัปดาห์ แวะมาอ่านกันนะครับ", en: "New articles every week — come back for more!" }],
  ["/about", { pose: "wave", th: "ยินดีที่ได้รู้จักครับ เราดูแลหางให้ตลอดสัญญา", en: "Nice to meet you! We look after your trailer all term." }],
  ["/yards", { pose: "pin", th: "รับหางลานหนึ่ง คืนอีกลานได้ ไม่มีค่าใช้จ่ายครับ", en: "Pick up at one yard, return to the other, free." }],
  ["/services", { pose: "point", th: "ใส่ยาง ล้างรถ หรือฝากจอด ไม่ต้องเช่าหางก็ใช้บริการได้ครับ", en: "Tires, washing or parking, no rental needed." }],
  ["/documents", { pose: "documents", th: "เตรียมเอกสารให้ครบ ทำสัญญาได้ไวขึ้นครับ", en: "Have every document ready for a faster contract." }],
  ["/contact", { pose: "phone", th: "โทรหรือทัก LINE มาได้เลยครับ ยินดีให้คำแนะนำ", en: "Call or LINE us, happy to help." }],
  ["/login", { pose: "thumbs", th: "สำหรับพนักงานครับ ลูกค้าขอใบเสนอราคาได้ที่เมนูด้านบน", en: "Staff only — customers can request a quote from the menu." }],
  ["/terms", { pose: "documents", th: "สงสัยเรื่องเงื่อนไขตรงไหน โทรถามได้เลยครับ", en: "Questions about the terms? Just call us." }],
  ["/privacy", { pose: "documents", th: "ข้อมูลของคุณใช้เพื่อการติดต่อและการเช่าเท่านั้นครับ", en: "Your data is used for contact and rental only." }],
  ["/", { pose: "wave", th: "สวัสดีครับ ผมน้องฟาร์ ต้องการเช่าหาง ขอใบเสนอราคาได้เลยครับ", en: "Hi, I'm Far! Need trailers? Ask us for a quote." }],
];

const lineFor = (path: string) =>
  lines.find(([p]) => (p === "/" ? path === "/" : p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)))?.[1] ??
  lines[lines.length - 1][1];

const HIDE_KEY = "far-mascot-hidden";
const subscribe = () => () => {};
const readHidden = () => {
  try {
    return sessionStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
};


/**
 * น้องฟาร์ stands at the bottom-right corner (next to the LINE QR card) with a line that suits the page.
 * Hidden on phones; double-click hides him for the session.
 */
export function FloatingMascot({ festival }: { festival?: { th: string; en: string; pose?: MascotPose } | null }) {
  const path = usePathname();
  const base = lineFor(path);
  // on the home page น้องฟาร์ greets with this month's festival
  const said = path === "/" && festival ? { ...base, th: festival.th, en: festival.en } : base;
  // during a festival with a prop (Loy Krathong) น้องฟาร์ holds it on every page
  const line = festival?.pose ? { ...said, pose: festival.pose } : said;
  const savedHidden = useSyncExternalStore(subscribe, readHidden, () => false);
  const [hiddenNow, setHidden] = useState(false);
  const hidden = savedHidden || hiddenNow;
  // the bubble is closed only on the page where it was closed; a new page says its line again
  const [closedOn, setClosedOn] = useState<string | null>(null);
  const talking = closedOn !== path;
  const setTalking = (on: boolean) => setClosedOn(on ? null : path);

  if (hidden) return null;

  return (
    <div className="pointer-events-none relative hidden md:block">
      {talking && (
        <div className="pointer-events-auto absolute bottom-full right-2 mb-3 w-60 rounded-xl border-2 border-sign bg-paper px-4 py-3 text-[14px] font-semibold leading-snug text-ink shadow-[0_10px_28px_-14px_rgba(0,40,10,0.55)]">
          <span aria-hidden className="absolute -bottom-[9px] right-10 size-4 rotate-45 border-b-2 border-r-2 border-sign bg-paper" />
          <button
            type="button"
            onClick={() => setTalking(false)}
            aria-label="ปิดข้อความ · Close"
            className="absolute -left-2.5 -top-2.5 flex size-6 items-center justify-center rounded-full bg-ink text-white hover:bg-reflect"
          >
            <X className="size-3.5" aria-hidden />
          </button>
          <p aria-live="polite">
            <T th={line.th} en={line.en} />
          </p>
        </div>
      )}
      <button
        type="button"
        className="pointer-events-auto"
        onClick={() => setTalking(!talking)}
        onDoubleClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(HIDE_KEY, "1");
          } catch {}
        }}
        aria-label="น้องฟาร์ · คลิกเพื่อเปิด/ปิดคำพูด"
        title="คลิกเพื่อเปิด/ปิดคำพูด · ดับเบิลคลิกเพื่อซ่อน"
      >
        <Mascot pose={line.pose} className="h-[150px] w-auto drop-shadow-[0_8px_12px_rgba(0,0,0,0.25)]" title="น้องฟาร์" />
      </button>
    </div>
  );
}
