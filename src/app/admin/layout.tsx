import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import { StaffRequestAlert } from "@/components/staff-request-alert";
import { TaxDueBanner } from "@/components/tax-due-banner";
import { CheckupDueBanner } from "@/components/checkup-due-banner";
import { Wordmark } from "@/components/site-header";
import { adminNav, staffRole } from "@/lib/admin";
import { roleLabel } from "@/lib/session";
import { getStore } from "@/lib/data/store";

// Back office sits behind sign-in and reads the session first; instant navigation is not a goal here.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

function AdminFallback() {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="h-16 shrink-0 bg-sign-deep lg:h-dvh lg:w-64" />
      <div className="flex-1 bg-ground p-8 text-ink-3">กำลังโหลด…</div>
    </div>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const db = await getStore();
  const role = await staffRole();
  const items = role ? adminNav.filter((n) => n.roles.includes(role)) : [];
  const who = { name: db.userName };

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="on-sign shrink-0 print:hidden bg-sign-deep text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center justify-between px-5 lg:h-20">
          <Link href="/"><Wordmark plate /></Link>
          {role && (
            <span className="hidden lg:block">
              <NotificationBell />
            </span>
          )}
          <span className="flex items-center gap-3 text-[13px] text-sign-ink lg:hidden">
            {role && <NotificationBell />}
            {role ? roleLabel[role] : ""}
            <SignOutButton iconOnly className="size-9 justify-center rounded-lg text-white hover:bg-white/10" />
          </span>
        </div>
        <nav aria-label="เมนูหลังบ้าน" className="pb-3 lg:flex-1 lg:overflow-y-auto">
          <AdminNav items={items} />
        </nav>
        <div className="hidden border-t border-white/15 px-5 py-4 text-[14px] lg:block">
          <p className="font-semibold">{who?.name ?? "—"}</p>
          <p className="text-sign-ink">{role ? roleLabel[role] : "ไม่มีสิทธิ์"}</p>
          {role && (
            <div className="mt-3">
              <StaffRequestAlert />
            </div>
          )}
          <div className="mt-3 flex items-center gap-4">
            <Link href="/login" className="text-sign underline">สลับบทบาท</Link>
            <SignOutButton className="text-white hover:underline" />
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1 bg-ground print:bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8 print:p-0">
          {role ? (
            <>
              <Suspense fallback={null}>
                <TaxDueBanner />
              </Suspense>
              <Suspense fallback={null}>
                <CheckupDueBanner />
              </Suspense>
              {children}
            </>
          ) : (
            <div className="rounded-xl border border-line bg-paper p-10 text-center">
              <p className="text-[20px] font-bold">หน้านี้สำหรับพนักงานเท่านั้น</p>
              <Link href="/" className="mt-3 inline-block font-semibold text-grass underline">กลับหน้าแรก</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
