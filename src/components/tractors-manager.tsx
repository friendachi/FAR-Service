"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addTractor } from "@/app/actions/customer";
import { CircleCheckBig, Plus } from "lucide-react";
import type { CustomerDocument, DocRequirement, Tractor } from "@/lib/types";
import { DocUploadRow } from "./doc-upload-row";
import { Button, Field, Panel, cx, inputClass } from "./ui";

type Errors = Partial<Record<"plate" | "province" | "brand", string>>;

const PROVINCES = ["ชลบุรี", "ระยอง", "ฉะเชิงเทรา", "กรุงเทพมหานคร", "สมุทรปราการ", "ปราจีนบุรี", "จันทบุรี", "นครราชสีมา"];

const normPlate = (s: string) => s.replace(/\s+/g, "").replace(/–/g, "-");

/** Customer's tractors: list with their documents, plus an add form (local state until Supabase). */
export function TractorsManager({
  initial,
  reqs,
  docs,
  customerId,
}: {
  initial: Tractor[];
  reqs: DocRequirement[];
  docs: CustomerDocument[];
  customerId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const docFor = (key: string, ownerId: string): CustomerDocument =>
    docs.find((d) => d.key === key && d.ownerId === ownerId) ?? { key, ownerId, status: "MISSING" };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const plateNo = normPlate(String(f.get("plate") ?? ""));
    const province = String(f.get("province") ?? "");
    const brand = String(f.get("brand") ?? "").trim();
    const kind = String(f.get("kind") ?? "หัวลาก 10 ล้อ");
    const plate = `${plateNo} ${province}`;

    const next: Errors = {};
    if (!/^\d{2}-\d{4}$/.test(plateNo)) next.plate = "รูปแบบทะเบียนรถบรรทุก เช่น 70-1234";
    else if (rows.some((r) => r.plate === plate)) next.plate = "ทะเบียนนี้มีอยู่ในรายการแล้ว";
    if (!province) next.province = "เลือกจังหวัด";
    if (!brand) next.brand = "กรอกยี่ห้อ";
    setErrors(next);
    if (Object.keys(next).length) {
      setNotice(null);
      return;
    }

    startTransition(async () => {
      const res = await addTractor({ customerId, plateNo, province, brand, kind });
      if (!res.ok) {
        setNotice(null);
        return setErrors({ plate: res.error });
      }
      setRows((all) => [...all, { id: res.data?.id ?? `new-${Date.now()}`, customerId, plate, brand, kind }]);
      setNotice(`บันทึกหัวลาก ${plate} แล้ว อัปโหลดหน้าเล่มทะเบียนและกรมธรรม์ด้านล่างเพื่อใช้จองได้`);
      setFormKey((k) => k + 1);
    });
  };

  const err = (k: keyof Errors) =>
    errors[k] ? (
      <span className="mt-1 block text-[13px] font-semibold text-danger" role="alert">
        {errors[k]}
      </span>
    ) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-5">
        {notice && (
          <p className="flex items-start gap-2 rounded-lg border-2 border-sign bg-sign-wash px-4 py-3 text-[15px] font-semibold text-sign-deep" role="status">
            <CircleCheckBig className="mt-0.5 size-5 shrink-0" aria-hidden /> {notice}
          </p>
        )}
        {rows.map((t) => (
          <Panel
            key={t.id}
            title={<span className="font-route font-extrabold">{t.plate}</span>}
            actions={<span className="text-[14px] text-ink-3">{t.brand} · {t.kind}</span>}
          >
            <ul className="-my-4 divide-y divide-line">
              {reqs.map((r) => (
                <DocUploadRow key={r.key} req={r} doc={docFor(r.key, t.id)} customerId={t.customerId} />
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel title="เพิ่มหัวลาก" className="lg:self-start">
        <form key={formKey} onSubmit={submit} noValidate className="space-y-4">
          <div className="grid grid-cols-[1fr_1.2fr] gap-3">
            <Field label="ทะเบียน">
              <input name="plate" placeholder="70-1234" inputMode="numeric" aria-invalid={!!errors.plate} className={cx(inputClass, "font-route tabular", errors.plate && "border-danger")} />
            </Field>
            <Field label="จังหวัด">
              <select name="province" defaultValue="ชลบุรี" aria-invalid={!!errors.province} className={cx(inputClass, errors.province && "border-danger")}>
                {PROVINCES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
          {err("plate")}
          {err("province")}
          <Field label="ยี่ห้อ">
            <input name="brand" placeholder="เช่น Hino, Isuzu, Volvo" aria-invalid={!!errors.brand} className={cx(inputClass, errors.brand && "border-danger")} />
            {err("brand")}
          </Field>
          <Field label="ประเภท">
            <select name="kind" defaultValue="หัวลาก 10 ล้อ" className={inputClass}>
              <option>หัวลาก 6 ล้อ</option>
              <option>หัวลาก 10 ล้อ</option>
            </select>
          </Field>
          <Button type="submit" variant="sign" className="w-full" disabled={pending}>
            <Plus className="size-4" aria-hidden /> {pending ? "กำลังบันทึก…" : "บันทึกหัวลาก"}
          </Button>
          <p className="text-[13px] text-ink-3">ทะเบียนต้องตรงกับหัวลากที่มารับหาง เจ้าหน้าที่ลานจะตรวจตอนเช็กอิน</p>
        </form>
      </Panel>
    </div>
  );
}
