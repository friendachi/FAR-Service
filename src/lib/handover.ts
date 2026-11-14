/*
  Hand-over / return form ("ใบส่งมอบ") and the 6-monthly trailer inspection ("ใบรายการตรวจเช็คหางรถเช่า").
  Shared by the staff pages /admin/handovers and /admin/checkups.
*/
import { daysBetween, plusMonths } from "./fleet-admin";

export const DOC_BUCKET = "vehicle-docs";

/* ---------------------------------------------------------------- guided photos */

/** The 14 photos staff take when a trailer goes out or comes back, in the order they are taken. */
export const photoSlots = [
  { id: "FRONT", label: "ด้านหน้า", guide: "front" },
  { id: "FRONT_LEFT", label: "ด้านหน้าซ้าย", guide: "front-left" },
  { id: "FRONT_RIGHT", label: "ด้านหน้าขวา", guide: "front-right" },
  { id: "LEFT", label: "ด้านข้างซ้าย", guide: "left" },
  { id: "RIGHT", label: "ด้านข้างขวา", guide: "right" },
  { id: "REAR_LEFT", label: "ด้านท้ายซ้าย", guide: "rear-left" },
  { id: "REAR_RIGHT", label: "ด้านท้ายขวา", guide: "rear-right" },
  { id: "REAR", label: "ด้านท้าย", guide: "rear" },
  { id: "AXLE_LEFT", label: "เพลาซ้าย", guide: "axle-left" },
  { id: "AXLE_RIGHT", label: "เพลาขวา", guide: "axle-right" },
  { id: "DRIVER_TRACTOR", label: "คนยืนกับหัวลาก", guide: "driver-tractor" },
  { id: "ID_CARD", label: "บัตรประชาชนคนรับหางเทรลเลอร์", guide: "id-card-full" },
  { id: "LICENSE_FRONT", label: "ใบขับขี่คนรับหางเทรลเลอร์ - ด้านหน้า", guide: "license-front" },
  { id: "LICENSE_BACK", label: "ใบขับขี่คนรับหางเทรลเลอร์ - ด้านหลัง", guide: "license-back" },
] as const;
export type PhotoSlot = (typeof photoSlots)[number]["id"];
export type PhotoMap = Partial<Record<PhotoSlot, string[]>>;

/* ---------------------------------------------------------------- hand-over checklist (ใบส่งมอบ) */

/** Items 1–13 of the hand-over form. spec = free text before "จำนวน", of = "ของ …" (brand), check = "สมบูรณ์" tick. */
/** owner = "ของ ผู้เช่า / ผู้ให้เช่า" (who the tyres / rims belong to), stored in `of`. */
type HandoverItem = { key: string; label: string; spec?: boolean; unit?: string; owner?: boolean; check?: boolean };
export const handoverItems: readonly HandoverItem[] = [
  { key: "axle", label: "เพลา", spec: true, unit: "เส้น" },
  { key: "legs", label: "ขาค้ำยัน", spec: true, unit: "คู่" },
  { key: "toolbox", label: "ลังเครื่องมือ", unit: "ใบ" },
  { key: "brake", label: "ระบบเบรค - ลม สมบูรณ์", check: true },
  { key: "lights", label: "ระบบไฟ สมบูรณ์", check: true },
  { key: "tyres", label: "ยาง", unit: "เส้น", owner: true },
  { key: "rims", label: "ล้อกระทะ", unit: "ใบ", owner: true },
  { key: "bookCopy", label: "สำเนาหน้าเล่ม", unit: "ชุด" },
  { key: "cmiCopy", label: "สำเนา พ.ร.บ.", unit: "ชุด" },
  { key: "taxDoc", label: "เอกสารแสดงการเสียภาษี", unit: "ชุด" },
  { key: "plates", label: "แผ่นป้ายทะเบียน", unit: "ป้าย" },
  { key: "spareCrank", label: "มือหมุนยางอะไหล่", check: true },
  { key: "fallPosts", label: "เสากันตก", unit: "ต้น" },
];

