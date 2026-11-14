import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { T } from "@/components/t";

export const metadata: Metadata = { title: "เข้าสู่ระบบพนักงาน · Staff sign-in" };
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const n = (await searchParams).next;
  const next = typeof n === "string" ? n : undefined;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <section>
        <h1 className="text-[30px] font-bold"><T th="เข้าสู่ระบบสำหรับพนักงาน" en="Staff sign-in" /></h1>
        <LoginForm next={next} />
        <p className="mt-6 text-[15px] text-ink-2">
          <T th="ลูกค้าที่ต้องการเช่าหาง" en="Looking to rent a trailer?" />{" "}
          <Link href="/quote" className="font-semibold text-grass underline">
            <T th="ขอใบเสนอราคาได้ที่นี่" en="Request a quotation here" />
          </Link>
        </p>
      </section>
    </div>
  );
}
