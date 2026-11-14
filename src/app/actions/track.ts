"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { parseUserAgent, sourceOf } from "@/lib/visitor";

export type ViewInput = { path: string; visitor: string; referrer: string | null; search: string; language: string };

const dec = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, 80);
  } catch {
    return v.slice(0, 80);
  }
};

/** Records one page view with where the visitor is, their device and where they came from. Never throws. */
export async function trackView(input: ViewInput) {
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    const agent = parseUserAgent(ua);
    if (agent.bot) return;
    const params = new URLSearchParams(input.search);
    // Location comes from the host's IP lookup: Vercel (x-vercel-ip-*) or Cloudflare (cf-ip*). Not available on localhost.
    const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
    const region = dec(h.get("x-vercel-ip-country-region-name") ?? h.get("x-vercel-ip-country-region") ?? h.get("cf-region"));
    const city = dec(h.get("x-vercel-ip-city") ?? h.get("cf-ipcity"));
    const sb = await createClient();
    const row = {
      path: input.path.slice(0, 300),
      visitor_id: input.visitor.slice(0, 64),
      referrer: input.referrer?.slice(0, 500) ?? null,
      country: country?.slice(0, 60) ?? null,
      region,
      city,
      device: agent.device,
      os: agent.os,
      browser: agent.browser,
      language: input.language.slice(0, 20) || null,
      source: sourceOf(input.referrer, params.get("utm_source"), params.get("fbclid"), params.get("gclid"), agent.browser),
      utm_campaign: params.get("utm_campaign")?.slice(0, 120) ?? null,
    };
    const { error } = await sb.from("page_views").insert(row);
    // database not on migration 0014 yet: keep counting with the original columns
    if (error && /column|schema cache/i.test(error.message)) {
      await sb.from("page_views").insert({ path: row.path, visitor_id: row.visitor_id, referrer: row.referrer });
    }
  } catch {}
}
