"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addDriver } from "@/app/actions/customer";
import { CircleCheckBig, Send, Upload } from "lucide-react";
import { docStatusLabel, docStatusTone, thDate } from "@/lib/format";
import type { CustomerDocument, DocRequirement, DocStatus } from "@/lib/types";
import { DocUploadRow } from "./doc-upload-row";
import { Badge, Button, Field, Panel, cx, inputClass } from "./ui";

export type DriverRow = {
  id: string;
  name: string;
  phone: string;
  licenseNo: string;
  licenseClass: string;
  licenseExpires: string;
  docStatus: DocStatus;
  account: "ACTIVE" | "INVITED" | "NOT_INVITED";
};

type Errors = Partial<Record<"name" | "phone" | "licenseNo" | "licenseExpires", string>>;

const digits = (s: string) => s.replace(/\D/g, "");
const formatPhone = (d: string) => `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;

/** Customer's drivers: list, add, and send / resend the invite (local state until Supabase). */
export function DriversManager({
  initial,
  today,
  customerId,
  reqs,
  docs,
}: {
  initial: DriverRow[];
  today: string;
  customerId: string;
  /** Driver documents every contract needs (licence, ID card). */
  reqs: DocRequirement[];
  docs: CustomerDocument[];
}) {
  const docFor = (key: string, ownerId: string): CustomerDocument =>
    docs.find((d) => d.key === key && d.ownerId === ownerId) ?? { key, ownerId, status: "MISSING" };
  const [rows, setRows] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const soonLimit = (() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  })();


  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const phone = digits(String(f.get("phone") ?? ""));
    const licenseNo = digits(String(f.get("licenseNo") ?? ""));
    const licenseClass = String(f.get("licenseClass") ?? "ท.4");
    const licenseExpires = String(f.get("licenseExpires") ?? "");

    const next: Errors = {};
    if (name.split(/\s+/).length < 2) next.name = "กรอกทั้งชื่อและนามสกุล";
    if (!/^0\d{9}$/.test(phone)) next.phone = "เบอร์มือถือ 10 หลัก ขึ้นต้นด้วย 0";
    else if (rows.some((r) => digits(r.phone) === phone)) next.phone = "เบอร์นี้มีอยู่ในรายชื่อคนขับแล้ว";
    if (licenseNo.length < 8) next.licenseNo = "เลขใบขับขี่อย่างน้อย 8 หลัก";
    if (!licenseExpires) next.licenseExpires = "เลือกวันหมดอายุ";
    else if (licenseExpires <= today) next.licenseExpires = "ใบขับขี่หมดอายุแล้ว ใช้รับหางไม่ได้";
    setErrors(next);
    if (Object.keys(next).length) {
      setNotice(null);
      return;
    }

    const draft: Omit<DriverRow, "id"> = {
      name,
      phone: formatPhone(phone),
      licenseNo,
      licenseClass,
      licenseExpires,
      docStatus: "MISSING",
      account: "INVITED",
    };
    startTransition(async () => {
      const res = await addDriver({ customerId, name, phone, licenseNo, licenseClass, licenseExpires });
      if (!res.ok) {
        setNotice(null);
        return setErrors({ name: res.error });
      }
      setRows((all) => [...all, { ...draft, id: res.data?.id ?? `new-${Date.now()}` }]);
      setNotice(`เพิ่ม ${name} แล้ว · ให้คนขับสมัครที่หน้า “สมัครสมาชิก” เลือก “คนขับ” ด้วยเบอร์ ${draft.phone}`);
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
      <div className="min-w-0 space-y-4">
        {notice && (
          <p className="flex items-start gap-2 rounded-lg border-2 border-sign bg-sign-wash px-4 py-3 text-[15px] font-semibold text-sign-deep" role="status">
            <CircleCheckBig className="mt-0.5 size-5 shrink-0" aria-hidden /> {notice}
          </p>
        )}
        <Panel title="คนขับที่มารับ–คืนหางได้" flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead className="border-b border-line text-[13px] text-ink-3">
                <tr>
                  <th className="px-5 py-3 font-semibold">ชื่อ</th>
                  <th className="px-5 py-3 font-semibold">ใบขับขี่</th>
                  <th className="px-5 py-3 font-semibold">หมดอายุ</th>
                  <th className="px-5 py-3 font-semibold">เอกสาร</th>
                  <th className="px-5 py-3 font-semibold">บัญชี</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((d) => {
                  const soon = d.licenseExpires <= soonLimit;
                  return (
                    <tr key={d.id}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-[13px] text-ink-3">{d.phone}</p>
                      </td>
                      <td className="px-5 py-3.5 tabular">{d.licenseClass} · {d.licenseNo}</td>
                      <td className={cx("px-5 py-3.5", soon && "font-semibold text-warn")}>
                        {thDate(d.licenseExpires)}
                        {soon && <span className="block text-[12px]">ใกล้หมดอายุ</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex flex-col gap-1">
                          {reqs.map((r) => {
                            const st = docFor(r.key, d.id).status;
                            return (
                              <span key={r.key} className="text-[13px]">
                                {r.key === "driver_id_card" ? "บัตรประชาชน" : "ใบขับขี่"}{" "}
                                <Badge tone={docStatusTone[st]}>{docStatusLabel[st]}</Badge>
                              </span>
                            );
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {d.account === "ACTIVE" ? (
                          <Badge tone="ok">ใช้งานแล้ว</Badge>
                        ) : (
                          <span className="block text-[13px] text-ink-2">
                            <Badge tone="info">ยังไม่สมัคร</Badge>
                            <span className="mt-1 block">ให้คนขับสมัครที่เว็บ เลือก “คนขับ” ด้วยเบอร์นี้</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {rows.filter((d) => !d.id.startsWith("new-")).map((d) => (
          <Panel key={d.id} title={`เอกสารคนขับ · ${d.name}`}>
            <ul className="-my-4 divide-y divide-line">
              {reqs.map((r) => (
                <DocUploadRow key={r.key} req={r} doc={docFor(r.key, d.id)} customerId={customerId} />
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel title="เพิ่มคนขับ" className="lg:self-start">
        <form key={formKey} onSubmit={submit} noValidate className="space-y-4">
          <Field label="ชื่อ–นามสกุล">
            <input name="name" autoComplete="name" aria-invalid={!!errors.name} className={cx(inputClass, errors.name && "border-danger")} />
            {err("name")}
          </Field>
          <Field label="เบอร์มือถือ" hint="คนขับใช้เบอร์นี้สมัครและเข้าสู่ระบบ">
            <input name="phone" inputMode="tel" autoComplete="tel" placeholder="08X-XXX-XXXX" aria-invalid={!!errors.phone} className={cx(inputClass, errors.phone && "border-danger")} />
            {err("phone")}
          </Field>
          <Field label="เลขที่ใบขับขี่">
            <input name="licenseNo" inputMode="numeric" aria-invalid={!!errors.licenseNo} className={cx(inputClass, "tabular", errors.licenseNo && "border-danger")} />
            {err("licenseNo")}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ประเภทใบขับขี่">
              <select name="licenseClass" defaultValue="ท.4" className={inputClass}>
                <option>ท.2</option>
                <option>ท.3</option>
                <option>ท.4</option>
              </select>
            </Field>
            <Field label="วันหมดอายุ">
              <input name="licenseExpires" type="date" min={today} aria-invalid={!!errors.licenseExpires} className={cx(inputClass, errors.licenseExpires && "border-danger")} />
            </Field>
          </div>
          {err("licenseExpires")}
          <p className="flex items-start gap-2 rounded-lg bg-ground p-3 text-[14px] text-ink-2">
            <Upload className="mt-0.5 size-4 shrink-0 text-grass" aria-hidden />
            หลังเพิ่มคนขับ อัปโหลดสำเนาใบขับขี่และสำเนาบัตรประชาชนของคนขับได้ในส่วน “เอกสารคนขับ”
          </p>
          <Button type="submit" variant="sign" className="w-full" disabled={pending}>
            <Send className="size-4" aria-hidden /> {pending ? "กำลังบันทึก…" : "เพิ่มคนขับ"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
