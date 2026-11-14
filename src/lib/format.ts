import type { BookingStatus, Channel, DocStatus, TrailerStatus } from "./types";

const baht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

export const money = (n: number) => `฿${baht.format(Math.round(n))}`;
export const num = (n: number) => baht.format(n);

const dateFmt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const dateShortFmt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Bangkok",
});
const timeFmt = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});
const weekdayFmt = new Intl.DateTimeFormat("th-TH", { weekday: "long", timeZone: "Asia/Bangkok" });

const asDate = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00+07:00` : `${s}:00+07:00`);

export const thDate = (s: string) => dateFmt.format(asDate(s));
export const thDateShort = (s: string) => dateShortFmt.format(asDate(s));
export const thTime = (s: string) => timeFmt.format(asDate(s));
export const thWeekday = (s: string) => weekdayFmt.format(asDate(s));
export const thDateTime = (s: string) => `${thDate(s)} ${thTime(s)} น.`;
/** A database timestamp (ISO with zone) in Bangkok time, e.g. for notifications and requests. */
export const thDateTimeIso = (iso: string) => thDateTime(new Date(new Date(iso).getTime() + 7 * 36e5).toISOString().slice(0, 16));

export const bookingStatusLabel: Record<BookingStatus, string> = {
  PENDING_REVIEW: "รอตรวจเอกสาร",
  NEED_MORE_DOCS: "ขอเอกสารเพิ่ม",
  APPROVED_AWAITING_PAYMENT: "อนุมัติแล้ว รอชำระ",
  CONFIRMED: "ยืนยันแล้ว",
  READY_FOR_PICKUP: "พร้อมรับหาง",
  IN_RENTAL: "กำลังเช่า",
  RETURNED_PENDING_SETTLEMENT: "คืนแล้ว รอสรุปยอด",
  COMPLETED: "เสร็จสิ้น",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
  EXPIRED: "หมดเวลา",
};

export type Tone = "ok" | "info" | "warn" | "danger" | "muted" | "action";

export const bookingStatusTone: Record<BookingStatus, Tone> = {
  PENDING_REVIEW: "warn",
  NEED_MORE_DOCS: "danger",
  APPROVED_AWAITING_PAYMENT: "action",
  CONFIRMED: "info",
  READY_FOR_PICKUP: "info",
  IN_RENTAL: "ok",
  RETURNED_PENDING_SETTLEMENT: "warn",
  COMPLETED: "muted",
  REJECTED: "muted",
  CANCELLED: "muted",
  EXPIRED: "muted",
};

export const trailerStatusLabelEn: Record<TrailerStatus, string> = {
  AVAILABLE: "Available",
  RESERVED: "Preparing handover",
  RENTED: "On rent",
  INSPECTION: "Post-return check",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
};

export const trailerStatusLabel: Record<TrailerStatus, string> = {
  AVAILABLE: "ว่าง",
  RESERVED: "เตรียมส่งมอบ",
  RENTED: "อยู่กับลูกค้า",
  INSPECTION: "รอตรวจหลังคืน",
  MAINTENANCE: "ซ่อมบำรุง",
  RETIRED: "ปลดระวาง",
};

export const trailerStatusTone: Record<TrailerStatus, Tone> = {
  AVAILABLE: "ok",
  RESERVED: "info",
  RENTED: "action",
  INSPECTION: "warn",
  MAINTENANCE: "danger",
  RETIRED: "muted",
};

export const docStatusLabel: Record<DocStatus, string> = {
  PENDING: "รอตรวจ",
  APPROVED: "ผ่าน",
  REJECTED: "ไม่ผ่าน",
  EXPIRED: "หมดอายุ",
  MISSING: "ยังไม่ส่ง",
};

export const docStatusTone: Record<DocStatus, Tone> = {
  PENDING: "warn",
  APPROVED: "ok",
  REJECTED: "danger",
  EXPIRED: "danger",
  MISSING: "muted",
};

export const channelLabel: Record<Channel, string> = {
  WEB: "เว็บไซต์",
  PHONE: "โทรศัพท์",
  LINE: "LINE",
  WALK_IN: "Walk-in",
  EMAIL: "อีเมล",
};
