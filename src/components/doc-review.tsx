"use client";

import { useState, useTransition } from "react";
import { approveBooking, rejectBooking, requestMoreDocs, reviewDocument } from "@/app/actions/admin";
import { Check, FileText, X } from "lucide-react";
import { docStatusLabel, docStatusTone } from "@/lib/format";
import type { CustomerDocument, DocRequirement } from "@/lib/types";
import { Badge, Button, cx } from "./ui";

type Decision = "APPROVED" | "REJECTED" | null;

function checksFor(req: DocRequirement) {
  const age = req.rule?.match(/ไม่เกิน\s*(\d+)\s*เดือน/);
  const base = [
    "อ่านได้ชัดเจน ครบทั้งแผ่น",
    "ชื่อตรงกับผู้เช่า / ผู้ค้ำ / หัวลาก / คนขับ",
    age ? `ออกให้ไม่เกิน ${age[1]} เดือน` : "ยังไม่หมดอายุ",
  ];
  if (req.rule?.startsWith("ประทับตรา")) return [...base, "มีตราประทับบริษัท"];
  if (req.rule?.startsWith("เซ็นรับรอง")) return [...base, "มีลายเซ็นรับรองสำเนาถูกต้อง", "ไม่มีตราบริษัทประทับ"];
  return base;
}

