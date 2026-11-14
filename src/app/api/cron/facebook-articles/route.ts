import { postNewArticles } from "@/lib/facebook";

/*
  Called once a week (every Monday, after the new article goes live) by the host's scheduler, e.g. a
  Vercel Cron Job. Protected by CRON_SECRET: the scheduler sends "Authorization: Bearer <CRON_SECRET>".
*/
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ results: await postNewArticles() });
}