export type HandoverItemValue = { spec?: string; qty?: string; of?: string; ok?: boolean };

export type HandoverDetails = {
  customer?: { name?: string; address?: string; taxId?: string; phone?: string };
  tractor?: { brand?: string; chassis?: string; plate?: string; note?: string };
  trailer?: { productType?: string; model?: string; chassis?: string; plate?: string; note?: string };
  items?: Record<string, HandoverItemValue>;
  accepted?: boolean; // ***รับรถในสภาพเรียบร้อย พร้อมใช้งาน
  deliverDate?: string;
  receiveDate?: string;
};

/* ---------------------------------------------------------------- 6-monthly inspection */

export const CHECKUP_MONTHS = 6;
/** Staff are alerted this many days before a trailer's 6-monthly inspection is due. */
export const CHECKUP_ALERT_DAYS = 15;

/** "damage" items are ticked เสียหาย / ไม่เสียหาย instead of ซ่อม / ไม่ซ่อม. */
type CheckItem = { key: string; label: string; unit?: string; spec?: string; damage?: boolean };

export const checkupGroups: { title: string; items: CheckItem[] }[] = [
  {
    title: "1. รายการตรวจเช็คทั่วไป",
    items: [
      { key: "g01", label: "ขาค้ำยัน", unit: "อัน" },
      { key: "g02", label: "ลังเครื่องมือ", unit: "ลัง" },
      { key: "g03", label: "กระทะล้อ", unit: "ใบ" },
      { key: "g04", label: "ไฟมิดเวย์ L", unit: "ดวง" },
      { key: "g05", label: "ไฟมิดเวย์ R", unit: "ดวง" },
      { key: "g06", label: "ไฟท้าย", unit: "ดวง" },
      { key: "g07", label: "ไฟส่องป้าย", unit: "ดวง" },
      { key: "g08", label: "บังโคลน", unit: "อัน" },
      { key: "g09", label: "ผ้ายางบังฝุ่น", unit: "อัน" },
      { key: "g10", label: "มือเสือ", unit: "อัน" },
      { key: "g11", label: "ทวิสล็อค", unit: "อัน" },
      { key: "g12", label: "ไฟทับทิม", unit: "ดวง" },
      { key: "g13", label: "ป้ายภาษี", damage: true },
      { key: "g14", label: "แผ่นป้ายทะเบียน", damage: true },
      { key: "g15", label: "สติ๊กเกอร์ประกอบการ", damage: true },
      { key: "g16", label: "สติ๊กเกอร์สะท้อนแสง", damage: true },
      { key: "g17", label: "ลอก/มือหมุนยางอะไหล่" },
      { key: "g18", label: "เสากันตก", unit: "ต้น" },
      { key: "g19", label: "เต้าไฟ", unit: "ตัว" },
      { key: "g20", label: "ไซร์กาด", unit: "อัน" },
    ],
  },
  {
    title: "2. รายการตรวจเช็คช่วงล่าง",
    items: [
      { key: "u01", label: "เพลา", spec: "ยี่ห้อ", unit: "เส้น" },
      { key: "u02", label: "จานเบรค", unit: "อัน" },
      { key: "u03", label: "แหนบ", unit: "ตับ" },
      { key: "u04", label: "ลูกหมาก", unit: "ลูก" },
      { key: "u05", label: "ผ้าเบรก", unit: "กล่อง" },
      { key: "u06", label: "รีเลย์", unit: "ตัว" },
      { key: "u07", label: "วาล์วไล่ลมเร็ว", unit: "ตัว" },
      { key: "u08", label: "บู้ชแขนเป็น/ตาย", unit: "ตัว" },
      { key: "u09", label: "บู้ชโตงเตง", unit: "ตัว" },
      { key: "u10", label: "ซีลล้อ", unit: "อัน" },
      { key: "u11", label: "หม้อลมเบรคชั้นเดียว", unit: "ลูก" },
      { key: "u12", label: "หม้อลมเบรคสองชั้น", unit: "ลูก" },
      { key: "u13", label: "สายลมดำ 1 ม.", unit: "เส้น" },
      { key: "u14", label: "สายลมดำ 6.5 ม.", unit: "เส้น" },
      { key: "u15", label: "เรือโตงเตง", unit: "อัน" },
      { key: "u16", label: "สลักเรือโตงเตง", unit: "อัน" },
      { key: "u17", label: "น๊อตสตัด", unit: "ตัว" },
      { key: "u18", label: "ฝาบังฝุ่นจานเบรค", unit: "อัน" },
      { key: "u19", label: "ขาปรับเบรค", unit: "ตัว" },
      { key: "u20", label: "สายลมแดง-เหลือง", unit: "เส้น" },
    ],
  },
];
export const checkupItems = checkupGroups.flatMap((g) => g.items);

