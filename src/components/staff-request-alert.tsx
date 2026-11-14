"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, Volume2, VolumeX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { serviceSummary, type ServiceDetails, type ServiceKind } from "@/lib/service-requests";

/*
  Pops up a card and plays a chime on a signed-in staff member's screen when a customer sends a request
  (quotation, extra service or contact message). Checks every 15 seconds while any page is open.
  Browsers allow sound only after the person has clicked or tapped the page once, so the first click unlocks it.
*/

type Alert = { id: string; title: string; detail: string; href: string; at: string };

const SEEN_KEY = "far-alert-seen";
const MUTE_KEY = "far-alert-muted";
const POLL_MS = 15_000;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {}
}

/** Two rising "ding-dong" notes, played twice. */
function chime() {
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  [0, 0.9].forEach((offset) =>
    [
      [880, 0],
      [1318.5, 0.22],
    ].forEach(([freq, delay]) => {
      const t = now + offset + delay;
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    }),
  );
}

async function fetchNew(since: string): Promise<Alert[]> {
  const sb = createClient();
  // each source fails on its own (no permission, table missing) without hiding the others
  const [q, s, c] = await Promise.all([
    sb.from("quote_requests").select("id, company, contact_name, phone, items, created_at").gt("created_at", since).order("created_at").limit(20),
    sb.from("service_requests").select("id, kind, name, phone, details, created_at").gt("created_at", since).order("created_at").limit(20),
    sb.from("contact_messages").select("id, name, phone, message, created_at").gt("created_at", since).order("created_at").limit(20),
  ]);
  const out: Alert[] = [];
  for (const r of q.data ?? [])
    out.push({
      id: `q-${r.id}`,
      title: "ขอใบเสนอราคาใหม่",
      detail: [
        r.company || r.contact_name,
        r.phone,
        (r.items as { label: string; qty: number }[] | null)?.map((i) => `${i.label} × ${i.qty}`).join(", "),
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/admin/quotes",
      at: r.created_at,
    });
  for (const r of s.data ?? [])
    out.push({
      id: `s-${r.id}`,
      title: "ขอใช้บริการเสริมใหม่",
      detail: [serviceSummary(r.kind as ServiceKind, (r.details ?? {}) as ServiceDetails), r.name, r.phone].join(" · "),
      href: "/admin/services",
      at: r.created_at,
    });
  for (const r of c.data ?? [])
    out.push({
      id: `c-${r.id}`,
      title: r.message?.startsWith("[ขอใบเสนอราคา]") ? "ขอใบเสนอราคาใหม่" : "ข้อความติดต่อใหม่",
      detail: [r.name, r.phone, r.message?.split("\n")[1]].filter(Boolean).join(" · "),
      href: "/admin/services",
      at: r.created_at,
    });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function StaffRequestAlert() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    const m = read(MUTE_KEY) === "1";
    mutedRef.current = m;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- saved preference is only readable in the browser
    setMuted(m);
  }, []);

  const toggleMute = useCallback(() => {
    unlockAudio();
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    write(MUTE_KEY, m ? "1" : "0");
    if (!m) chime(); // let them hear it works
    if (!m && typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
  }, []);

  useEffect(() => {
    const onFirst = () => unlockAudio();
    window.addEventListener("pointerdown", onFirst);
    window.addEventListener("keydown", onFirst);

    if (!read(SEEN_KEY)) write(SEEN_KEY, new Date().toISOString());
    let stop = false;
    const check = async () => {
      const since = read(SEEN_KEY) ?? new Date().toISOString();
      const found = await fetchNew(since).catch(() => []);
      if (stop || !found.length) return;
      write(SEEN_KEY, found[found.length - 1].at);
      setAlerts((a) => [...found.reverse(), ...a].slice(0, 5));
      if (!mutedRef.current) chime();
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        for (const f of found.slice(0, 3)) {
          try {
            new Notification(`FAR Service · ${f.title}`, { body: f.detail, tag: f.id });
          } catch {}
        }
      }
    };
    void check();
    const t = setInterval(check, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={toggleMute}
        className="flex items-center gap-1 rounded-md border border-white/80 px-2.5 py-1 text-[13px] font-semibold text-white hover:bg-white/15"
        title={muted ? "เปิดเสียงแจ้งเตือนคำขอใหม่" : "ปิดเสียงแจ้งเตือน (กดเพื่อทดสอบเสียงเมื่อเปิด)"}
      >
        {muted ? <VolumeX className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />}
        {muted ? "เสียงปิดอยู่" : "เสียงแจ้งเตือน"}
      </button>
      {alerts.length > 0 && (
        <div className="fixed right-3 top-3 z-[60] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2" role="alert" aria-live="assertive">
          {alerts.map((a) => (
            <div key={a.id} className="relative rounded-xl border-2 border-reflect bg-paper p-4 pr-10 text-ink shadow-[0_14px_36px_-14px_rgba(0,0,0,0.5)]">
              <button
                type="button"
                onClick={() => setAlerts((x) => x.filter((y) => y.id !== a.id))}
                aria-label="ปิด"
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-ink-3 hover:bg-ground"
              >
                <X className="size-4" aria-hidden />
              </button>
              <p className="flex items-center gap-1.5 font-bold text-reflect">
                <BellRing className="size-4" aria-hidden /> {a.title}
              </p>
              <p className="mt-1 text-[14px] text-ink-2">{a.detail}</p>
              <Link
                href={a.href}
                onClick={() => setAlerts((x) => x.filter((y) => y.id !== a.id))}
                className="mt-2 inline-block text-[14px] font-semibold text-grass underline"
              >
                เปิดดูคำขอ
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
