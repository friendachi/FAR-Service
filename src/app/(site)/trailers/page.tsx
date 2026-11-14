import { Suspense } from "react";
import { PageFallback } from "@/components/page-fallback";
import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { TrailerCard } from "@/components/trailer-card";
import { RateConditions } from "@/components/rate-conditions";
import type { Availability } from "@/lib/availability";
import { getStore } from "@/lib/data/store";
import { T } from "@/components/t";
import { yardEn } from "@/lib/i18n";
import type { TrailerTypeId, YardId } from "@/lib/types";
import { matchesSearchType, searchOption, searchTypeOf } from "@/lib/search-options";

export const metadata: Metadata = { title: "ค้นหาหางเทรลเลอร์ · Find trailers" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default function TrailersPage(props: PageProps<"/trailers">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <TrailersPageContent {...props} />
    </Suspense>
  );
}

async function TrailersPageContent({ searchParams }: PageProps<"/trailers">) {
  const db = await getStore();
  const sp = await searchParams;
  const type = one(sp.type);
  const option = searchOption(type);
  const baseType = searchTypeOf(type) as TrailerTypeId | undefined;
  const yard = one(sp.yard) as YardId | undefined;
  // catalogue view: availability is the trailer's current status (no online booking)
  const statusAvail = (st: string): Availability => (st === "AVAILABLE" ? "FREE" : st === "MAINTENANCE" ? "SERVICE" : "BOOKED");
  const list = db.trailers
    .filter((t) => t.published && t.status !== "RETIRED")
    .filter((t) => matchesSearchType(t, type))
    .filter((t) => !yard || t.yard === yard)
    .map((t) => ({ t, a: statusAvail(t.status) }))
    .sort((x, y) => Number(x.a !== "FREE") - Number(y.a !== "FREE"));
  const free = list.filter((x) => x.a === "FREE").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-xl border-2 border-line bg-paper p-3 sm:p-4">
        <SearchBar defaults={{ type, yard }} compact catalog />
      </div>

      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-bold sm:text-[30px]">
          <T
            th={`${option ? option.th : baseType ? db.getType(baseType).name : "หางทุกประเภท"}${yard ? ` · ลาน${db.getYard(yard).short}` : ""}`}
            en={`${option ? option.en : baseType ? `${db.getType(baseType).english} trailers` : "All trailers"}${yard ? ` · ${yardEn[yard]?.short ?? yard} Yard` : ""}`}
          />
        </h1>
        <p className="text-[15px] text-ink-2">
          <T th={`ทั้งหมด ${list.length} คัน · ว่างตอนนี้ ${free} คัน`} en={`${list.length} trailers · ${free} available now`} />
          {" · "}
          <Link href={`/quote${option ? `?model=${option.id}` : ""}`} className="font-semibold text-reflect underline">
            <T th="ขอใบเสนอราคา" en="Request a quotation" />
          </Link>
        </p>
      </div>

      <RateConditions compact className="mb-6" />

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center">
          <p className="text-[18px] font-bold"><T th="ไม่มีหางตรงกับที่ค้นหา" en="No trailers match your search" /></p>
          <p className="mt-2 text-ink-2">
            <T th="ลองเปลี่ยนลานรับ หรือเลือกประเภทหางอื่น เพราะคืนต่างลานได้ไม่มีค่าใช้จ่าย" en="Try another yard or trailer type — returning to a different yard is free." />
          </p>
          <Link href="/trailers" className="mt-4 inline-block font-semibold text-grass underline">
            <T th="ล้างตัวกรองทั้งหมด" en="Clear all filters" />
          </Link>
        </div>
      ) : (
        <div data-static className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ t, a }) => (
            <TrailerCard key={t.id} trailer={t} availability={a} />
          ))}
        </div>
      )}
    </div>
  );
}