/** r: FIX = ซ่อม (or เสียหาย), OK = ไม่ซ่อม (or ไม่เสียหาย). */
export type CheckupValue = { qty?: string; spec?: string; r?: "FIX" | "OK" };

export const resultLabel = (damage: boolean | undefined, r: "FIX" | "OK") =>
  damage ? (r === "FIX" ? "เสียหาย" : "ไม่เสียหาย") : r === "FIX" ? "ซ่อม" : "ไม่ซ่อม";

export type CheckupState = "OVERDUE" | "DUE" | "OK" | "NEVER";

/**
 * When a rented trailer next needs its 6-monthly inspection. The clock starts at the latest of: its last inspection,
 * its last hand-over (checked before release) or the contract start. No date at all → due now ("ยังไม่เคยตรวจ").
 */
export function checkupDue(base: string | null, today: string): { state: CheckupState; due: string | null; days: number | null } {
  if (!base) return { state: "NEVER", due: null, days: null };
  const due = plusMonths(base, CHECKUP_MONTHS);
  const days = daysBetween(today, due);
  return { state: days < 0 ? "OVERDUE" : days <= CHECKUP_ALERT_DAYS ? "DUE" : "OK", due, days };
}

const latest = (...d: (string | null | undefined)[]) => d.filter((x): x is string => !!x).sort().at(-1) ?? null;

/** One row per active contract plate with its inspection state, most urgent first. */
export function checkupBoard(
  contracts: { plate_no: string; customer_name: string; trailer_kind: string | null; start_date: string | null }[],
  checkups: { plate_no: string; inspected_on: string }[],
  handovers: { plate_no: string; happened_on: string }[],
  today: string,
) {
  const lastCheck = new Map<string, string>();
  for (const c of checkups) lastCheck.set(c.plate_no, latest(lastCheck.get(c.plate_no), c.inspected_on)!);
  const lastOut = new Map<string, string>();
  for (const h of handovers) lastOut.set(h.plate_no, latest(lastOut.get(h.plate_no), h.happened_on)!);
  const seen = new Set<string>();
  const order: Record<CheckupState, number> = { OVERDUE: 0, NEVER: 1, DUE: 2, OK: 3 };
  return contracts
    .filter((c) => !seen.has(c.plate_no) && seen.add(c.plate_no))
    .map((c) => {
      const last = lastCheck.get(c.plate_no) ?? null;
      const base = latest(last, lastOut.get(c.plate_no), c.start_date);
      return { ...c, lastCheck: last, base, ...checkupDue(base, today) };
    })
    .sort((a, b) => order[a.state] - order[b.state] || (a.due ?? "").localeCompare(b.due ?? ""));
}

export const isAlert = (s: CheckupState) => s !== "OK";

/** "2026-11-13" → "13/11/2569", as written on the paper forms. */
export const slashDate = (d: string | null | undefined) =>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${+d.slice(8, 10)}/${+d.slice(5, 7)}/${+d.slice(0, 4) + 543}` : "";
