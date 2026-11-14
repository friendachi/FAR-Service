import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, Menu, Phone, UserRound } from "lucide-react";
import { buttonClass, cx } from "./ui";
import { telHref } from "@/lib/company";
import { getReference } from "@/lib/data/reference";
import { FacebookIcon, LineIcon } from "./brand-icons";
import { LineQrButton } from "./line-qr-button";
import { FestivalIcon } from "./festival";
import { getRole, roleHome, roleLabel } from "@/lib/session";
import { LangSwitch } from "./lang";
import { SignOutButton } from "./sign-out-button";
import { T } from "./t";
import { MobileMenu } from "./mobile-menu";

const nav = [
  { href: "/about", th: "เกี่ยวกับเรา", en: "About us" },
  { href: "/trailers", th: "หางให้เช่า", en: "Our trailers" },
  { href: "/services", th: "บริการเสริม", en: "Extra services" },
  { href: "/yards", th: "ลานจอด", en: "Yards" },
  { href: "/knowledge", th: "สาระน่ารู้", en: "Know-how" },
  { href: "/documents", th: "เอกสารทำสัญญา", en: "Documents" },
  { href: "/contact", th: "ติดต่อเรา", en: "Contact" },
];

/** The company logo (public/brand/far-logo.png). On coloured grounds it sits on a white plate, as on the business card. */
export function Wordmark({ className = "", plate = false }: { className?: string; plate?: boolean }) {
  return (
    <span className={`inline-flex items-center ${plate ? "rounded-md bg-white px-2 py-1" : ""} ${className}`}>
      <Image src="/brand/far-logo.png" alt="FAR Service" width={1063} height={591} priority className="h-10 w-auto" />
    </span>
  );
}

/** Staff only: the public site has no customer accounts; staff sign in from the footer link. */
async function AccountLink() {
  const role = await getRole();
  if (!role) return null;
  return (
    <>
      <Link
        href={roleHome[role]}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/80 px-2.5 text-[13px] font-semibold text-white hover:bg-white/15"
      >
        <UserRound className="size-3.5" aria-hidden />
        <span className="hidden sm:inline"><T th="หน้าของฉัน" en="My page" /> ·</span> {roleLabel[role]}
      </Link>
      <SignOutButton
        iconOnly
        label="ออกจากระบบ · Sign out"
        className="h-7 justify-center rounded-md px-2 text-[13px] text-white hover:bg-white/15"
      />
    </>
  );
}


export async function SiteHeader() {
  const { company: c, festival } = await getReference();
  return (
    <header className="sticky top-0 z-30 bg-paper text-on-sign shadow-[0_2px_10px_-6px_rgba(0,0,0,0.3)]">
      {/* top strip: phone, email, language (and the staff account when signed in) */}
      <div className="bg-sign-deep text-white">
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-4 px-4 text-[13px] sm:px-6 lg:px-8">
          <a href={telHref(c.phone)} className="flex items-center gap-1.5 hover:underline">
            <Phone className="size-3.5" aria-hidden />
            <span className="hidden sm:inline"><T th="ติดต่อสอบถาม" en="Contact us" /></span>
            <span className="font-route font-extrabold tabular">{c.phone}</span>
          </a>
          {festival ? (
            <span className="hidden min-w-0 items-center gap-1.5 truncate font-semibold md:flex">
              <FestivalIcon festival={festival} className="size-4 shrink-0" />
              <span className="truncate"><T th={festival.greetingTh} en={festival.greetingEn} /></span>
            </span>
          ) : (
            <a href={`mailto:${c.email}`} className="hidden truncate hover:underline md:block">{c.email}</a>
          )}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LangSwitch onDark />
            <Suspense fallback={null}>
              <AccountLink />
            </Suspense>
          </div>
        </div>
      </div>

      {/* main bar: logo, menu, contact */}
      <div className="border-b-[3px] border-sign">
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-4 sm:px-6 md:gap-6 lg:px-8">
          <Link href="/" aria-label="FAR Service หน้าแรก · Home" className="flex shrink-0 items-center gap-3">
            <Wordmark />
            <span className="hidden leading-tight xl:block">
              <span className="block text-[15px] font-bold text-ink">farservice</span>
              <span className="block text-[11px] tracking-[0.12em] text-ink-3">TRAILER RENTAL</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-[15px] lg:flex xl:gap-6 xl:text-[16px]" aria-label="เมนูหลัก · Main menu">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="font-semibold text-ink hover:text-reflect">
                <T th={n.th} en={n.en} />
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LineQrButton className="shrink-0">
              <LineIcon className="size-8 sm:size-9" />
            </LineQrButton>
            <a href={c.facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook" className="shrink-0">
              <FacebookIcon className="size-8 sm:size-9" />
            </a>
            <Link href="/quote" className={cx(buttonClass("primary", "md"), "hidden whitespace-nowrap sm:inline-flex")}>
              <FileText className="size-4" aria-hidden />
              <T th="ขอใบเสนอราคา" en="Get a quote" />
            </Link>
            <MobileMenu
              className="relative lg:hidden"
              summary={<summary
                className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg bg-reflect text-white [&::-webkit-details-marker]:hidden"
                aria-label="เปิดเมนู · Menu"
              >
                <Menu className="size-5" aria-hidden />
              </summary>}
            >
              <nav className="absolute right-0 top-12 w-60 rounded-xl border border-line bg-paper p-2 text-ink shadow-[0_12px_32px_-12px_rgba(0,59,32,0.35)]">
                <Link href="/quote" className={cx(buttonClass("primary", "md"), "mb-1 w-full")}>
                  <T th="ขอใบเสนอราคา" en="Get a quote" />
                </Link>
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2.5 hover:bg-sign-wash">
                    <T th={n.th} en={n.en} />
                  </Link>
                ))}
              </nav>
            </MobileMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
