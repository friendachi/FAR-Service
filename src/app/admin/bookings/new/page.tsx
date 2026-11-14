import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking-wizard";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/ui";
import { can, staffRole } from "@/lib/admin";
import { getStore } from "@/lib/data/store";

export const instant = false;

export const metadata: Metadata = { title: "จองแทนลูกค้า" };

export default async function NewBookingForCustomer() {
  if (!(await can("SUPER_ADMIN", "SALES"))) return <NoAccess need="Super Admin และ Sales / CS" />;
  const role = (await staffRole()) as "SUPER_ADMIN" | "SALES";
  return (
    <>
      <PageHeader
        title="จองแทนลูกค้า"
        sub="ใช้กฎหางว่าง ราคา และเงื่อนไขเดียวกับที่ลูกค้าจองเอง พนักงานแก้ราคาหรือให้ส่วนลดไม่ได้"
      />
      <BookingWizard data={(await getStore()).wizardData()} staffRole={role} />
    </>
  );
}
