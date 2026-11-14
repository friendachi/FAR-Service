import { Droplets, Flame, Ghost, HardHat, Heart, Leaf, Moon, MoonStar, PartyPopper, Sparkles, TreePine, Trees } from "lucide-react";
import type { Festival, FestivalIcon as IconId } from "@/lib/festivals";
import { KrathongIcon } from "./krathong";
import { T } from "./t";

const icons: Record<Exclude<IconId, "krathong">, typeof Moon> = {
  party: PartyPopper,
  sparkles: Sparkles,
  trees: Trees,
  droplets: Droplets,
  hardhat: HardHat,
  leaf: Leaf,
  flame: Flame,
  heart: Heart,
  moon: Moon,
  ghost: Ghost,
  moonstar: MoonStar,
  tree: TreePine,
};

export function FestivalIcon({ festival, className = "size-4" }: { festival: Festival; className?: string }) {
  if (festival.icon === "krathong") return <KrathongIcon className={className} />;
  const Icon = icons[festival.icon];
  return <Icon className={className} aria-hidden />;
}

/** Greeting card on the home banner. */
export function FestivalBadge({ festival }: { festival: Festival }) {
  return (
    <div
      className="inline-flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-white shadow-[0_10px_28px_-12px_rgba(0,0,0,0.7)]"
      style={{ background: festival.color, boxShadow: "inset 0 0 0 2px #000" }}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full" style={festival.icon === "krathong" ? { background: "#1c1d2b" } : { background: festival.accent, color: festival.color }}>
        <FestivalIcon festival={festival} className={festival.icon === "krathong" ? "h-9 w-10" : "size-5"} />
      </span>
      <span className="leading-snug">
        <span className="block text-[13px] font-semibold opacity-90"><T th={`เทศกาล${festival.th}`} en={festival.en} /></span>
        <span className="block text-[15px] font-bold"><T th={festival.greetingTh} en={festival.greetingEn} /></span>
      </span>
    </div>
  );
}
