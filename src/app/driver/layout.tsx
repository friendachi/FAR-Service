import Link from "next/link";
import { Suspense } from "react";
import { DriverNav } from "@/components/driver-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { Wordmark } from "@/components/site-header";
import { ViewAsBanner } from "@/components/view-as-banner";
import { getStore } from "@/lib/data/store";

async function AdminBanner() {
  const db = await getStore();
  if (db.role !== "SUPER_ADMIN") return null;
  const d = db.currentDriverId ? db.getDriver(db.currentDriverId) : undefined;
  return <ViewAsBanner who={`คนขับ ${d?.name ?? ""}`} />;
}

async function DriverName() {
  const db = await getStore();
  const d = db.currentDriverId ? db.getDriver(db.currentDriverId) : undefined;
  return <>{d?.name ?? ""}</>;
}

export default function DriverLayout({ children }: LayoutProps<"/driver">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-ground">
      <Suspense fallback={null}>
        <AdminBanner />
      </Suspense>
      <header className="on-sign border-b-4 border-white bg-sign text-on-sign">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href="/driver"><Wordmark plate /></Link>
          <span className="flex items-center gap-2 text-[15px]">
            <Suspense fallback={null}>
              <DriverName />
            </Suspense>
            <SignOutButton iconOnly className="size-10 justify-center rounded-lg hover:bg-white/10" />
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-5">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-line/60" />}>{children}</Suspense>
      </main>
      <nav
        aria-label="เมนูคนขับ"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        <Suspense fallback={<div className="h-16" />}>
          <DriverNav />
        </Suspense>
      </nav>
    </div>
  );
}
