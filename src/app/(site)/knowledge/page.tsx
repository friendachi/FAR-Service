import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArticleCard } from "@/components/article-card";
import { PageFallback } from "@/components/page-fallback";
import { T } from "@/components/t";
import { articleTypeLabel, bangkokToday, publishedArticles, type ArticleType } from "@/lib/articles";
import { cx } from "@/components/ui";

export const metadata: Metadata = { title: "สาระน่ารู้เรื่องหางเทรลเลอร์ · Trailer know-how" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const filters: (ArticleType | "")[] = ["", "FLATBED", "SKELETAL", "LOWBED", "ALL"];

export default function KnowledgePage(props: PageProps<"/knowledge">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <KnowledgeList {...props} />
    </Suspense>
  );
}

async function KnowledgeList({ searchParams }: PageProps<"/knowledge">) {
  await connection(); // the list grows every Monday: read today's date per request
  const type = one((await searchParams).type) as ArticleType | undefined;
  const all = publishedArticles(bangkokToday());
  const list = type ? all.filter((a) => a.type === type) : all;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-[32px] font-bold"><T th="สาระน่ารู้เรื่องหางเทรลเลอร์" en="Trailer know-how" /></h1>
      <p className="mt-2 max-w-2xl text-[16px] text-ink-2">
        <T
          th="ความรู้การใช้งานหางพื้นเรียบ หางก้างปลา และหางโลว์เบด สำหรับผู้ประกอบการขนส่งและคนขับ อัปเดตบทความใหม่ทุกสัปดาห์"
          en="Practical know-how on flatbed, chassis and lowbed trailers for hauliers and drivers. New articles every week."
        />
      </p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="ประเภทบทความ">
        {filters.map((f) => (
          <Link
            key={f || "all"}
            href={f ? `/knowledge?type=${f}` : "/knowledge"}
            className={cx(
              "rounded-full border-2 px-4 py-1.5 text-[14px] font-semibold",
              (type ?? "") === f ? "border-sign bg-sign text-on-sign" : "border-line bg-paper text-ink-2 hover:border-sign",
            )}
          >
            {f ? <T th={articleTypeLabel[f].th} en={articleTypeLabel[f].en} /> : <T th="ทั้งหมด" en="All" />}
          </Link>
        ))}
      </nav>
      {list.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center text-ink-2">
          <T th="ยังไม่มีบทความในหมวดนี้ ติดตามได้เร็ว ๆ นี้" en="No articles in this category yet — coming soon." />
        </p>
      )}
    </div>
  );
}
