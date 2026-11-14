import { Suspense } from "react";
import { SchemaVersionPanel } from "@/components/schema-version";
import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { AddStaffForm, DeleteStaffButton, DepositsForm, PaymentAccountsForm, PolicyForm, StaffPinForm } from "@/components/settings-forms";
import { Badge, PageHeader, Panel, YardShield } from "@/components/ui";
import { can } from "@/lib/admin";
import { CompanyForm, DocRequirementEditor, ExtraServicesEditor, FestivalThemeForm, YardEditor } from "@/components/content-admin";
import { festivals } from "@/lib/festivals";
import { getReference } from "@/lib/data/reference";
import { getStore } from "@/lib/data/store";
import { roleLabel } from "@/lib/session";

export const instant = false;

export const metadata: Metadata = { title: "ตั้งค่าระบบ" };

export default async function Settings() {
  const [db, ref] = await Promise.all([getStore(), getReference()]);
  if (!(await can("SUPER_ADMIN"))) return <NoAccess need="Super Admin" />;
  return (
    <>
      <PageHeader title="ตั้งค่าระบบ" />
      <div className="mb-6">
        <Suspense fallback={null}>
          <SchemaVersionPanel />
        </Suspense>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="ผู้ใช้งานภายใน" flush>
          <div className="border-b border-line px-5 py-3">
            <AddStaffForm yards={db.yards} />
          </div>
          <ul className="divide-y divide-line">
            {db.staff.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <StaffPinForm userId={s.id} name={s.name} />
                    <DeleteStaffButton userId={s.id} name={s.name} />
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {s.homeYard && <span className="text-[13px] text-ink-3">ลานประจำ {db.yards.find((y) => y.id === s.homeYard)?.short}</span>}
                  <Badge tone="muted">{roleLabel[s.role]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="ประเภทหางและเงินค้ำประกัน" flush>
          <DepositsForm types={db.trailerTypes} />
        </Panel>

        <Panel title="นโยบายการเช่า">
<PolicyForm values={db.settings} />
        </Panel>

        <Panel title="ลานจอด" flush>
          <ul className="divide-y divide-line">
            {db.yards.map((y) => (
              <li key={y.id} className="flex items-start gap-3 px-5 py-4">
                <YardShield n={y.number} size={30} />
                <div className="min-w-0 flex-1 text-[15px]">
                  <p className="font-semibold">{y.name}</p>
                  <p className="text-ink-2">{y.address} · {y.hours}</p>
                  <a href={y.mapUrl} target="_blank" rel="noreferrer" className="break-all text-[13px] text-grass underline">{y.mapUrl}</a>
                  {y.note && <p className="text-[13px] text-ink-3">{y.note}</p>}
                  <YardEditor yard={{ id: y.id, name: y.name, short: y.short, address: y.address, hours: y.hours, note: y.note, mapUrl: y.mapUrl }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="ธีมเทศกาล">
          <p className="mb-3 text-[14px] text-ink-2">
            เดือนนี้: <strong>{ref.festival ? `${ref.festival.th} · ${ref.festival.greetingTh}` : "ไม่มีธีม"}</strong>
          </p>
          <FestivalThemeForm value={ref.festivalSetting} />
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-ink-2 sm:grid-cols-3">
            {festivals.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: f.color }} />
                เดือน {f.month} · {f.th}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="บริการเสริม (มีค่าบริการ)" flush>
          <ExtraServicesEditor services={ref.extraServices} />
        </Panel>

        <Panel title="เอกสารที่ต้องใช้" flush>
          <ul className="divide-y divide-line text-[15px]">
            {db.docRequirements.map((r) => (
              <li key={r.key} className="flex items-start justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1">
                  {r.label}
                  {r.required === false && <span className="text-[13px] text-ink-3"> (ไม่บังคับ)</span>}
                  {r.rule && <span className="block text-[13px] text-ink-3">{r.rule}</span>}
                  <DocRequirementEditor req={{ key: r.key, label: r.label, rule: r.rule, required: r.required !== false }} />
                </span>
                <Badge tone="muted">{r.appliesTo === "ALL" ? "ทุกสัญญา" : r.appliesTo.includes("COMPANY") ? "นิติบุคคล" : "บุคคลธรรมดา"}</Badge>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="ข้อมูลบริษัทและ Company profile" className="xl:col-span-2">
          <p className="mb-4 text-[14px] text-ink-3">แสดงที่หน้าหลัก แถบด้านล่าง และหน้าติดต่อเรา</p>
          <CompanyForm company={ref.company} />
        </Panel>

        <Panel title="รับชำระเงิน">
          <p className="mb-4 text-[14px] text-ink-3">ไม่รับบัตรเครดิต รับเฉพาะ PromptPay และโอนเงินพร้อมสลิป</p>
<PaymentAccountsForm values={(db.settings.payment_accounts ?? {}) as Record<string, string | null>} />
        </Panel>
      </div>
    </>
  );
}
