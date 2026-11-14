/*
  "น้องฟาร์" — FAR Service's guide. A young salesman: blond hair, white shirt, green tie (the logo green),
  black slacks, belt and leather shoes, carrying the company folder. Drawn as inline SVG so it stays sharp,
  light and on-brand; the pose changes with the page.
*/

import { KrathongShape } from "./krathong";

export type MascotPose = "wave" | "point" | "documents" | "phone" | "pin" | "thumbs" | "shrug" | "krathong";

const C = {
  skin: "#f7cfa6",
  skinShade: "#e9b386",
  hair: "#f4c23a",
  hairShade: "#d99d16",
  hairLight: "#ffe07a",
  shirt: "#ffffff",
  shirtShade: "#e6ece8",
  outline: "#1f2a1a",
  tie: "#8ec33e",
  tieShade: "#5f8f22",
  pants: "#20242a",
  pantsLight: "#343a42",
  belt: "#111316",
  buckle: "#c9ced3",
  shoe: "#0f1012",
  folder: "#2a420f",
  folderTab: "#8ec33e",
  paper: "#ffffff",
  blush: "#f3a48f",
  iris: "#7a4a22",
  irisDark: "#4e2c12",
  glasses: "#3a2614",
  brow: "#a8700a",
};

type P = [number, number];
type Arm = { shoulder: P; elbow: P; hand: P };

const ARMS: Record<MascotPose, { left: Arm; right: Arm }> = {
  wave: {
    left: { shoulder: [71, 127], elbow: [64, 162], hand: [66, 192] },
    right: { shoulder: [129, 127], elbow: [152, 116], hand: [162, 82] },
  },
  point: {
    left: { shoulder: [71, 127], elbow: [64, 162], hand: [66, 192] },
    right: { shoulder: [129, 127], elbow: [154, 128], hand: [180, 120] },
  },
  documents: {
    left: { shoulder: [71, 127], elbow: [66, 160], hand: [80, 170] },
    right: { shoulder: [129, 127], elbow: [134, 160], hand: [120, 170] },
  },
  /* Loy Krathong: holds a krathong in front with both hands */
  krathong: {
    left: { shoulder: [71, 127], elbow: [64, 162], hand: [80, 178] },
    right: { shoulder: [129, 127], elbow: [136, 162], hand: [120, 178] },
  },
  phone: {
    left: { shoulder: [71, 127], elbow: [64, 162], hand: [66, 192] },
    right: { shoulder: [129, 127], elbow: [156, 146], hand: [146, 100] },
  },
  pin: {
    left: { shoulder: [71, 127], elbow: [64, 162], hand: [66, 192] },
    right: { shoulder: [129, 127], elbow: [160, 124], hand: [172, 94] },
  },
  thumbs: {
    left: { shoulder: [71, 127], elbow: [64, 162], hand: [66, 192] },
    right: { shoulder: [129, 127], elbow: [150, 156], hand: [150, 128] },
  },
  shrug: {
    left: { shoulder: [71, 127], elbow: [50, 150], hand: [38, 130] },
    right: { shoulder: [129, 127], elbow: [150, 150], hand: [162, 130] },
  },
};

const path = (a: Arm) => `M${a.shoulder} Q${a.elbow} ${a.hand}`;

function Sleeve({ arm }: { arm: Arm }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={path(arm)} stroke={C.outline} strokeWidth={20} />
      <path d={path(arm)} stroke={C.shirt} strokeWidth={15} />
    </g>
  );
}

function Hand({ at, kind = "fist" }: { at: P; kind?: "fist" | "point" | "thumb" | "open" }) {
  const [x, y] = at;
  return (
    <g stroke={C.outline} strokeWidth={2.5} fill={C.skin} strokeLinejoin="round">
      {kind === "point" && <rect x={x + 2} y={y - 4} width={17} height={7} rx={3.5} />}
      {kind === "thumb" && <rect x={x - 4} y={y - 19} width={7.5} height={15} rx={3.75} />}
      <circle cx={x} cy={y} r={9} />
    </g>
  );
}

