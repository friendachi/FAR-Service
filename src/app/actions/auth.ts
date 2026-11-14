"use server";

import { redirect } from "next/navigation";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone-auth";
import { getSession, roleHome } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorText, type ActionResult } from "./result";

/**
 * Sign the browser in as an existing auth user without a password: the server mints a one-time magic-link
 * token with the service-role client and redeems it immediately, so nothing is sent by email or SMS.
 */
async function startSession(authEmail: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: authEmail });
  if (error || !data.properties?.hashed_token) return false;
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "email", token_hash: data.properties.hashed_token });
  return !verifyError;
}

const STAFF_ROLES = ["SUPER_ADMIN", "SALES", "OPS"];

/**
 * Sign-in with the mobile number. Customers and drivers need nothing else (no password, no OTP) — as the
 * business asked. Staff accounts also need their PIN (stored as the Supabase password).
 */
export async function signIn(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, error: "กรอกเบอร์มือถือ 10 หลัก · Enter a 10-digit mobile number" };
  const pin = String(formData.get("pin") ?? "");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, role").eq("phone", phone).limit(1).maybeSingle();
  if (!profile) return { ok: false, error: "ไม่พบบัญชีของเบอร์นี้ กรุณาสมัครสมาชิก · No account for this number — please register" };
  const { data: u } = await admin.auth.admin.getUserById(profile.id);
  const authEmail = u.user?.email ?? phoneToAuthEmail(phone);

  if (STAFF_ROLES.includes(profile.role)) {
    if (!pin) return { ok: false, needPin: true, error: "บัญชีพนักงาน กรอก PIN 6 หลักเพื่อเข้าสู่ระบบ · Staff account — enter your 6-digit PIN" };
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: pin });
    if (error) return { ok: false, needPin: true, error: "PIN ไม่ถูกต้อง · Wrong PIN" };
  } else if (!(await startSession(authEmail))) {
    return { ok: false, error: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ · Sign-in failed, please try again" };
  }

  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
  const session = await getSession();
  redirect(session.role ? roleHome[session.role] : "/");
}

/**
 * Sign-up with the mobile number only (the auth user gets a random password nobody uses).
 * Customers (นิติบุคคล / บุคคลธรรมดา) create their customer record. Drivers can register only with the
 * mobile number a customer already added to their account.
 */
export async function signUp(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const kindRaw = String(formData.get("kind"));
  const kind = kindRaw === "PERSON" || kindRaw === "DRIVER" ? kindRaw : "COMPANY";
  const name = String(formData.get("name") ?? "").trim();
  const taxId = String(formData.get("taxId") ?? "").replace(/\D/g, "");
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const email = String(formData.get("email") ?? "").trim();
  if (!name) return { ok: false, error: kind === "DRIVER" ? "กรอกชื่อ–นามสกุล · Enter your full name" : "กรอกชื่อบริษัท หรือชื่อ–นามสกุล · Enter the company or full name" };
  if (!phone) return { ok: false, error: "เบอร์มือถือ 10 หลัก ขึ้นต้นด้วย 0 · Mobile number: 10 digits starting with 0" };
  if (kind !== "DRIVER" && !/^\d{13}$/.test(taxId)) return { ok: false, error: "เลขผู้เสียภาษี / เลขบัตรประชาชนต้องมี 13 หลัก · Tax ID / national ID must be 13 digits" };
  if (email && !email.includes("@")) return { ok: false, error: "อีเมลไม่ถูกต้อง (เว้นว่างได้) · Invalid email (or leave it empty)" };
  if (formData.get("pdpa") !== "on") return { ok: false, error: "กรุณายอมรับเงื่อนไขและนโยบายความเป็นส่วนตัว · Please accept the terms and privacy policy" };

  const admin = createAdminClient();
  const { data: taken } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (taken) return { ok: false, error: "เบอร์นี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ · This number already has an account — please sign in" };

  let driverId: string | null = null;
  if (kind === "DRIVER") {
    const { data: d } = await admin.from("drivers").select("id, profile_id").eq("phone", phone).maybeSingle();
    if (!d) return { ok: false, error: "ไม่พบเบอร์นี้ในรายชื่อคนขับ ให้ผู้เช่าเพิ่มคุณในหน้า คนขับ ก่อน · This number is not on any driver list — ask the renter to add you first" };
    if (d.profile_id) return { ok: false, error: "เบอร์นี้มีบัญชีคนขับแล้ว กรุณาเข้าสู่ระบบ · This number already has a driver account — please sign in" };
    driverId = d.id;
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: phoneToAuthEmail(phone),
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
    app_metadata: kind === "DRIVER" ? { role: "DRIVER" } : {},
    user_metadata:
      kind === "DRIVER"
        ? { full_name: name, phone }
        : {
            full_name: name,
            customer_kind: kind,
            customer_name: name,
            tax_id: taxId,
            phone,
            marketing_consent: formData.get("marketing") === "on",
          },
  });
  if (error) return { ok: false, error: errorText(error) };
  const uid = created.user.id;

  // keep the real contact email (optional) instead of the internal sign-in address
  await admin.from("profiles").update({ email: email || null, phone, ...(kind === "DRIVER" ? { role: "DRIVER" } : {}) }).eq("id", uid);
  if (kind === "DRIVER") {
    await admin.from("drivers").update({ profile_id: uid }).eq("id", driverId!);
    await admin.from("invites").update({ accepted_at: new Date().toISOString() }).eq("driver_id", driverId!).is("accepted_at", null);
  } else {
    await admin.from("customers").update({ email: email || null, phone }).eq("owner_id", uid);
  }

  if (!(await startSession(phoneToAuthEmail(phone)))) return { ok: true, message: "สมัครเรียบร้อย กรุณาเข้าสู่ระบบด้วยเบอร์มือถือ · Registered — please sign in with your mobile number" };
  redirect(kind === "DRIVER" ? "/driver" : "/me/documents");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
