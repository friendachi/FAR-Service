# FAR Service

เว็บเช่าหางเทรลเลอร์ตาม [PRD.md](PRD.md) — Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Supabase
โครงสร้างฐานข้อมูลอยู่ใน [database.md](database.md)

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 — ทุกหน้าอ่านและเขียนข้อมูลจาก Supabase (ต้องมี `.env.local` ก่อน ดูด้านล่าง)

### บัญชีทดสอบ (สร้างโดย `scripts/seed-sample.mjs`)

รหัสผ่านทุกบัญชี `FarService#2569` — เปลี่ยนก่อนใช้งานจริง

| บทบาท | อีเมล |
|---|---|
| Super Admin | admin@example.com |
| Sales / CS | sales@example.com |
| Staff (Ops) ลานบางพระ | ops@example.com |
| ลูกค้า | customer1@example.com · customer2@example.com · customer3@example.com |
| คนขับ | driver1@example.com · driver2@example.com |

## เชื่อม Supabase

1. สร้างโปรเจกต์ที่ https://supabase.com (เลือก Region: Southeast Asia (Singapore))
2. เปิด **SQL Editor** แล้วรันไฟล์ตามลำดับนี้ทีละไฟล์
   - `supabase/migrations/` ทั้ง 6 ไฟล์ตามลำดับชื่อไฟล์ (หรือ `supabase/setup.sql` ไฟล์เดียวสำหรับฐานข้อมูลเปล่า)
   - `supabase/seed.sql` — ลานจอด 2 แห่ง, ประเภทหาง, รายการเอกสาร, ค่านโยบาย และหาง 12 คัน
   - (ถ้าต้องการข้อมูลทดสอบ) `node scripts/seed-sample.mjs` — สร้างบัญชีพนักงาน ลูกค้า คนขับ หัวลาก เอกสาร และการจองตัวอย่าง ต้องมี `SUPABASE_SERVICE_ROLE_KEY` ใน `.env.local`

   ถ้าใช้ Supabase CLI: `supabase link --project-ref <ref>` แล้ว `supabase db push` และรัน `seed.sql`
3. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ `NEXT_PUBLIC_SUPABASE_URL`, anon (หรือ publishable) key และ `SUPABASE_SERVICE_ROLE_KEY` (ใช้เฉพาะฝั่ง server: สร้างบัญชีพนักงาน และสคริปต์ seed)
4. รีสตาร์ต `npm run dev`
5. สร้าง **Super Admin คนแรก**
   - Authentication → Users → Add user (อีเมล + รหัสผ่าน)
   - รันใน SQL Editor:
     ```sql
     update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"SUPER_ADMIN"}'
      where email = 'admin@example.com';
     update public.profiles set role = 'SUPER_ADMIN', full_name = 'ชื่อผู้ดูแล'
      where email = 'admin@example.com';
     ```
   - หลังจากนั้น Super Admin เพิ่มพนักงาน Sales / Ops ได้เองที่ หลังบ้าน → ตั้งค่าระบบ → เพิ่มผู้ใช้
6. ลูกค้าสมัครเองที่ `/register` ระบบสร้างบัญชีลูกค้าให้อัตโนมัติ

### ตั้งค่า Auth ที่แนะนำ
- Authentication → URL Configuration → Site URL = โดเมนของเว็บ
- Email confirmation เปิดไว้ (หลังสมัคร ลูกค้าต้องยืนยันอีเมลก่อนเข้าสู่ระบบ)
- คนขับเข้าระบบด้วยเบอร์โทร + OTP ต้องตั้ง SMS provider (ยังไม่ได้ทำ)

## สิ่งที่ยังไม่ได้ทำ

- ส่ง SMS / อีเมลแจ้งเตือน (คำเชิญคนขับ, นัดรับหาง) — ยังไม่ได้เลือกผู้ให้บริการ
- งานตั้งเวลา (หมดเวลาชำระ / ส่งเอกสาร → EXPIRED) ด้วย pg_cron
- บันทึกการโอนคืนเงิน (ตาราง refunds) และแก้ไข/ปลดระวางหางจากหน้าจอ
- รูปถ่ายหางจริงและโลโก้บริษัท

## โครงสร้าง

- `src/app/(site)` หน้าบ้าน ค้นหา จอง และหน้าลูกค้า (`/me`)
- `src/app/driver` หน้าจอคนขับ
- `src/app/admin` หลังบ้าน
- `src/app/actions/` server actions (auth, customer, admin, yard, settings)
- `src/lib/data/` ชั้นข้อมูล — `store.ts` ข้อมูลต่อ request (ผ่าน RLS), `reference.ts` ลานจอด/ประเภทหาง (cache)
- `src/lib/supabase/` client ฝั่ง server / browser, `src/proxy.ts` ต่ออายุ session
- `supabase/` migrations และ seed · `scripts/` สคริปต์ seed ข้อมูลทดสอบ
- `DESIGN.md` ระบบการออกแบบ
