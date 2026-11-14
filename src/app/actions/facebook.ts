"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { articleBySlug } from "@/lib/articles";
import { postArticle } from "@/lib/facebook";
import type { ActionResult } from "./result";

export async function postArticleNow(slug: string): Promise<ActionResult> {
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  const { data: p } = await sb.from("profiles").select("role").eq("id", u.user?.id ?? "").maybeSingle();
  if (p?.role !== "SUPER_ADMIN" && p?.role !== "SALES") return { ok: false, error: "เฉพาะ Super Admin และ Sales" };
  const a = articleBySlug(slug);
  if (!a) return { ok: false, error: "ไม่พบบทความ" };
  const r = await postArticle(a);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/knowledge");
  return { ok: true, message: "โพสต์ลง Facebook แล้ว" };
}
