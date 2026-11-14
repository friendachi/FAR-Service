import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { articleTypeLabel, bangkokToday, publishedArticles, type Article } from "@/lib/articles";

/*
  Posts each new "สาระน่ารู้" article to the Facebook Page (FAR Trailer Rental Thailand) through the Graph API.
  Needs, in .env.local / the host's environment:
    FACEBOOK_PAGE_ID            numeric id of the Page
    FACEBOOK_PAGE_ACCESS_TOKEN  long-lived Page access token with pages_manage_posts
    NEXT_PUBLIC_SITE_URL        public web address, e.g. https://farservice.co.th (links in the post)
  Posted articles are remembered in settings.facebook_posted ({ slug: post id }) so nothing is posted twice.
*/
const GRAPH = "https://graph.facebook.com/v21.0";
const KEY = "facebook_posted";

export const facebookConfigured = () => !!(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.NEXT_PUBLIC_SITE_URL);

export const articleUrl = (a: Article) => `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/knowledge/${a.slug}`;

/** The post text (also used for the "copy" button when Facebook isn't connected). */
export function facebookMessage(a: Article) {
  const bullets = a.body.flatMap((b) => ("list" in b ? b.list : [])).slice(0, 4);
  return [
    `📘 สาระน่ารู้ · ${articleTypeLabel[a.type].th}`,
    "",
    a.titleTh,
    "",
    a.excerptTh,
    ...(bullets.length ? ["", ...bullets.map((x) => `✅ ${x}`)] : []),
    "",
    `อ่านต่อ 👉 ${articleUrl(a)}`,
    "",
    "FAR Service ให้เช่าหางพื้นเรียบ หางก้างปลา หางโลว์เบด · ขอใบเสนอราคา/สอบถาม โทร 090-289-4964",
    "#เช่าหางเทรลเลอร์ #หางพื้นเรียบ #หางก้างปลา #หางโลว์เบด #FARService",
  ].join("\n");
}

export async function postedArticles(): Promise<Record<string, string>> {
  const { data } = await createAdminClient().from("settings").select("value").eq("key", KEY).maybeSingle();
  return (data?.value as Record<string, string>) ?? {};
}

async function remember(slug: string, postId: string) {
  const sb = createAdminClient();
  const posted = { ...(await postedArticles()), [slug]: postId };
  await sb.from("settings").upsert({ key: KEY, value: posted, updated_at: new Date().toISOString() });
}

export async function postArticle(a: Article): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!facebookConfigured()) return { ok: false, error: "ยังไม่ได้เชื่อมต่อ Facebook (ใส่ FACEBOOK_PAGE_ID, FACEBOOK_PAGE_ACCESS_TOKEN, NEXT_PUBLIC_SITE_URL)" };
  const body = new URLSearchParams({
    message: facebookMessage(a),
    link: articleUrl(a),
    access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN!,
  });
  const res = await fetch(`${GRAPH}/${process.env.FACEBOOK_PAGE_ID}/feed`, { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) return { ok: false, error: json.error?.message ?? `Facebook ตอบกลับ ${res.status}` };
  await remember(a.slug, json.id);
  return { ok: true, id: json.id };
}

/**
 * Weekly job: post every article that has been published in the last 14 days and isn't on Facebook yet
 * (older ones are left alone so turning this on doesn't flood the Page).
 */
export async function postNewArticles() {
  const today = bangkokToday();
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 14 * 864e5).toISOString().slice(0, 10);
  const posted = await postedArticles();
  const due = publishedArticles(today).filter((a) => a.publishOn >= since && !posted[a.slug]).reverse();
  const results = [];
  for (const a of due) results.push({ slug: a.slug, ...(await postArticle(a)) });
  return results;
}
