import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { AddTrailerForm, ExportCsvButton, TrailerStatusControl } from "@/components/trailer-admin";
import { PageHeader, Panel, YardShield, cx } from "@/components/ui";
import { can, staffRole } from "@/lib/admin";
import { getStore } from "@/lib/data/store";
import { money, trailerStatusLabel } from "@/lib/format";
import { specLine } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { ModelEditor, TrailerEditor, type ModelRow } from "@/components/content-admin";
import type { Pricing } from "@/lib/types";

export const instant = false;

export const metadata: Metadata = { title: "ข้อมูลหางเทรลเลอร์" };

const priceText = (p: Pricing) =>
  p.plan === "MONTHLY_TIERED"
    ? `${money(p.m1_5 ?? 0)} / ${money(p.m6_11 ?? 0)} / ${money(p.m12 ?? 0)} ต่อเดือน`
    : `${money(p.daily ?? 0)}/วัน${p.weekly ? ` · ${money(p.weekly)}/สัปดาห์` : ""}${p.monthly ? ` · ${money(p.monthly)}/เดือน` : ""}`;

const rowPrice = (m: ModelRow) =>
  m.rate_plan === "MONTHLY_TIERED"
    ? `1–5 เดือน ${money(m.monthly_rate_1_5 ?? 0)} · 6–11 เดือน ${money(m.monthly_rate_6_11 ?? 0)} · 12 เดือน ${money(m.monthly_rate_12 ?? 0)}`
    : [`${money(m.daily_rate ?? 0)}/วัน`, m.weekly_rate && `${money(m.weekly_rate)}/สัปดาห์`, m.monthly_rate && `${money(m.monthly_rate)}/เดือน`]
        .filter(Boolean)
        .join(" · ");

export default async function TrailersAdmin({ searchParams }: PageProps<"/admin/trailers">) {
  const db = await getStore();
  if (!(await can("SUPER_ADMIN", "SALES", "OPS"))) return <NoAccess need="พนักงาน" />;
  const role = await staffRole();
  const focus = (await searchParams).focus as string | undefined;
  // Sales / CS, Ops and Super Admin can mark trailers available or not
  const canStatus = role === "SUPER_ADMIN" || role === "OPS" || role === "SALES";
  const supabase = await createClient();
  const { data: modelData } = await supabase.from("trailer_models").select("*").order("sort_order").order("code");
  const modelRows = (modelData ?? []).map((r) => ({
    ...r,
    ...Object.fromEntries(
      ["width_m", "length_m", "deck_height_m", "daily_rate", "weekly_rate", "monthly_rate", "monthly_rate_1_5", "monthly_rate_6_11", "monthly_rate_12", "deposit", "tyre_fee"].map((k) => [
        k,
        r[k] == null ? null : Number(r[k]),
      ]),
    ),
    weekly_rate: r.weekly_rate == null ? null : Number(r.weekly_rate),
  })) as ModelRow[];

  return (
    <>
      <PageHeader
        title="ข้อมูลหางเทรลเลอร์"
        sub={`${db.trailers.length} คัน · ว่าง ${db.trailers.filter((t) => t.status === "AVAILABLE").length} · มีผู้เช่า ${db.trailers.filter((t) => t.status === "RENTED").length}`}
        actions={
          <ExportCsvButton
            filename="trailers.csv"
            rows={[
              ["รหัส", "รุ่น", "ทะเบียน", "ลาน", "สเปก", "ราคา (ไม่รวม VAT)", "เงินค้ำ", "สถานะ"],
              ...db.trailers.map((t) => [t.code, t.model.name, t.plate, db.getYard(t.yard).short, specLine(t), priceText(t.pricing), t.deposit,
                trailerStatusLabel[t.status]]),
            ]}
          />
        }
      />

      <Panel title="ราคาและสเปกตามรุ่น (ไม่รวม VAT)" flush className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-semibold">รุ่น</th>
                <th className="px-4 py-2.5 font-semibold">ราคา</th>
                <th className="px-4 py-2.5 text-right font-semibold">เงินค้ำ/หาง</th>
                <th className="px-4 py-2.5 text-right font-semibold">จำนวน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {modelRows.map((m) => (
                <tr key={m.code} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-[13px] text-ink-3">
                      {specLine({
                        axles: m.axles,
                        lengthFt: m.length_ft ?? 0,
                        model: { widthM: m.width_m ?? undefined, lengthM: m.length_m ?? undefined, deckLength: m.deck_length ?? undefined, deckHeightM: m.deck_height_m ?? undefined },
                      })}
                      {m.description ? ` · ${m.description}` : ""}
                    </p>
                    {role === "SUPER_ADMIN" && <ModelEditor model={m} />}
                  </td>
                  <td className="px-4 py-3 tabular">{rowPrice(m)}</td>
                  <td className="px-4 py-3 text-right tabular">{money(m.deposit)}</td>
                  <td className="px-4 py-3 text-right tabular">{db.trailers.filter((x) => x.model.code === m.code).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-semibold">รหัส</th>
                <th className="px-4 py-2.5 font-semibold">รุ่น</th>
                <th className="px-4 py-2.5 font-semibold">ทะเบียน</th>
                <th className="px-4 py-2.5 font-semibold">สถานะ / ลาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {db.trailers.map((t) => (
                <tr key={t.id} className={cx("hover:bg-sign-wash", focus === t.id && "bg-reflect-tint")}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <YardShield n={db.getYard(t.yard).number} size={16} />
                      <span className="font-route font-extrabold">{t.code}</span>
                    </span>
                    <p className="text-[12px] text-ink-3">{t.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{t.model.name}</p>
                    {!t.published && <p className="text-[12px] font-semibold text-warn">ไม่แสดงบนเว็บไซต์</p>}
                    {role === "SUPER_ADMIN" && (
                      <TrailerEditor
                        trailer={{ id: t.id, code: t.code, plate: t.plate, model: t.model.code, description: t.description, published: t.published, retired: t.status === "RETIRED" }}
                        models={modelRows.map((m) => ({ code: m.code, name: m.name }))}
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular">{t.plate}</td>
                  <td className="px-4 py-3">
                    <TrailerStatusControl trailerId={t.id} status={t.status} yard={t.yard} yards={db.yards} editable={canStatus} />
                    <a href={`/trailers/${t.id}#staff-edit`} className="mt-1 inline-block text-[13px] font-semibold text-grass underline">
                      แก้ไขรูป ({t.uploadedPhotos?.length ?? 0})
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Panel title="เพิ่มหาง" className="xl:self-start">
          <AddTrailerForm models={modelRows.map((m) => ({ code: m.code, name: m.name }))} yards={db.yards} />
        </Panel>
      </div>
    </>
  );
}
