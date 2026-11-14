import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/supabase/env";

/*
  Which database migration (supabase/migrations/*.sql) has been run in Supabase. Each migration from 0009 on
  leaves something we can look for; the newest one found is the database version. When you add a migration,
  add it here too (number, file name and a probe for something it creates).
*/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Probe = (sb: any) => PromiseLike<{ error: { code?: string } | null }>;

export const migrations: { no: string; file: string; probe?: Probe }[] = [
  { no: "0008", file: "20261108000008_lowbed_daily_only.sql" },
  { no: "0009", file: "20261109000009_weekly_rates.sql", probe: (sb) => sb.from("trailer_models").select("weekly_rate").limit(1) },
  {
    no: "0010",
    file: "20261110000010_calendar_months.sql",
    probe: (sb) => sb.rpc("contract_months", { p_from: "2026-01-01T00:00:00Z", p_to: "2026-02-01T00:00:00Z" }),
  },
  { no: "0011", file: "20261111000011_service_requests.sql", probe: (sb) => sb.from("service_requests").select("id").limit(1) },
  { no: "0012", file: "20261112000012_payments_notify_analytics.sql", probe: (sb) => sb.from("page_views").select("id").limit(1) },
  { no: "0013", file: "20261113000013_quote_requests.sql", probe: (sb) => sb.from("quote_requests").select("id").limit(1) },
  { no: "0014", file: "20261114000014_visitor_details.sql", probe: (sb) => sb.from("page_views").select("device").limit(1) },
  { no: "0015", file: "20261115000015_tax_rentals.sql", probe: (sb) => sb.from("rental_contracts").select("id").limit(1) },
  { no: "0016", file: "20261116000016_rental_arrears.sql", probe: (sb) => sb.from("rental_contracts").select("unpaid_months").limit(1) },
];

export const latestMigration = migrations[migrations.length - 1];

export type SchemaStatus = {
  db: string; // newest migration found in the database
  latest: string; // newest migration in the code
  upToDate: boolean;
  pending: { no: string; file: string }[]; // files still to run, in order
};

/** Checks the live database (anonymous key; "table/function not found" means not applied). */
export async function schemaStatus(): Promise<SchemaStatus> {
  const { url, key } = requireSupabaseEnv();
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const applied = await Promise.all(
    migrations.map(async (m) => {
      if (!m.probe) return true;
      const { error } = await m.probe(sb);
      return !error || !/^(PGRST20[0-9]|42P01|42703|42883)$/.test(error.code ?? "");
    }),
  );
  let dbIndex = 0;
  applied.forEach((ok, i) => {
    if (ok) dbIndex = i;
  });
  const pending = migrations.filter((_, i) => !applied[i]).map(({ no, file }) => ({ no, file }));
  return { db: migrations[dbIndex].no, latest: latestMigration.no, upToDate: pending.length === 0, pending };
}
