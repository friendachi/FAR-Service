"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { VIEW_AS_CUSTOMER, VIEW_AS_DRIVER } from "@/lib/view-as";

const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 };

async function requireSuperAdmin() {
  if ((await getSession()).role !== "SUPER_ADMIN") throw new Error("เฉพาะ Super Admin");
}

export async function viewAsCustomer(customerId: string) {
  await requireSuperAdmin();
  (await cookies()).set(VIEW_AS_CUSTOMER, customerId, opts);
  redirect("/me/bookings");
}

export async function viewAsDriver(driverId: string) {
  await requireSuperAdmin();
  (await cookies()).set(VIEW_AS_DRIVER, driverId, opts);
  redirect("/driver");
}

export async function stopViewAs() {
  const jar = await cookies();
  jar.delete(VIEW_AS_CUSTOMER);
  jar.delete(VIEW_AS_DRIVER);
  redirect("/admin/view-as");
}
