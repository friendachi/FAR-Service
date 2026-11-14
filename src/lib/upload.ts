"use client";

import { createClient } from "./supabase/client";

/** Uploads a file or blob to a private bucket and returns its storage path. */
export async function uploadTo(bucket: string, path: string, body: Blob, contentType: string) {
  const { error } = await createClient().storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
  return path;
}
