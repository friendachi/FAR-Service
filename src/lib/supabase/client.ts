"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

/** Browser client — used for direct file uploads to Storage. */
export function createClient() {
  return createBrowserClient(requireSupabaseEnv().url, requireSupabaseEnv().key);
}
