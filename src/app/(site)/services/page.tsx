import { Suspense } from "react";
import type { Metadata } from "next";
import { PageFallback } from "@/components/page-fallback";
import { ServiceRequestForm } from "@/components/service-request-form";
import { T } from "@/components/t";
import { getReference } from "@/lib/data/reference";
import { yardEn } from "@/lib/i18n";
import { serviceKinds } from "@/lib/service-requests";

export const metadata: Metadata = { title: "ขอใช้บริการเสริม · Extra services" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default function ServicesPage(props: PageProps<"/services">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ServicesContent {...props} />
    </Suspense>
  );
}

async function ServicesContent({ searchParams }: PageProps<"/services">) {
  const [{ yards }, sp] = await Promise.all([getReference(), searchParams]);
  const initial = serviceKinds.find((k) => k.slug === one(sp.s))?.id;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold"><T th="ขอใช้บริการเสริม" en="Request an extra service" /></h1>
          <p className="mt-2 max-w-xl text-[16px] text-ink-2">
            <T
              th="ใช้บริการใส่/ถอดยาง ล้างทำความสะอาด หรือฝากจอดได้ โดยไม่ต้องเช่าหาง เลือกบริการ กรอกรายละเอียด แล้วเจ้าหน้าที่จะโทรยืนยัน"
              en="Tire fitting, washing or parking, without renting a trailer. Pick a service, fill in the details and we will call to confirm."
            />
          </p>
        </div>
      </div>
      <div className="mt-8">
        <ServiceRequestForm
          initial={initial}
          yards={yards.map((y) => ({ id: y.id, label: `ลาน${y.short} · ${yardEn[y.id]?.short ?? y.short} Yard`, mapUrl: y.mapUrl, hours: y.hours }))}
        />
      </div>
    </div>
  );
}
