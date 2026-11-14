import Link from "next/link";
import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { getSession, roleLabel } from "@/lib/session";
import { StaffRequestAlert } from "./staff-request-alert";

/** Shown across the top of the public site while a staff member is signed in. */
export async function StaffModeBar() {
  const s = await getSession();
  if (!s.role || !["SUPER_ADMIN", "SALES", "OPS"].includes(s.role)) return null;
  return (
    <div className="bg-reflect text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[13px] sm:px-6 lg:px-8">
        <span className="flex items-center gap-1.5 font-bold">
          <ShieldCheck className="size-4" aria-hidden />
          กำลังใช้งานในโหมดพนักงาน
        </span>
        <span className="opacity-90">
          {s.name} · {roleLabel[s.role]} ·
          เปิดหน้าหางคันไหนก็ได้เพื่อแก้ไขรูปและสถานะว่าง/ไม่ว่าง
        </span>
        <span className="ml-auto flex items-center gap-2">
          <StaffRequestAlert />
          <Link
            href="/admin"
            className="flex items-center gap-1 rounded-md border border-white/80 px-2.5 py-1 font-semibold hover:bg-white/15"
          >
            <LayoutDashboard className="size-3.5" aria-hidden /> ไปหน้าหลังบ้าน
          </Link>
        </span>
      </div>
    </div>
  );
}
