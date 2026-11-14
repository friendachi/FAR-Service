import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeft, FileText } from "lucide-react";
import { ArticleCard, articlePhoto } from "@/components/article-card";
import { PageFallback } from "@/components/page-fallback";
import { T } from "@/components/t";
import { Photo, buttonClass, cx } from "@/components/ui";
import { articleBySlug, articleTypeLabel, bangkokToday, publishedArticles } from "@/lib/articles";
import { thDate } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/knowledge/[slug]">): Promise<Metadata> {
  await connection();
  const a = articleBySlug((await params).slug);
  return a && a.publishOn <= bangkokToday() ? { title: `${a.titleTh} · สาระน่ารู้`, description: a.excerptTh } : { title: "ไม่พบบทความ" };
}

export default function ArticlePage(props: PageProps<"/knowledge/[slug]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ArticleContent {...props} />
    </Suspense>
  );
}

async function ArticleContent({ params }: PageProps<"/knowledge/[slug]">) {
  await connection();
  const today = bangkokToday();
  const a = articleBySlug((await params).slug);
  if (!a || a.publishOn > today) notFound(); // scheduled articles stay hidden until their Monday
  const more = publishedArticles(today).filter((x) => x.slug !== a.slug).slice(0, 2);
  const label = articleTypeLabel[a.type];

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/knowledge" className="inline-flex items-center gap-1 text-[15px] font-semibold text-grass hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> <T th="สาระน่ารู้ทั้งหมด" en="All articles" />
      </Link>
      <p className="mt-5 flex flex-wrap items-center gap-2 text-[14px]">
        <span className="rounded-full bg-sign-wash px-3 py-0.5 font-semibold text-grass"><T th={label.th} en={label.en} /></span>
        <span className="text-ink-3">{thDate(a.publishOn)}</span>
      </p>
      <h1 className="mt-3 text-[30px] font-bold leading-tight sm:text-[36px]"><T th={a.titleTh} en={a.titleEn} /></h1>
      <p className="mt-3 text-[18px] leading-relaxed text-ink-2"><T th={a.excerptTh} en={a.excerptEn} /></p>
      <Photo src={articlePhoto(a)} alt="" priority className="mt-6 aspect-[16/9]" sizes="(min-width: 768px) 720px, 100vw" />

      <div lang="th" className="mt-8 text-[17px] leading-[1.85] text-ink [&_h2]:mt-8 [&_h2]:text-[22px] [&_h2]:font-bold [&_p]:mt-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
        {a.body.map((b, i) =>
          "h" in b ? <h2 key={i}>{b.h}</h2> : "p" in b ? <p key={i}>{b.p}</p> : (
            <ul key={i}>{b.list.map((li) => <li key={li}>{li}</li>)}</ul>
          ),
        )}
      </div>
      <p className="i18n-en mt-4 text-[14px] text-ink-3">Full article in Thai.</p>

      <div className="mt-10 flex flex-wrap items-center gap-4 rounded-xl border-2 border-sign bg-paper p-6">
        <p className="min-w-0 flex-1 text-[17px] font-bold">
          <T th="ต้องการเช่าหางเทรลเลอร์? ขอใบเสนอราคาได้เลย" en="Need trailers? Ask us for a quotation" />
        </p>
        <Link href="/quote" className={cx(buttonClass("primary", "lg"))}>
          <FileText className="size-5" aria-hidden /> <T th="ขอใบเสนอราคา" en="Request a quotation" />
        </Link>
      </div>

      {more.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[22px] font-bold"><T th="บทความอื่น" en="More articles" /></h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {more.map((m) => (
              <ArticleCard key={m.slug} article={m} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
