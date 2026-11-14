import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { articleTypeLabel, type Article } from "@/lib/articles";
import { thDate } from "@/lib/format";
import { typePhoto, workPhotos } from "@/lib/photos";
import { T } from "./t";
import { Photo } from "./ui";

export const articlePhoto = (a: Article) => (a.type === "ALL" ? workPhotos[0].src : typePhoto(a.type));

export function ArticleCard({ article: a }: { article: Article }) {
  const label = articleTypeLabel[a.type];
  return (
    <Link href={`/knowledge/${a.slug}`} className="group flex flex-col rounded-xl border border-line bg-paper p-4 transition-colors hover:border-sign">
      <Photo src={articlePhoto(a)} alt="" className="aspect-[16/9]" sizes="(min-width: 1024px) 30vw, 100vw" />
      <p className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="rounded-full bg-sign-wash px-2.5 py-0.5 font-semibold text-grass"><T th={label.th} en={label.en} /></span>
        <span className="text-ink-3">{thDate(a.publishOn)}</span>
      </p>
      <h3 className="mt-2 text-[18px] font-bold leading-snug group-hover:text-grass"><T th={a.titleTh} en={a.titleEn} /></h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2"><T th={a.excerptTh} en={a.excerptEn} /></p>
      <span className="mt-auto pt-3 text-[14px] font-semibold text-reflect">
        <T th="อ่านต่อ" en="Read more" /> <ArrowRight className="inline size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}
