export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; /** sign-in: this is a staff account, ask for its PIN */ needPin?: boolean };

/** Postgres/PostgREST error → message for the user (our functions raise Thai messages). */
export function errorText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    const m = e.message;
    if (m.includes("duplicate key")) return "ข้อมูลนี้มีอยู่แล้ว";
    if (m.includes("violates check constraint")) return "ข้อมูลไม่ถูกต้องตามรูปแบบที่กำหนด";
    if (m.includes("row-level security")) return "ไม่มีสิทธิ์ทำรายการนี้";
    return m;
  }
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