/** Per-document review with the PRD FR-DOC-05 checklist and a decision. */
export function DocReview({
  bookingId,
  groups,
  canDecide,
  needsSuperAdmin,
}: {
  bookingId: string;
  groups: { title: string; rows: { req: DocRequirement; doc: CustomerDocument }[] }[];
  canDecide: boolean;
  needsSuperAdmin: boolean;
}) {
  const all = groups.flatMap((g) => g.rows);
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(all.map(({ req, doc }) => [`${req.key}:${doc.ownerId}`, doc.status === "APPROVED" ? "APPROVED" : doc.status === "REJECTED" ? "REJECTED" : null])),
  );
  const [open, setOpen] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decide = (id: string, doc: CustomerDocument, decision: "APPROVED" | "REJECTED") => {
    setError(null);
    if (decision === "REJECTED" && !(reasons[id] ?? doc.note ?? "").trim()) {
      setDecisions({ ...decisions, [id]: "REJECTED" });
      setOpen(id);
      return; // the reason box opens; saving happens from there
    }
    start(async () => {
      if (doc.id) {
        const res = await reviewDocument(doc.id, decision === "APPROVED", reasons[id] ?? doc.note);
        if (!res.ok) return setError(res.error);
      }
      setDecisions((all) => ({ ...all, [id]: decision }));
    });
  };

  const finish = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      setOutcome(res.message ?? "บันทึกแล้ว");
    });
  };

  const values = Object.values(decisions);
  const allPass = values.every((v) => v === "APPROVED");
  const anyFail = values.some((v) => v === "REJECTED");

  if (outcome) {
    return <div className="rounded-xl border-2 border-sign bg-sign-wash p-5 text-[16px] font-semibold text-sign-deep">{outcome}</div>;
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.title} className="rounded-xl border border-line bg-paper">
          <h3 className="border-b border-line px-5 py-3 font-bold">{g.title}</h3>
          <ul className="divide-y divide-line">
            {g.rows.map(({ req, doc }) => {
              const id = `${req.key}:${doc.ownerId}`;
              const d = decisions[id];
              const isOpen = open === id;
              return (
                <li key={id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : id)}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-semibold">{req.label}</span>
                        <span className="block truncate text-[13px] text-ink-3">{doc.fileName ?? "ยังไม่ได้อัปโหลด"}{req.rule ? ` · ต้อง${req.rule}` : ""}</span>
                      </span>
                    </button>
                    {d ? (
                      <Badge tone={d === "APPROVED" ? "ok" : "danger"}>{d === "APPROVED" ? "ผ่าน" : "ไม่ผ่าน"}</Badge>
                    ) : (
                      <Badge tone={docStatusTone[doc.status]}>{docStatusLabel[doc.status]}</Badge>
                    )}
                    {canDecide && doc.status !== "MISSING" && (
                      <span className="flex gap-1.5">
                        <button
                          type="button"
                          aria-label={`${req.label} ผ่าน`}
                          disabled={pending}
                          onClick={() => decide(id, doc, "APPROVED")}
                          className={cx("flex size-9 items-center justify-center rounded-lg border-2", d === "APPROVED" ? "border-sign bg-sign text-on-sign" : "border-line text-grass hover:border-sign")}
                        >
                          <Check className="size-4" strokeWidth={3} aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={`${req.label} ไม่ผ่าน`}
                          disabled={pending}
                          onClick={() => {
                            setDecisions({ ...decisions, [id]: "REJECTED" });
                            setOpen(id);
                          }}
                          className={cx("flex size-9 items-center justify-center rounded-lg border-2", d === "REJECTED" ? "border-danger bg-danger text-white" : "border-line text-danger hover:border-danger")}
                        >
                          <X className="size-4" strokeWidth={3} aria-hidden />
                        </button>
                      </span>
                    )}
                  </div>
                  {isOpen && (
                    <div className="mt-3 grid gap-4 rounded-lg bg-ground p-4 md:grid-cols-[1.2fr_1fr]">
                      {doc.url ? (
                        <div className="overflow-hidden rounded-md border border-line bg-paper">
                          {doc.mimeType === "application/pdf" ? (
                            <iframe src={doc.url} title={req.label} className="aspect-[4/3] w-full" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
                            <img src={doc.url} alt={req.label} className="aspect-[4/3] w-full object-contain" />
                          )}
                          <a href={doc.url} target="_blank" rel="noreferrer" className="block border-t border-line px-3 py-2 text-[13px] font-semibold text-grass underline">
                            เปิดไฟล์เต็มจอ
                          </a>
                        </div>
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-line-strong bg-paper text-[13px] text-ink-3">
                          ยังไม่มีไฟล์
                        </div>
                      )}
                      <div>
                        <p className="text-[13px] font-semibold text-ink-3">รายการตรวจ</p>
                        <ul className="mt-2 space-y-2 text-[14px]">
                          {checksFor(req).map((c) => (
                            <li key={c}>
                              <label className="flex items-start gap-2">
                                <input type="checkbox" defaultChecked={doc.status === "APPROVED"} className="mt-0.5 size-4 accent-[var(--color-sign)]" />
                                {c}
                              </label>
                            </li>
                          ))}
                        </ul>
                        {d === "REJECTED" && (
                          <>
                            <textarea
                              value={reasons[id] ?? doc.note ?? ""}
                              onChange={(e) => setReasons({ ...reasons, [id]: e.target.value })}
                              rows={2}
                              placeholder="เหตุผลที่ไม่ผ่าน (ลูกค้าจะเห็นข้อความนี้)"
                              className="mt-3 w-full rounded-lg border-2 border-line p-2.5 text-[14px] focus:border-sign focus:outline-none"
                            />
                            <Button
                              size="sm"
                              variant="danger"
                              className="mt-2"
                              disabled={pending || !(reasons[id] ?? doc.note ?? "").trim()}
                              onClick={() => decide(id, doc, "REJECTED")}
                            >
                              บันทึกว่าไม่ผ่าน
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {canDecide ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-4">
          <Button variant="sign" disabled={!allPass || pending} onClick={() => finish(() => approveBooking(bookingId))}>
            อนุมัติการจอง
          </Button>
          <Button
            variant="outline"
            disabled={!anyFail || pending}
            onClick={() =>
              finish(() =>
                requestMoreDocs(
                  bookingId,
                  all
                    .filter(({ req, doc }) => decisions[`${req.key}:${doc.ownerId}`] === "REJECTED")
                    .map(({ req }) => req.label)
                    .join(", "),
                ),
              )
            }
          >
            ขอเอกสารเพิ่ม
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("เหตุผลที่ปฏิเสธการจอง (ลูกค้าจะเห็นข้อความนี้)");
              if (reason?.trim()) finish(() => rejectBooking(bookingId, reason.trim()));
            }}
          >
            ปฏิเสธ
          </Button>
          {!allPass && <p className="text-[13px] text-ink-3">อนุมัติได้เมื่อเอกสารทุกฉบับผ่าน</p>}
          {error && (
            <p className="w-full text-[14px] font-semibold text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-lg bg-reflect-tint px-4 py-3 text-[14px] text-sign-deep">
          {needsSuperAdmin ? "การจองนี้คุณเป็นผู้สร้างแทนลูกค้า ต้องให้ Super Admin อนุมัติ" : "บทบาทของคุณอนุมัติรายการนี้ไม่ได้"}
        </p>
      )}
    </div>
  );
}