function Folder({ x, y, rotate = 0, label = true }: { x: number; y: number; rotate?: number; label?: boolean }) {
  return (
    <g transform={`rotate(${rotate} ${x + 22} ${y + 28})`} stroke={C.outline} strokeWidth={2.5} strokeLinejoin="round">
      <rect x={x} y={y + 4} width={44} height={56} rx={4} fill={C.folder} />
      <rect x={x + 4} y={y} width={18} height={8} rx={2} fill={C.folderTab} />
      {label && (
        <g stroke="none">
          <rect x={x + 8} y={y + 18} width={28} height={16} rx={2} fill={C.paper} />
          <text x={x + 22} y={y + 30} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={C.tieShade} fontFamily="Arial, sans-serif">
            FAR
          </text>
        </g>
      )}
    </g>
  );
}

function OpenFolder() {
  // held in front of the chest, showing a checked document
  return (
    <g stroke={C.outline} strokeWidth={2.5} strokeLinejoin="round">
      <path d="M62,142 L100,146 L100,190 L62,186 Z" fill={C.folder} />
      <path d="M138,142 L100,146 L100,190 L138,186 Z" fill={C.folder} />
      <path d="M68,140 L98,143 L98,184 L68,181 Z" fill={C.paper} />
      <path d="M132,140 L102,143 L102,184 L132,181 Z" fill={C.paper} />
      <g stroke={C.shirtShade} strokeWidth={2.5} strokeLinecap="round">
        <path d="M74,153 L92,155 M74,161 L92,163 M74,169 L86,170" />
        <path d="M108,155 L126,153 M108,163 L126,161" />
      </g>
      <path d="M110,170 l5,5 l10,-11" fill="none" stroke={C.tieShade} strokeWidth={3.5} strokeLinecap="round" />
    </g>
  );
}

function Phone({ at }: { at: P }) {
  const [x, y] = at;
  return <rect x={x - 6} y={y - 18} width={12} height={26} rx={3} fill={C.outline} stroke={C.outline} strokeWidth={2} transform={`rotate(-18 ${x} ${y})`} />;
}

function MapPin({ at }: { at: P }) {
  const [x, y] = at;
  return (
    <g transform={`translate(${x - 14} ${y - 50})`} stroke={C.outline} strokeWidth={2.5} strokeLinejoin="round">
      <path d="M14,0 C24,0 28,8 28,14 C28,24 14,38 14,38 C14,38 0,24 0,14 C0,8 4,0 14,0 Z" fill={C.tie} />
      <circle cx={14} cy={14} r={5.5} fill={C.paper} />
    </g>
  );
}

