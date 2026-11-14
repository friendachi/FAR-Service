// Loads the sample business data (staff, customers, drivers, tractors, documents, bookings) into Supabase.
// Reference data (yards, trailer types, trailers, settings) comes from supabase/seed.sql — run that first.
//
//   node scripts/seed-sample.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. Runs once; it stops if the
// sample bookings already exist. All accounts share the password printed at the end — change them.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) throw new Error("ต้องมี NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local");

const PASSWORD = process.env.SAMPLE_PASSWORD ?? "FarService#2569";
const sb = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};
const ts = (s) => `${s}:00+07:00`;

// ---------------------------------------------------------------- guard
const existing = must(await sb.from("customers").select("id").eq("tax_id", "0205561000000"), "check");
if (existing.length) {
  console.log("ข้อมูลตัวอย่างมีอยู่แล้ว ไม่ได้เพิ่มซ้ำ");
  process.exit(0);
}

// ---------------------------------------------------------------- reference rows from seed.sql
const yards = Object.fromEntries(must(await sb.from("yards").select("id, code"), "yards").map((y) => [y.code, y.id]));
if (!yards.BP) throw new Error("ยังไม่ได้รัน supabase/seed.sql");

// ---------------------------------------------------------------- auth users
// Accounts sign in with their mobile number; the auth email is derived from it (see src/lib/phone-auth.ts).
async function user(email, appRole, meta) {
  const res = await sb.auth.admin.createUser({
    email: `${meta.phone}@phone.farservice.app`,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: appRole },
    user_metadata: meta,
  });
  if (res.error) throw new Error(`user ${email}: ${res.error.message}`);
  return res.data.user.id;
}

console.log("สร้างบัญชีพนักงาน…");
const sa = await user("admin@example.com", "SUPER_ADMIN", { full_name: "วิไล (ผู้บริหาร)", phone: "0900000001" });
const sales = await user("sales@example.com", "SALES", { full_name: "นก (ฝ่ายขาย)", phone: "0900000002" });
const ops = await user("ops@example.com", "OPS", { full_name: "เอก (หัวหน้าลานบางพระ)", phone: "0900000003" });
must(await sb.from("profiles").update({ home_yard_id: yards.BP }).eq("id", ops), "ops yard");

console.log("สร้างบัญชีลูกค้า…");
const customersSrc = [
  { key: "cu-01", email: "customer1@example.com", kind: "COMPANY", name: "บริษัท ตัวอย่างขนส่ง จำกัด", tax: "0205561000000",
    contact: "สมชาย ใจดี", phone: "0810000001", address: "99/1 ม.3 ต.ทุ่งสุขลา อ.ศรีราชา จ.ชลบุรี 20230" },
  { key: "cu-02", email: "customer2@example.com", kind: "PERSON", name: "นายวิชัย ทดสอบ", tax: "3200100000000",
    contact: "วิชัย ทดสอบ", phone: "0890000002", address: "12 ม.5 ต.หนองขาม อ.ศรีราชา จ.ชลบุรี 20110" },
  { key: "cu-03", email: "customer3@example.com", kind: "COMPANY", name: "บริษัท สมมติโลจิสติกส์ จำกัด", tax: "0215560000000",
    contact: "อรุณี ตัวอย่าง", phone: "0860000003", address: "8 ถ.สุขุมวิท ต.มาบตาพุด อ.เมือง จ.ระยอง 21150" },
];
const cust = {};
const owner = {};
for (const c of customersSrc) {
  owner[c.key] = await user(c.email, "CUSTOMER", {
    full_name: c.contact, customer_kind: c.kind, customer_name: c.name, tax_id: c.tax, phone: c.phone,
  });
  const row = must(await sb.from("customers").select("id").eq("tax_id", c.tax).single(), "customer");
  must(await sb.from("customers").update({ billing_address: c.address, contact_name: c.contact }).eq("id", row.id), "customer addr");
  cust[c.key] = row.id;
}

