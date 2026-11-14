import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- Route shield: the yard's number, drawn like a highway route marker ---------- */

export function YardShield({
  n,
  size = 40,
  inverse = false,
  className,
}: {
  n: 1 | 2 | number;
  size?: number;
  inverse?: boolean;
  className?: string;
}) {
  const fill = inverse ? "var(--color-sign)" : "#fff";
  const stroke = inverse ? "#fff" : "var(--color-sign)";
  const text = inverse ? "var(--color-on-sign)" : "var(--color-grass)";
  return (
    <svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 40 44"
      aria-label={`ลานจอดหมายเลข ${n}`}
      role="img"
      className={cx("shrink-0", className)}
    >
      <path
        d="M4 3h32a1 1 0 0 1 1 1v16c0 11-8 17.5-17 21C11 37.5 3 31 3 20V4a1 1 0 0 1 1-1z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontFamily="var(--font-overpass)"
        fontWeight="800"
        fontSize="20"
        fill={text}
      >
        {n}
      </text>
    </svg>
  );
}

/* ---------- Status badge ---------- */

const toneClass: Record<Tone, string> = {
  ok: "bg-sign-tint text-sign-deep",
  info: "bg-info-tint text-info",
  warn: "bg-warn-tint text-warn",
  danger: "bg-danger-tint text-danger",
  muted: "bg-muted-tint text-ink-2",
  action: "bg-reflect-tint text-reflect",
};

const dotClass: Record<Tone, string> = {
  ok: "bg-sign",
  info: "bg-info",
  warn: "bg-warn",
  danger: "bg-danger",
  muted: "bg-ink-3",
  action: "bg-reflect",
};

export function Badge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold",
        toneClass[tone],
        className,
      )}
    >
      <span aria-hidden className={cx("size-1.5 rounded-full", dotClass[tone])} />
      {children}
    </span>
  );
}

/* ---------- Buttons ---------- */

type Variant = "primary" | "sign" | "outline" | "ghost" | "danger" | "onSign";

const variantClass: Record<Variant, string> = {
  primary: "bg-reflect text-white hover:bg-reflect-hover",
  sign: "bg-sign text-on-sign hover:bg-sign-hover",
  outline: "border-2 border-sign text-grass bg-paper hover:bg-sign-wash",
  ghost: "text-grass hover:bg-sign-wash",
  danger: "border-2 border-danger text-danger bg-paper hover:bg-danger-tint",
  onSign: "border-2 border-on-sign text-on-sign hover:bg-white/20",
};

const sizeClass = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-6 text-base",
  sm: "h-9 px-3.5 text-sm",
};

export function buttonClass(variant: Variant = "sign", size: keyof typeof sizeClass = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
    variantClass[variant],
    sizeClass[size],
  );
}

export function Button({
  variant = "sign",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizeClass }) {
  return <button {...props} className={cx(buttonClass(variant, size), className)} />;
}

export function LinkButton({
  variant = "sign",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizeClass }) {
  return <Link {...props} className={cx(buttonClass(variant, size), className)} />;
}

/* ---------- Form fields ---------- */

export const inputClass =
  "h-12 w-full rounded-lg border-2 border-line bg-paper px-3.5 text-[15px] text-ink placeholder:text-ink-3 hover:border-line-strong focus:border-sign focus:outline-none";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] text-ink-3">{hint}</span>}
    </label>
  );
}

/* ---------- Layout bits ---------- */

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{title}</h1>
        {sub && <p className="mt-1.5 text-[15px] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  flush = false,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={cx("rounded-xl border border-line bg-paper", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[17px] font-bold text-ink">{title}</h2>
          {actions}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-[max-content_1fr]">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Honest placeholder for company photos that will be supplied later. */
/** A real photo, or the placeholder slot when there is none yet. */
export function Photo({
  src,
  alt,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) return <PhotoSlot label={alt} className={className} />;
  return (
    <div data-photo className={cx("relative overflow-hidden rounded-lg bg-sign-wash", className)}>
      <Image src={src} alt={alt} fill sizes={sizes} loading={priority ? "eager" : undefined} fetchPriority={priority ? "high" : undefined} className="object-cover" />
    </div>
  );
}

export function PhotoSlot({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cx(
        "flex items-end rounded-lg border border-dashed border-line-strong bg-sign-wash p-3 text-[13px] text-ink-3",
        className,
      )}
    >
      <span>
        <span className="font-semibold text-ink-2">{label}</span>
        <br />
        พื้นที่รูปถ่ายจริงของบริษัท (รอไฟล์)
      </span>
    </div>
  );
}