export function Mascot({
  pose = "wave",
  className,
  title = "น้องฟาร์ ผู้ช่วยของ FAR Service",
}: {
  pose?: MascotPose;
  className?: string;
  title?: string;
}) {
  const { left, right } = ARMS[pose];
  const surprised = pose === "shrug";
  const holdsFolder = pose !== "documents" && pose !== "shrug" && pose !== "krathong";
  const twoHands = pose === "documents" || pose === "krathong";

  return (
    <svg viewBox="0 -12 200 322" className={className} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      {/* ground shadow */}
      <ellipse cx={100} cy={300} rx={50} ry={6} fill="#000" opacity={0.08} />

      {/* legs */}
      <g stroke={C.outline} strokeWidth={2.5} strokeLinejoin="round">
        <path d="M70,200 L98,200 L96,284 L72,284 Z" fill={C.pants} />
        <path d="M102,200 L130,200 L128,284 L104,284 Z" fill={C.pants} />
      </g>
      <path d="M85,212 L84,280 M116,212 L117,280" stroke={C.pantsLight} strokeWidth={2} />
      {/* shoes */}
      <g stroke={C.outline} strokeWidth={2.5} fill={C.shoe}>
        <path d="M70,282 L97,282 L98,292 Q98,297 92,297 L62,297 Q56,297 58,291 Q62,284 70,282 Z" />
        <path d="M103,282 L130,282 Q138,284 142,291 Q144,297 138,297 L108,297 Q102,297 102,292 Z" />
      </g>
      <path d="M64,291 L74,291 M126,291 L136,291" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />

      {/* folder carried at the side (behind the hand) */}
      {holdsFolder && <Folder x={44} y={190} rotate={-6} />}

      {/* torso */}
      <path d="M68,132 Q68,116 86,112 L114,112 Q132,116 132,132 L128,202 L72,202 Z" fill={C.shirt} stroke={C.outline} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M120,122 Q126,160 124,198 L127,198 L131,132 Q130,121 120,122 Z" fill={C.shirtShade} />
      <path d="M100,124 L100,198" stroke={C.shirtShade} strokeWidth={2} />
      <circle cx={100} cy={176} r={1.6} fill={C.shirtShade} />
      <circle cx={100} cy={190} r={1.6} fill={C.shirtShade} />
      {/* belt */}
      <rect x={71} y={196} width={58} height={10} fill={C.belt} stroke={C.outline} strokeWidth={2.5} />
      <rect x={94} y={196.5} width={12} height={9} rx={1.5} fill="none" stroke={C.buckle} strokeWidth={2.5} />

      {/* neck, collar, tie */}
      <rect x={90} y={100} width={20} height={18} fill={C.skinShade} stroke={C.outline} strokeWidth={2.5} />
      <g stroke={C.outline} strokeWidth={2.5} strokeLinejoin="round">
        <path d="M100,124 L92,180 L100,190 L108,180 Z" fill={C.tie} />
        <path d="M100,130 L96,176 L100,181 Z" fill={C.tieShade} stroke="none" />
        <path d="M94,117 L106,117 L104,127 L96,127 Z" fill={C.tie} />
        <path d="M89,112 L100,120 L93,129 L83,118 Z" fill={C.shirt} />
        <path d="M111,112 L100,120 L107,129 L117,118 Z" fill={C.shirt} />
      </g>

      {/* arms */}
      <Sleeve arm={left} />
      {twoHands && <Sleeve arm={right} />}
      {pose === "documents" && <OpenFolder />}
      {pose === "krathong" && <KrathongShape x={64} y={134} scale={1.8} />}
      <Hand at={left.hand} kind={pose === "shrug" ? "open" : "fist"} />

      {/* head: big and round (chibi), scaled up from the neck */}
      <g transform="translate(100 114) scale(1.1) translate(-100 -114)">
        {/* ears */}
        <g stroke={C.outline} strokeWidth={2.5} fill={C.skin}>
          <ellipse cx={63} cy={76} rx={7} ry={9} />
          <ellipse cx={137} cy={76} rx={7} ry={9} />
        </g>
        {/* round face, soft chin */}
        <path
          d="M64,64 Q64,28 100,26 Q136,28 136,64 Q136,96 118,106 Q109,111 100,111 Q91,111 82,106 Q64,96 64,64 Z"
          fill={C.skin}
          stroke={C.outline}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* hair: soft rounded cut, bangs swept to one side */}
        <path
          d="M60,72 Q54,34 88,18 Q124,6 142,36 Q150,54 141,74 Q138,62 132,54 L127,61 Q122,49 110,44 Q107,56 94,60 Q99,51 97,45 Q84,56 70,58 Q66,64 66,76 Q61,76 60,72 Z"
          fill={C.hair}
          stroke={C.outline}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <path d="M92,20 Q100,6 114,10 Q104,12 102,22 Z" fill={C.hair} stroke={C.outline} strokeWidth={2.5} strokeLinejoin="round" />
        <g fill="none" strokeLinecap="round">
          <path d="M76,32 Q96,20 120,24" stroke={C.hairLight} strokeWidth={4.5} />
          <path d="M84,46 Q96,38 106,40 M116,40 Q128,44 134,56" stroke={C.hairShade} strokeWidth={2.2} />
        </g>

        {/* brows */}
        <g stroke={C.brow} strokeWidth={3} strokeLinecap="round" fill="none">
          <path d={surprised ? "M76,56 Q84,52 91,55" : "M77,60 Q84,57 91,59"} />
          <path d={surprised ? "M109,55 Q116,52 124,56" : "M109,59 Q116,57 123,60"} />
        </g>
        {/* big shining eyes */}
        {[85, 115].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy={74} rx={8.5} ry={surprised ? 10.5 : 9.5} fill="#fff" />
            <ellipse cx={cx} cy={75} rx={7} ry={surprised ? 8.5 : 8} fill={C.iris} />
            <ellipse cx={cx} cy={77} rx={5} ry={5.5} fill={C.irisDark} />
            <circle cx={cx} cy={75.5} r={3.2} fill={C.outline} />
            <circle cx={cx - 2.6} cy={71.5} r={2.6} fill="#fff" />
            <circle cx={cx + 2.8} cy={79} r={1.2} fill="#fff" />
            <path
              d={`M${cx - 9.5},73 Q${cx},${surprised ? 61 : 62.5} ${cx + 9.5},73`}
              fill="none"
              stroke={C.outline}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </g>
        ))}
        {/* round glasses */}
        <g fill="none" stroke={C.glasses} strokeWidth={3} strokeLinecap="round">
          <circle cx={85} cy={75} r={14} fill="#ffffff" fillOpacity={0.12} />
          <circle cx={115} cy={75} r={14} fill="#ffffff" fillOpacity={0.12} />
          <path d="M99,73 Q100,70.5 101,73" />
          <path d="M71,73 L64,71 M129,73 L136,71" />
        </g>
        <path d="M77,68 Q80,64 85,63" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        <path d="M107,68 Q110,64 115,63" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        {/* nose, cheeks, mouth */}
        <path d="M99,88 Q100,90 102,88.5" fill="none" stroke={C.skinShade} strokeWidth={2.2} strokeLinecap="round" />
        <ellipse cx={73} cy={93} rx={6} ry={3.5} fill={C.blush} opacity={0.55} />
        <ellipse cx={127} cy={93} rx={6} ry={3.5} fill={C.blush} opacity={0.55} />
        {surprised ? (
          <ellipse cx={100} cy={98} rx={3.5} ry={4.2} fill={C.outline} />
        ) : (
          <path d="M93,95 Q100,101 107,95" fill="none" stroke={C.outline} strokeWidth={2.4} strokeLinecap="round" />
        )}
      </g>

      {/* right arm in front of the big head (hand at the ear for the phone, pin held up high) */}
      {!twoHands && <Sleeve arm={right} />}
      <Hand at={right.hand} kind={pose === "point" ? "point" : pose === "thumbs" ? "thumb" : pose === "shrug" ? "open" : "fist"} />
      {pose === "phone" && <Phone at={[right.hand[0] - 3, right.hand[1] - 10]} />}
      {pose === "pin" && <MapPin at={right.hand} />}

      {/* the question mark for "page not found" */}
      {surprised && (
        <text x={156} y={30} fontSize={34} fontWeight={800} fill={C.tie} stroke={C.outline} strokeWidth={1.5} fontFamily="Arial, sans-serif">
          ?
        </text>
      )}
    </svg>
  );
}

/** The mascot with a speech bubble beside it. */
export function MascotSays({
  pose,
  children,
  className = "",
  size = "h-40",
}: {
  pose: MascotPose;
  children: React.ReactNode;
  className?: string;
  size?: string;
}) {
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <Mascot pose={pose} className={`${size} w-auto shrink-0`} />
      <p className="relative mb-8 max-w-[15rem] rounded-xl border-2 border-line bg-paper px-4 py-3 text-[14px] font-semibold leading-snug text-ink shadow-[0_6px_20px_-12px_rgba(0,59,32,0.35)]">
        <span
          aria-hidden
          className="absolute -left-[9px] bottom-4 size-4 rotate-45 border-b-2 border-l-2 border-line bg-paper"
        />
        {children}
      </p>
    </div>
  );
}
