import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { DEFAULT_COMPANY, type Company } from "@/lib/company";
import { DEFAULT_EXTRA_SERVICES, parseExtraServices, type ExtraService } from "@/lib/extra-services";
import { bangkokMonth, festivalFor, type Festival } from "@/lib/festivals";
import type { Pricing, TrailerType, TrailerTypeId, Yard, YardId } from "@/lib/types";

/** One row of the public price list (a trailer model, whether or not the fleet has one yet). */
export type PriceModel = { code: string; type: TrailerTypeId; name: string; pricing: Pricing };

export type Reference = { yards: Yard[]; trailerTypes: TrailerType[]; models: PriceModel[]; company: Company; extraServices: ExtraService[]; /** this month's festival theme (null = off) */ festival: Festival | null; festivalSetting: string; /** Current Buddhist-era year (refreshed with the cache). */ year: number };

/**
 * Yards and trailer types from Supabase. Public, rarely changed data, so it is cached for an hour
 * and shared across requests (call revalidateTag("reference") after editing them).
 */
export async function getReference(): Promise<Reference> {
  "use cache";
  cacheLife("hours");
  cacheTag("reference");

  const { url, key } = requireSupabaseEnv();
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const [y, t, m, c, x, fs] = await Promise.all([
    sb.from("yards").select("*").eq("is_active", true).order("number"),
    sb.from("trailer_types").select("*").order("sort_order"),
    sb.from("trailer_models").select("*").order("sort_order").order("code"),
    sb.from("settings").select("value").eq("key", "company").maybeSingle(),
    sb.from("settings").select("value").eq("key", "extra_services").maybeSingle(),
    sb.from("settings").select("value").eq("key", "festival_theme").maybeSingle(),
  ]);
  if (y.error) throw new Error(`โหลดลานจอดไม่สำเร็จ: ${y.error.message}`);
  if (t.error) throw new Error(`โหลดประเภทหางไม่สำเร็จ: ${t.error.message}`);
  if (m.error) throw new Error(`โหลดรุ่นหางไม่สำเร็จ: ${m.error.message}`);
  const n = (v: unknown) => (v == null ? undefined : Number(v));

  const saved = (c.data?.value ?? {}) as Partial<Company>;
  const company: Company = { ...DEFAULT_COMPANY };
  for (const k of Object.keys(DEFAULT_COMPANY) as (keyof Company)[]) if (saved[k]) company[k] = saved[k]!;

  return {
    company,
    extraServices: parseExtraServices(x.data?.value) ?? DEFAULT_EXTRA_SERVICES,
    festival: festivalFor(bangkokMonth(), fs.data?.value),
    festivalSetting: typeof fs.data?.value === "string" ? fs.data.value : "auto",
    year: new Date().getFullYear() + 543,
    yards: y.data.map((r) => ({
      id: r.code as YardId,
      number: r.number,
      name: r.name,
      short: r.short_name,
      address: r.address,
      note: r.note ?? "",
      mapUrl: r.map_url ?? "",
      hours: r.open_hours ?? "",
    })),
    trailerTypes: t.data.map((r) => ({
      id: r.code as TrailerTypeId,
      name: r.name_th,
      english: r.name_en,
      use: r.use_case ?? "",
      deposit: Number(r.default_deposit),
    })),
    models: m.data.map((r) => ({
      code: r.code,
      type: r.type as TrailerTypeId,
      name: r.name,
      pricing: {
        plan: r.rate_plan,
        daily: n(r.daily_rate),
        weekly: n(r.weekly_rate),
        monthly: n(r.monthly_rate),
        m1_5: n(r.monthly_rate_1_5),
        m6_11: n(r.monthly_rate_6_11),
        m12: n(r.monthly_rate_12),
        deposit: Number(r.deposit ?? 0),
        tyreFee: Number(r.tyre_fee ?? 0),
        tyreCount: r.tyre_count ?? 0,
      },
    })),
  };
}

export function lookups({ yards, trailerTypes }: Pick<Reference, "yards" | "trailerTypes">) {
  return {
    getYard: (id: YardId) => yards.find((y) => y.id === id) ?? yards[0],
    getType: (id: TrailerTypeId) => trailerTypes.find((t) => t.id === id) ?? trailerTypes[0],
  };
}
