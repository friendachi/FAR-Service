import { getRole } from "./session";
import type { Role } from "./types";

export type StaffRole = Extract<Role, "SUPER_ADMIN" | "SALES" | "OPS">;

export const adminNav: { href: string; label: string; icon: string; roles: StaffRole[] }[] = [
  { href: "/admin", label: "แดชบอร์ด", icon: "gauge", roles: ["SUPER_ADMIN"] },
  { href: "/admin/notifications", label: "แจ้งเตือน", icon: "bell", roles: ["SUPER_ADMIN", "SALES", "OPS"] },
  { href: "/admin/knowledge", label: "สาระน่ารู้ & Facebook", icon: "book", roles: ["SUPER_ADMIN", "SALES"] },
  { href: "/admin/analytics", label: "สถิติการเข้าชมเว็บ", icon: "chart", roles: ["SUPER_ADMIN"] },
  { href: "/admin/quotes", label: "คำขอใบเสนอราคา", icon: "quote", roles: ["SUPER_ADMIN", "SALES"] },
  { href: "/admin/bookings", label: "ตรวจเอกสารและอนุมัติ", icon: "inbox", roles: ["SUPER_ADMIN", "SALES"] },
  { href: "/admin/bookings/new", label: "จองแทนลูกค้า", icon: "plus", roles: ["SUPER_ADMIN", "SALES"] },
  { href: "/admin/yard", label: "ตารางลานวันนี้", icon: "calendar", roles: ["SUPER_ADMIN", "OPS"] },
  { href: "/admin/fleet", label: "สถานะและตำแหน่งหาง", icon: "map", roles: ["SUPER_ADMIN", "OPS"] },
  { href: "/admin/trailers", label: "ข้อมูลหางเทรลเลอร์", icon: "truck", roles: ["SUPER_ADMIN", "SALES", "OPS"] },
  { href: "/admin/rentals", label: "ลูกค้าผู้เช่าปัจจุบัน", icon: "contract", roles: ["SUPER_ADMIN", "SALES", "OPS"] },
  { href: "/admin/handovers", label: "ส่งมอบ / รับคืนหาง", icon: "handover", roles: ["SUPER_ADMIN", "SALES", "OPS"] },
  { href: "/admin/checkups", label: "ตรวจเช็คสภาพหาง 6 เดือน", icon: "check", roles: ["SUPER_ADMIN", "SALES", "OPS"] },
  { href: "/admin/tax", label: "ภาษี / พ.ร.บ. / เล่มทะเบียน", icon: "stamp", roles: ["SUPER_ADMIN", "SALES", "OPS"] },
  { href: "/admin/customers", label: "ลูกค้า", icon: "users", roles: ["SUPER_ADMIN", "SALES"] },
  { href: "/admin/services", label: "คำขอบริการเสริม", icon: "wrench", roles: ["SUPER_ADMIN", "SALES", "OPS"] },
  { href: "/admin/settings", label: "ตั้งค่าระบบ", icon: "settings", roles: ["SUPER_ADMIN"] },
  { href: "/admin/view-as", label: "ดูหน้าลูกค้า / คนขับ", icon: "eye", roles: ["SUPER_ADMIN"] },
];

/** Staff role of the signed-in user, or null for customers, drivers and visitors. */
export async function staffRole(): Promise<StaffRole | null> {
  const r = await getRole();
  if (!r) return null;
  return r === "SUPER_ADMIN" || r === "SALES" || r === "OPS" ? r : null;
}

export async function can(...roles: StaffRole[]) {
  const r = await staffRole();
  return !!r && roles.includes(r);
}
