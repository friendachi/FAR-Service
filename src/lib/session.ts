import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Role } from "./types";

export const roleLabel: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  SALES: "Sales / CS",
  OPS: "Staff (Ops)",
  CUSTOMER: "ลูกค้า",
  DRIVER: "คนขับ",
};

export const roleHome: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  SALES: "/admin/bookings",
  OPS: "/admin/yard",
  CUSTOMER: "/me/bookings",
  DRIVER: "/driver",
};

export type Session = { userId: string | null; role: Role | null; name: string | null };

/** The signed-in Supabase user and their profile (role, name). */
export const getSession = cache(async (): Promise<Session> => {
  await connection(); // per-request: reads the auth cookie and the clock
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { userId: null, role: null, name: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile?.is_active) return { userId: data.user.id, role: null, name: null };
  return { userId: data.user.id, role: profile.role as Role, name: profile.full_name };
});

export async function getRole(): Promise<Role | null> {
  return (await getSession()).role;
}
