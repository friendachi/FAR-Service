// Creates (or resets the PIN of) a staff account that signs in with mobile number + PIN/password.
//
//   STAFF_PHONE=0922656987 STAFF_PIN='...' STAFF_ROLE=SUPER_ADMIN STAFF_NAME='ชื่อ' node scripts/create-staff.mjs
//
// The PIN/password is read from the environment only — never commit it.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const phone = (process.env.STAFF_PHONE ?? "").replace(/\D/g, "");
const pin = process.env.STAFF_PIN ?? "";
const role = process.env.STAFF_ROLE ?? "SUPER_ADMIN";
const name = process.env.STAFF_NAME ?? "Super Admin";
if (!/^0\d{9}$/.test(phone)) throw new Error("STAFF_PHONE ต้องเป็นเบอร์มือถือ 10 หลัก");
if (pin.length < 6) throw new Error("STAFF_PIN อย่างน้อย 6 ตัว");
if (!["SUPER_ADMIN", "SALES", "OPS"].includes(role)) throw new Error("STAFF_ROLE ไม่ถูกต้อง");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `${phone}@phone.farservice.app`;

const { data: existing } = await sb.from("profiles").select("id, role").eq("phone", phone).maybeSingle();
let id = existing?.id;
if (id) {
  const { error } = await sb.auth.admin.updateUserById(id, { password: pin, app_metadata: { role } });
  if (error) throw error;
  console.log("มีบัญชีอยู่แล้ว · ตั้ง PIN/รหัสผ่านใหม่และบทบาท", role);
} else {
  const { data, error } = await sb.auth.admin.createUser({
    email, password: pin, email_confirm: true, app_metadata: { role }, user_metadata: { full_name: name, phone },
  });
  if (error) throw error;
  id = data.user.id;
  console.log("สร้างบัญชีใหม่", role);
}
const { error: pErr } = await sb.from("profiles").update({ role, phone, full_name: name, is_active: true }).eq("id", id);
if (pErr) throw pErr;
const { data: check } = await sb.from("profiles").select("role, phone, full_name, is_active").eq("id", id).single();
console.log(check);
