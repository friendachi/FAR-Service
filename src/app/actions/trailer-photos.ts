"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorText, type ActionResult } from "./result";

/* Staff (any role) add, reorder and remove a trailer's photos. Files go to the public "trailer-photos" bucket. */

async function staff() {
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  const { data: p } = await sb.from("profiles").select("role").eq("id", u.user?.id ?? "").maybeSingle();
  return p && ["SUPER_ADMIN", "SALES", "OPS"].includes(p.role) ? sb : null;
}
const NO = { ok: false as const, error: "แก้ไขรูปได้เฉพาะพนักงาน" };
const refresh = (trailerId: string) => {
  revalidatePath(`/trailers/${trailerId}`);
  revalidatePath("/trailers");
  revalidatePath("/");
  revalidatePath("/admin/trailers");
};

/** Records photos already uploaded to storage (paths "<trailerId>/<uuid>.jpg"). */
export async function addTrailerPhotos(trailerId: string, paths: string[]): Promise<ActionResult> {
  const sb = await staff();
  if (!sb) return NO;
  if (!paths.length || paths.some((p) => !p.startsWith(`${trailerId}/`))) return { ok: false, error: "ไฟล์ไม่ถูกต้อง" };
  const { count } = await sb.from("trailer_photos").select("id", { count: "exact", head: true }).eq("trailer_id", trailerId);
  const start = count ?? 0;
  const { error } = await sb
    .from("trailer_photos")
    .insert(paths.map((storage_path, i) => ({ trailer_id: trailerId, storage_path, sort_order: start + i })));
  if (error) return { ok: false, error: errorText(error) };
  refresh(trailerId);
  return { ok: true, message: `เพิ่มรูปแล้ว ${paths.length} รูป` };
}

export async function deleteTrailerPhoto(trailerId: string, photoId: string): Promise<ActionResult> {
  const sb = await staff();
  if (!sb) return NO;
  const { data: row } = await sb.from("trailer_photos").select("storage_path").eq("id", photoId).eq("trailer_id", trailerId).maybeSingle();
  if (!row) return { ok: false, error: "ไม่พบรูปนี้" };
  const { error } = await sb.from("trailer_photos").delete().eq("id", photoId);
  if (error) return { ok: false, error: errorText(error) };
  await sb.storage.from("trailer-photos").remove([row.storage_path]);
  refresh(trailerId);
  return { ok: true, message: "ลบรูปแล้ว" };
}

/** Makes one photo the main (first) photo; the rest keep their order. */
export async function setMainTrailerPhoto(trailerId: string, photoId: string): Promise<ActionResult> {
  const sb = await staff();
  if (!sb) return NO;
  const { data } = await sb.from("trailer_photos").select("id").eq("trailer_id", trailerId).order("sort_order").order("created_at");
  const ids = (data ?? []).map((r) => r.id);
  if (!ids.includes(photoId)) return { ok: false, error: "ไม่พบรูปนี้" };
  const order = [photoId, ...ids.filter((i) => i !== photoId)];
  for (const [i, id] of order.entries()) {
    const { error } = await sb.from("trailer_photos").update({ sort_order: i }).eq("id", id);
    if (error) return { ok: false, error: errorText(error) };
  }
  refresh(trailerId);
  return { ok: true, message: "ตั้งเป็นรูปหลักแล้ว" };
}
