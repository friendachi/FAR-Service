import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StaffModeBar } from "@/components/staff-mode-bar";
import { FloatingMascot } from "@/components/floating-mascot";
import { PageViewTracker } from "@/components/page-view-tracker";
import { GoogleAnalytics } from "@/components/google-analytics";
import { getReference } from "@/lib/data/reference";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { festival } = await getReference();
  return (
    <>
      <Suspense fallback={null}>
        <StaffModeBar />
      </Suspense>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <GoogleAnalytics />
      {/* bottom-right corner: น้องฟาร์ */}
      <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex items-end gap-1">
        <Suspense fallback={null}>
          <FloatingMascot festival={festival ? { th: festival.mascotTh, en: festival.mascotEn, pose: festival.mascotPose } : null} />
        </Suspense>
      </div>
    </>
  );
}