console.log("ผู้ค้ำ หัวลาก คนขับ…");
const gu = {};
for (const [k, c, name, rel, phone] of [
  ["gu-01", "cu-01", "สมชาย ใจดี (กรรมการ)", "DIRECTOR", "0810000001"],
  ["gu-02", "cu-02", "นางสมศรี ทดสอบ", "OTHER", "0890000009"],
  ["gu-03", "cu-03", "อรุณี ตัวอย่าง (กรรมการ)", "DIRECTOR", "0860000003"],
]) {
  gu[k] = must(await sb.from("guarantors").insert({ customer_id: cust[c], full_name: name, relation: rel, phone }).select("id").single(), "guarantor").id;
}
const hd = {};
for (const [k, c, plate, prov, brand] of [
  ["hd-01", "cu-01", "70-5501", "ชลบุรี", "Hino"],
  ["hd-02", "cu-01", "70-5502", "ชลบุรี", "Isuzu"],
  ["hd-03", "cu-02", "71-1234", "ระยอง", "Volvo"],
  ["hd-04", "cu-03", "70-8899", "ชลบุรี", "Scania"],
]) {
  hd[k] = must(
    await sb.from("tractors").insert({ customer_id: cust[c], plate_no: plate, province: prov, brand, kind: "หัวลาก 10 ล้อ" }).select("id").single(),
    "tractor",
  ).id;
}
const dr = {};
for (const [k, name, phone, lic, cls, exp, customers, email] of [
  ["dr-01", "แดง มีสุข", "0820001001", "62001234", "ท.4", "2028-03-14", ["cu-01"], "driver1@example.com"],
  ["dr-02", "ประเสริฐ ขับดี", "0820001002", "61005678", "ท.3", "2026-12-02", ["cu-01", "cu-03"], "driver2@example.com"],
  ["dr-03", "วิชัย ทดสอบ", "0890000002", "60009876", "ท.4", "2029-07-30", ["cu-02"], null],
]) {
  dr[k] = must(
    await sb.from("drivers").insert({ full_name: name, phone, license_no: lic, license_class: cls, license_expires_on: exp }).select("id").single(),
    "driver",
  ).id;
  for (const c of customers) {
    must(await sb.from("customer_drivers").insert({ customer_id: cust[c], driver_id: dr[k], added_by: owner[c] }), "link");
  }
  if (email) {
    // handle_new_user links the driver row by phone
    await user(email, "DRIVER", { full_name: name, phone });
  } else {
    must(
      await sb.from("invites").insert({
        kind: "DRIVER", customer_id: cust[customers[0]], driver_id: dr[k], phone,
        token_hash: crypto.randomUUID().replaceAll("-", ""), invited_by: owner[customers[0]],
      }),
      "invite",
    );
  }
}

console.log("เอกสาร…");
const placeholder = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj " +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj " +
    "4 0 obj<</Length 44>>stream\nBT /F1 14 Tf 20 60 Td (SAMPLE DOCUMENT) Tj ET\nendstream endobj " +
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);
const docs = [
  ["company_cert", "customer_id", cust["cu-01"], "cu-01", "APPROVED", "หนังสือรับรอง_ต.ค.69.pdf", "2027-01-28", null],
  ["pp20", "customer_id", cust["cu-01"], "cu-01", "APPROVED", "ภพ20.pdf", null, null],
  ["director_id", "guarantor_id", gu["gu-01"], "cu-01", "REJECTED", "บัตรกรรมการ.pdf", null,
    "มีตราบริษัทประทับทับ — ต้องเซ็นรับรองสำเนาโดยไม่ประทับตรา"],
  ["director_house", "guarantor_id", gu["gu-01"], "cu-01", "PENDING", "ทะเบียนบ้านกรรมการ.pdf", null, null],
  ["tractor_book", "tractor_id", hd["hd-01"], "cu-01", "APPROVED", "เล่ม_70-5501.pdf", null, null],
  ["tractor_policy", "tractor_id", hd["hd-01"], "cu-01", "PENDING", "กรมธรรม์_70-5501.pdf", "2027-05-01", null],
  ["driver_license", "driver_id", dr["dr-01"], "cu-01", "APPROVED", "ใบขับขี่_แดง.pdf", "2028-03-14", null],
  ["driver_license", "driver_id", dr["dr-02"], "cu-01", "PENDING", "ใบขับขี่_ประเสริฐ.pdf", "2026-12-02", null],
];
for (const [key, col, id, folder, status, name, exp, note] of docs) {
  const path = `${cust[folder]}/${key}/${crypto.randomUUID()}.pdf`;
  must(await sb.storage.from("documents").upload(path, placeholder, { contentType: "application/pdf" }), "upload");
  must(
    await sb.from("documents").insert({
      requirement_key: key, [col]: id, storage_path: path, file_name: name, mime_type: "application/pdf",
      size_bytes: placeholder.length, status, expires_on: exp, reject_reason: note, uploaded_by: owner[folder],
      reviewed_by: status === "PENDING" ? null : sales, reviewed_at: status === "PENDING" ? null : new Date().toISOString(),
    }),
    "document",
  );
}

// Sample bookings were removed when the real fleet replaced the sample trailers (scripts/load-fleet.mjs).

console.log(`
เสร็จแล้ว บัญชีทั้งหมดใช้รหัสผ่าน: ${PASSWORD}
เข้าสู่ระบบด้วยเบอร์มือถือ:
  Super Admin  090-000-0001
  Sales / CS   090-000-0002
  Staff (Ops)  090-000-0003
  ลูกค้า        081-000-0001 · 089-000-0002 · 086-000-0003
  คนขับ         082-000-1001 · 082-000-1002
`);
