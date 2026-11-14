import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { getSession } from "@/lib/session";
import { buildStore, type Store } from "./build-store";
import { getReference } from "./reference";
import { loadSupabaseStore } from "./supabase-store";

export type { Store } from "./build-store";

/** Everything the current request may read from Supabase, filtered by the signed-in user's RLS. */
export const getStore = cache(async (): Promise<Store> => {
  await connection();
  const [session, ref] = await Promise.all([getSession(), getReference()]);
  return buildStore(await loadSupabaseStore(session, ref));
});

/** For customer pages: the store, or a redirect to sign-in when nobody (or a non-customer) is signed in. */
export async function getCustomerStore(next = "/me/bookings") {
  const db = await getStore();
  if (!db.currentCustomerId) {
    const { redirect } = await import("next/navigation");
    redirect(db.role === "SUPER_ADMIN" ? "/admin/view-as" : db.role ? "/" : `/login?next=${encodeURIComponent(next)}`);
  }
  return db as Store & { currentCustomerId: string };
}

/** For driver pages: the store, or a redirect to sign-in. */
export async function getDriverStore() {
  const db = await getStore();
  if (!db.currentDriverId) {
    const { redirect } = await import("next/navigation");
    redirect(db.role === "SUPER_ADMIN" ? "/admin/view-as" : db.role ? "/" : "/login?next=/driver");
  }
  return db as Store & { currentDriverId: string };
}
