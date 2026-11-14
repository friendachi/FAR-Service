-- FAR Service — keep profiles.role in sync with auth app_metadata.
-- Supabase Auth writes app_metadata in a separate UPDATE after creating the user, so the
-- insert trigger alone always sees the default role. This also covers promoting a user
-- later from the dashboard or with the admin API. Safe to run more than once.

create or replace function sync_user_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := (new.raw_app_meta_data ->> 'role')::app_role;
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''), '\D', '', 'g');
begin
  if v_role is null then return new; end if;
  update profiles set role = v_role where id = new.id and role is distinct from v_role;
  if v_role = 'DRIVER' and v_phone <> '' then
    update drivers set profile_id = new.id where profile_id is null and phone = v_phone;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_role_changed on auth.users;
create trigger on_auth_user_role_changed after update of raw_app_meta_data on auth.users
  for each row when (old.raw_app_meta_data ->> 'role' is distinct from new.raw_app_meta_data ->> 'role')
  execute function sync_user_role();

-- FAR Service — yard operations: check-in, checklist, driver acknowledgement, handover, settlement
-- (PRD D4, D7, D8, D13, D16, BR-11, BR-16, BR-23; database.md §12.6). Safe to run more than once.

-- ---------------------------------------------------------------- check-in (BR-23)
create or replace function checkin_appointment(p_appointment uuid, p_code text, p_identity_match boolean)
returns appointments
language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  if auth_role() not in ('OPS','SUPER_ADMIN') then raise exception 'เช็กอินได้เฉพาะเจ้าหน้าที่ลาน'; end if;
  select * into a from appointments where id = p_appointment for update;
  if not found then raise exception 'ไม่พบนัดนี้'; end if;
  if a.completed_at is not null then raise exception 'นัดนี้เสร็จสิ้นแล้ว'; end if;
  if trim(p_code) <> a.checkin_code then raise exception 'รหัสเช็กอินไม่ถูกต้อง'; end if;
  if now() not between coalesce(a.code_valid_from, '-infinity') and coalesce(a.code_valid_to, 'infinity') then
    raise exception 'รหัสนี้ใช้ได้เฉพาะวันนัด ±1 วัน';
  end if;
  update appointments
     set checked_in_at = now(), checked_in_by = auth.uid(), identity_match = p_identity_match,
         driver_id = (select driver_id from booking_drivers where booking_id = a.booking_id and is_primary limit 1)
   where id = a.id returning * into a;
  return a;
end $$;

-- ---------------------------------------------------------------- full checklist by Ops (D7, D8)
-- p_items: [{ "key": "chassis", "label": "แชสซีและคานขวาง", "result": "OK" | "DAMAGED" | "NA", "note": "" }, ...]
create or replace function save_inspection(p_appointment uuid, p_items jsonb, p_notes text default null,
                                           p_damage_amount numeric default null) returns inspections
language plpgsql security definer set search_path = public as $$
declare a appointments; b bookings; i inspections; v_kind inspection_kind; v_damaged int;
begin
  if auth_role() not in ('OPS','SUPER_ADMIN') then raise exception 'บันทึกผลตรวจได้เฉพาะเจ้าหน้าที่ลาน'; end if;
  select * into a from appointments where id = p_appointment;
  if not found then raise exception 'ไม่พบนัดนี้'; end if;
  select * into b from bookings where id = a.booking_id for update;
  v_kind := case a.kind when 'PICKUP' then 'OUT' else 'IN' end;
  if v_kind = 'OUT' and b.status not in ('CONFIRMED','READY_FOR_PICKUP') then
    raise exception 'ตรวจก่อนส่งมอบได้เมื่อการจองชำระเงินแล้วเท่านั้น';
  end if;
  if v_kind = 'IN' and b.status <> 'IN_RENTAL' then raise exception 'การจองนี้ยังไม่ได้อยู่ระหว่างเช่า'; end if;
  if v_kind = 'IN' and a.checked_in_at is null then raise exception 'เช็กอินคนขับก่อนตรวจรับคืน'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'ยังไม่มีผลตรวจ'; end if;

  insert into inspections (appointment_id, kind, template_id, inspector_id, notes)
  values (a.id, v_kind, (select checklist_template_id from trailer_types tt join trailers t on t.type = tt.code where t.id = b.trailer_id),
          auth.uid(), p_notes)
  on conflict (appointment_id) do update set inspector_id = excluded.inspector_id, notes = excluded.notes
  returning * into i;

  delete from inspection_items where inspection_id = i.id;
  insert into inspection_items (inspection_id, item_key, label, result, note)
  select i.id, x ->> 'key', x ->> 'label', (x ->> 'result')::checklist_result, nullif(x ->> 'note', '')
    from jsonb_array_elements(p_items) x;
  select count(*) into v_damaged from inspection_items where inspection_id = i.id and result = 'DAMAGED';

  update inspections set damaged_count = v_damaged, completed_at = now() where id = i.id returning * into i;

  if v_kind = 'OUT' and b.status = 'CONFIRMED' then
    update bookings set status = 'READY_FOR_PICKUP' where id = b.id;
    update trailers set status = 'RESERVED' where id = b.trailer_id and status = 'AVAILABLE';
  end if;
  if v_kind = 'IN' and coalesce(p_damage_amount, 0) > 0 then
    insert into extra_charges (booking_id, kind, amount, description, status, proposed_by)
    values (b.id, 'DAMAGE', p_damage_amount, coalesce(p_notes, 'ความเสียหายจากการตรวจรับคืน'), 'PROPOSED', auth.uid());
  end if;
  return i;
end $$;

-- ---------------------------------------------------------------- driver's quick confirmation (FR-DRV-04)
create or replace function acknowledge_inspection(p_inspection uuid, p_result ack_result, p_remark text default null,
                                                  p_signature_path text default null,
                                                  p_device ack_device default 'DRIVER_PHONE')
returns driver_acknowledgements
language plpgsql security definer set search_path = public as $$
declare i inspections; a appointments; v_driver uuid; r driver_acknowledgements;
begin
  select * into i from inspections where id = p_inspection;
  if not found or i.completed_at is null then raise exception 'เจ้าหน้าที่ยังบันทึกผลตรวจไม่เสร็จ'; end if;
  select * into a from appointments where id = i.appointment_id;
  if auth_role() = 'DRIVER' then
    v_driver := my_driver_id();
    if not exists (select 1 from booking_drivers where booking_id = a.booking_id and driver_id = v_driver) then
      raise exception 'นัดนี้ไม่ใช่ของคุณ';
    end if;
    if a.checked_in_at is null then raise exception 'ให้เจ้าหน้าที่ลานเช็กอินก่อน'; end if;
    p_device := 'DRIVER_PHONE';
  elsif auth_role() in ('OPS','SUPER_ADMIN') then
    v_driver := coalesce(a.driver_id, (select driver_id from booking_drivers where booking_id = a.booking_id and is_primary limit 1));
    p_device := 'YARD_TABLET';
  else
    raise exception 'ไม่มีสิทธิ์';
  end if;
  if exists (select 1 from driver_acknowledgements where inspection_id = i.id) then
    raise exception 'ผลตรวจนี้เซ็นรับทราบแล้ว';
  end if;

  insert into driver_acknowledgements (inspection_id, driver_id, result, remark, signature_path, device)
  values (i.id, v_driver, p_result, nullif(trim(coalesce(p_remark, '')), ''), p_signature_path, p_device)
  returning * into r;

  if p_result in ('REMARK','DISPUTE') then
    update bookings set flagged_reason = 'คนขับ' || case when p_result = 'DISPUTE' then 'โต้แย้ง' else 'มีข้อสังเกต' end
                                         || 'ผลตรวจ: ' || r.remark
     where id = a.booking_id;
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------- handover / return (BR-16, D13, D16, BR-11)
create or replace function complete_handover(p_appointment uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  a appointments; b bookings; i inspections; t trailers;
  v_days int; q record; v_late_days int;
begin
  if auth_role() not in ('OPS','SUPER_ADMIN') then raise exception 'ส่งมอบ/รับคืนได้เฉพาะเจ้าหน้าที่ลาน'; end if;
  select * into a from appointments where id = p_appointment for update;
  select * into b from bookings where id = a.booking_id for update;
  select * into i from inspections where appointment_id = a.id;
  select * into t from trailers where id = b.trailer_id for update;

  if a.completed_at is not null then raise exception 'นัดนี้เสร็จสิ้นแล้ว'; end if;
  if a.checked_in_at is null then raise exception 'ยังไม่ได้เช็กอินคนขับ'; end if;
  if not coalesce(a.identity_match, false) then raise exception 'คนขับหรือหัวลากไม่ตรงกับการจอง ห้ามส่งมอบ'; end if;
  if i.id is null or i.completed_at is null then raise exception 'ยังไม่ได้บันทึกผลตรวจสภาพ'; end if;
  if not exists (select 1 from driver_acknowledgements where inspection_id = i.id) then
    raise exception 'คนขับยังไม่ได้เซ็นรับทราบผลตรวจ';
  end if;

  update appointments set completed_at = now() where id = a.id;

  if a.kind = 'PICKUP' then
    if b.status <> 'READY_FOR_PICKUP' then raise exception 'การจองยังไม่พร้อมส่งมอบ'; end if;
    update bookings set status = 'IN_RENTAL', actual_pickup_at = now() where id = b.id returning * into b;
    update trailers set status = 'RENTED' where id = t.id;
    return b;
  end if;

  -- RETURN
  if b.status <> 'IN_RENTAL' then raise exception 'การจองนี้ไม่ได้อยู่ระหว่างเช่า'; end if;
  update bookings set status = 'RETURNED_PENDING_SETTLEMENT', actual_return_at = now(), actual_return_yard_id = a.yard_id
   where id = b.id returning * into b;

  if a.yard_id <> t.current_yard_id then
    insert into yard_transfers (trailer_id, from_yard_id, to_yard_id, reason, booking_id, moved_by)
    values (t.id, t.current_yard_id, a.yard_id, 'RETURN_OTHER_YARD', b.id, auth.uid());
  end if;
  update trailers set status = 'INSPECTION', current_yard_id = a.yard_id where id = t.id;

  if b.actual_return_at < b.return_at - interval '3 hours' then
    -- early termination (D16): re-price on actual days with the matching tier
    v_days := rental_days(b.pickup_at, b.actual_return_at);
    select * into q from quote_rental(b.trailer_id, v_days, b.tyre_count);  -- 3-arg form from migration 7
    update bookings set early_termination = true, recalculated_days = v_days, recalculated_tier = q.tier,
           recalculated_rental = q.rental, return_at = greatest(actual_return_at, pickup_at + interval '1 hour')
     where id = b.id returning * into b;
    if (b.rental_amount + b.tyre_fee + b.vat_amount) - (q.rental + q.tyre_fee + q.vat) <> 0 then
      insert into extra_charges (booking_id, kind, amount, description, status, proposed_by)
      values (b.id, 'EARLY_RETURN_DIFF', (q.rental + q.tyre_fee + q.vat) - (b.rental_amount + b.tyre_fee + b.vat_amount),
              format('คืนก่อนกำหนด: คิดใหม่ %s วัน (%s)', v_days, q.tier), 'PROPOSED', auth.uid());
    end if;
  elsif b.actual_return_at > b.return_at + interval '3 hours' then
    v_late_days := ceil(extract(epoch from (b.actual_return_at - b.return_at)) / 86400)::int;
    insert into extra_charges (booking_id, kind, amount, description, status, proposed_by)
    values (b.id, 'LATE_RETURN', round(b.rate_daily * coalesce(setting_num('late_return_multiplier'), 1.5) * v_late_days),
            format('คืนช้า %s วัน', v_late_days), 'PROPOSED', auth.uid());
  end if;
  return b;
end $$;

-- ---------------------------------------------------------------- settlement (FR-APV-10, FR-PAY-07)
create or replace function settle_booking(p_booking uuid, p_waive_damage boolean default false) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; d deposits; v_charges numeric; v_deduct numeric;
begin
  if auth_role() not in ('SALES','SUPER_ADMIN') then raise exception 'ปิดยอดได้เฉพาะฝ่ายขายหรือ Super Admin'; end if;
  select * into b from bookings where id = p_booking for update;
  if b.status <> 'RETURNED_PENDING_SETTLEMENT' then raise exception 'การจองนี้ยังไม่ได้คืนหาง'; end if;

  update extra_charges set status = case when p_waive_damage and kind = 'DAMAGE' then 'WAIVED' else 'APPROVED' end::charge_status,
         approved_by = auth.uid()
   where booking_id = b.id and status = 'PROPOSED';

  -- positive charges (damage, late return, fees) come out of the deposit; negative ones (early-return
  -- difference) are money owed back to the customer and are refunded separately (refunds table)
  select coalesce(sum(amount), 0) into v_charges from extra_charges
   where booking_id = b.id and status = 'APPROVED' and amount > 0;
  select * into d from deposits where booking_id = b.id for update;
  v_deduct := least(greatest(v_charges, 0), d.amount);
  update deposits set deducted_amount = v_deduct,
         released_amount = d.amount - v_deduct,
         status = case when v_deduct = 0 then 'RELEASED' when v_deduct >= d.amount then 'FULLY_DEDUCTED'
                       else 'PARTIALLY_DEDUCTED' end::deposit_status,
         released_at = now()
   where booking_id = b.id;
  update extra_charges set status = 'SETTLED' where booking_id = b.id and status = 'APPROVED';

  update bookings set status = 'COMPLETED' where id = b.id returning * into b;
  update trailers set status = 'AVAILABLE' where id = b.trailer_id and status = 'INSPECTION';
  return b;
end $$;

grant execute on function checkin_appointment(uuid, text, boolean), save_inspection(uuid, jsonb, text, numeric),
  acknowledge_inspection(uuid, ack_result, text, text, ack_device), complete_handover(uuid),
  settle_booking(uuid, boolean) to authenticated;
revoke execute on function checkin_appointment(uuid, text, boolean), save_inspection(uuid, jsonb, text, numeric),
  acknowledge_inspection(uuid, ack_result, text, text, ack_device), complete_handover(uuid),
  settle_booking(uuid, boolean) from anon, public;

-- ---------------------------------------------------------------- driver view: expose check-in state
create or replace view driver_appointments_v as
select a.id, a.booking_id, a.kind, a.scheduled_at, a.checkin_code, a.completed_at,
       y.code as yard_code, y.number as yard_number, y.short_name as yard_short, y.address as yard_address,
       y.map_url as yard_map_url,
       t.id as trailer_id, t.code as trailer_code, t.plate_no as trailer_plate, t.type as trailer_type,
       t.length_ft as trailer_length_ft,
       tr.plate_no || ' ' || tr.province as tractor_plate, b.booking_no, b.status as booking_status,
       b.flagged_reason, c.name as customer_name,
       a.checked_in_at
  from appointments a
  join bookings b on b.id = a.booking_id
  join booking_drivers bd on bd.booking_id = b.id and bd.driver_id = my_driver_id()
  join yards y on y.id = a.yard_id
  join trailers t on t.id = b.trailer_id
  join tractors tr on tr.id = b.tractor_id
  join customers c on c.id = b.customer_id;
revoke all on driver_appointments_v from anon;

-- FAR Service — trailer models with real specs and price lists (Nov 2026 price list).
-- Skeletal / flatbed: monthly rate by contract length (1–5, 6–11, 12+ months), tyres not included,
-- optional tyre-fitting service per tyre. Lowbed: daily and monthly rate. All prices exclude VAT.

create table if not exists trailer_models (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  type              trailer_type_code not null references trailer_types,
  name              text not null,
  axles             smallint not null,
  length_ft         smallint,
  width_m           numeric(4,2),
  length_m          numeric(4,2),
  deck_length       text,                -- e.g. '9.6' or '6.15 + 2.35'
  deck_height_m     numeric(4,2),
  weight_ton        numeric(5,2),
  rate_plan         text not null check (rate_plan in ('MONTHLY_TIERED','DAILY_MONTHLY')),
  daily_rate        numeric(12,2),
  monthly_rate      numeric(12,2),
  monthly_rate_1_5  numeric(12,2),
  monthly_rate_6_11 numeric(12,2),
  monthly_rate_12   numeric(12,2),
  deposit           numeric(12,2) not null,
  tyre_fee          numeric(12,2) not null default 0,   -- per tyre, 0 = not offered
  tyre_count        smallint not null default 0,        -- tyre positions on this model
  description       text,
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz,
  check (rate_plan <> 'MONTHLY_TIERED' or (monthly_rate_1_5 > 0 and monthly_rate_6_11 > 0 and monthly_rate_12 > 0)),
  check (rate_plan <> 'DAILY_MONTHLY' or (daily_rate > 0 and monthly_rate > 0))
);

alter table trailer_models enable row level security;
drop policy if exists trailer_models_read on trailer_models;
create policy trailer_models_read on trailer_models for select using (true);
drop policy if exists trailer_models_write on trailer_models;
create policy trailer_models_write on trailer_models for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));
drop trigger if exists trailer_models_updated_at on trailer_models;
create trigger trailer_models_updated_at before update on trailer_models for each row execute function set_updated_at();

-- trailers point at a model; per-trailer rate columns become optional overrides (unused for now)
alter table trailers add column if not exists model_id uuid references trailer_models;
alter table trailers alter column daily_rate drop not null,
                     alter column weekly_rate drop not null,
                     alter column monthly_rate drop not null;

-- bookings keep the price snapshot of the plan used
alter table bookings alter column rate_daily drop not null,
                     alter column rate_weekly drop not null,
                     alter column rate_monthly drop not null;
alter table bookings alter column rate_tier type text using rate_tier::text;
alter table bookings alter column recalculated_tier type text using recalculated_tier::text;
alter table bookings add column if not exists contract_months int,
                     add column if not exists tyre_count int not null default 0,
                     add column if not exists tyre_fee numeric(12,2) not null default 0;

-- ---------------------------------------------------------------- pricing
-- MONTHLY_TIERED: months = ceil(days / 30.4375); rate by contract length; tier MONTHLY_1_5 / MONTHLY_6_11 / MONTHLY_12
-- DAILY_MONTHLY: whole months at the monthly rate + remaining days at the daily rate (capped at one month)
drop function if exists quote_rental(uuid, int);
create or replace function quote_rental(p_trailer uuid, p_days int, p_tyres int default 0)
returns table (tier text, months int, rental numeric, tyre_fee numeric, vat_rate numeric, vat numeric,
               deposit numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare t trailers; m trailer_models; v_rate numeric := coalesce(setting_num('vat_rate'), 0.07); v_full int; v_rem int;
begin
  select * into t from trailers where id = p_trailer;
  if not found then raise exception 'ไม่พบหาง'; end if;
  select * into m from trailer_models where id = t.model_id;
  if not found then raise exception 'หางคันนี้ยังไม่ได้กำหนดรุ่นและราคา'; end if;

  if m.rate_plan = 'MONTHLY_TIERED' then
    months := greatest(1, ceil(p_days / 30.4375)::int);  -- calendar months (365.25 / 12 days)
    if months >= 12 then tier := 'MONTHLY_12'; rental := m.monthly_rate_12 * months;
    elsif months >= 6 then tier := 'MONTHLY_6_11'; rental := m.monthly_rate_6_11 * months;
    else tier := 'MONTHLY_1_5'; rental := m.monthly_rate_1_5 * months;
    end if;
  else
    v_full := floor(p_days / 30.0)::int;
    v_rem := p_days - v_full * 30;
    months := v_full;
    rental := m.monthly_rate * v_full + least(m.daily_rate * v_rem, m.monthly_rate);
    tier := case when v_full = 0 and m.daily_rate * v_rem < m.monthly_rate then 'DAILY' else 'MONTHLY' end;
  end if;

  tyre_fee := case when m.tyre_fee > 0 then m.tyre_fee * greatest(coalesce(p_tyres, 0), 0) else 0 end;
  vat_rate := v_rate;
  vat := round((rental + tyre_fee) * v_rate);
  deposit := coalesce(t.deposit_amount, m.deposit);
  total := rental + tyre_fee + vat + deposit;
  return next;
end $$;

-- ---------------------------------------------------------------- create_booking with tyre service
drop function if exists create_booking(uuid, uuid, uuid, uuid[], uuid, timestamptz, timestamptz, uuid, booking_channel, text, text, text);
create or replace function create_booking(
  p_customer_id   uuid,
  p_trailer_id    uuid,
  p_tractor_id    uuid,
  p_driver_ids    uuid[],
  p_guarantor_id  uuid,
  p_pickup_at     timestamptz,
  p_return_at     timestamptz,
  p_return_yard   uuid,
  p_channel       booking_channel default 'WEB',
  p_invoice_name  text default null,
  p_invoice_tax_id text default null,
  p_invoice_address text default null,
  p_tyre_count    int default 0
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := auth_role();
  v_customer customers;
  v_trailer trailers;
  v_model trailer_models;
  v_days int;
  q record;
  b bookings;
  v_driver uuid;
begin
  if v_role is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  select * into v_customer from customers where id = p_customer_id;
  if not found then raise exception 'ไม่พบลูกค้า'; end if;
  if not (v_customer.owner_id = auth.uid() or v_role in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์จองให้ลูกค้ารายนี้';
  end if;
  if v_role = 'CUSTOMER' then p_channel := 'WEB'; end if;
  if v_customer.is_blacklisted then raise exception 'บัญชีนี้จองไม่ได้ กรุณาติดต่อเจ้าหน้าที่'; end if;

  select * into v_trailer from trailers where id = p_trailer_id and retired_at is null for update;
  if not found or v_trailer.status = 'MAINTENANCE' then raise exception 'หางคันนี้ไม่พร้อมให้เช่า'; end if;
  -- rented outside the system (no booking on record): not bookable until Ops marks it available
  if v_trailer.status = 'RENTED' and not exists (
       select 1 from bookings where trailer_id = v_trailer.id and status in ('IN_RENTAL','READY_FOR_PICKUP','CONFIRMED')) then
    raise exception 'หางคันนี้มีผู้เช่าอยู่ ยังไม่ทราบวันคืน กรุณาเลือกคันอื่น';
  end if;
  select * into v_model from trailer_models where id = v_trailer.model_id;
  if not found then raise exception 'หางคันนี้ยังไม่ได้กำหนดราคา'; end if;

  if p_return_at <= p_pickup_at then raise exception 'วันคืนต้องอยู่หลังวันรับ'; end if;
  if p_pickup_at < now() + make_interval(hours => coalesce(setting_num('min_lead_hours'), 24)::int) and v_role = 'CUSTOMER' then
    raise exception 'ต้องจองล่วงหน้าอย่างน้อย % ชั่วโมง', coalesce(setting_num('min_lead_hours'), 24);
  end if;
  if not exists (select 1 from tractors where id = p_tractor_id and customer_id = p_customer_id and is_active) then
    raise exception 'หัวลากไม่ใช่ของลูกค้ารายนี้';
  end if;
  if not exists (select 1 from guarantors where id = p_guarantor_id and customer_id = p_customer_id and is_active) then
    raise exception 'ผู้ค้ำประกันไม่ใช่ของลูกค้ารายนี้';
  end if;
  if coalesce(array_length(p_driver_ids, 1), 0) = 0 then raise exception 'เลือกคนขับอย่างน้อย 1 คน'; end if;
  foreach v_driver in array p_driver_ids loop
    if not exists (select 1 from customer_drivers cd join drivers d on d.id = cd.driver_id
                    where cd.customer_id = p_customer_id and cd.driver_id = v_driver and cd.removed_at is null
                      and not d.is_blacklisted and d.license_expires_on >= p_return_at::date) then
      raise exception 'คนขับบางคนไม่อยู่ในบัญชีนี้ ติด Blacklist หรือใบขับขี่หมดอายุก่อนวันคืน';
    end if;
  end loop;
  if exists (select 1 from maintenance_records m where m.trailer_id = p_trailer_id
              and m.period && tstzrange(p_pickup_at, p_return_at)) then
    raise exception 'หางคันนี้มีกำหนดซ่อมในช่วงเวลาที่เลือก';
  end if;
  if exists (select 1 from trailer_compliance c where c.trailer_id = p_trailer_id and c.expires_on < p_return_at::date) then
    raise exception 'เอกสารหางหมดอายุก่อนวันคืน';
  end if;
  if coalesce(p_tyre_count, 0) > 0 and v_model.tyre_fee = 0 then p_tyre_count := 0; end if;
  if coalesce(p_tyre_count, 0) > v_model.tyre_count then p_tyre_count := v_model.tyre_count; end if;

  v_days := rental_days(p_pickup_at, p_return_at);
  select * into q from quote_rental(p_trailer_id, v_days, p_tyre_count);

  insert into bookings (booking_no, customer_id, trailer_id, guarantor_id, tractor_id,
                        pickup_yard_id, return_yard_id, pickup_at, return_at, lock_range, status, channel, created_by,
                        rate_daily, rate_weekly, rate_monthly, rental_days, contract_months, rate_tier, rental_amount,
                        tyre_count, tyre_fee, vat_rate, vat_amount, deposit_amount, total_amount,
                        invoice_name, invoice_tax_id, invoice_branch, invoice_address)
  values (next_booking_no(), p_customer_id, p_trailer_id, p_guarantor_id, p_tractor_id,
          expected_yard(p_trailer_id, p_pickup_at), coalesce(p_return_yard, expected_yard(p_trailer_id, p_pickup_at)),
          p_pickup_at, p_return_at, tstzrange(p_pickup_at, p_return_at), 'PENDING_REVIEW', p_channel, auth.uid(),
          v_model.daily_rate, null,
          case q.tier when 'MONTHLY_1_5' then v_model.monthly_rate_1_5 when 'MONTHLY_6_11' then v_model.monthly_rate_6_11
                      when 'MONTHLY_12' then v_model.monthly_rate_12 else v_model.monthly_rate end,
          v_days, q.months, q.tier, q.rental, coalesce(p_tyre_count, 0), q.tyre_fee,
          q.vat_rate, q.vat, q.deposit, q.total,
          coalesce(p_invoice_name, v_customer.name), coalesce(p_invoice_tax_id, v_customer.tax_id),
          v_customer.branch, coalesce(p_invoice_address, v_customer.billing_address))
  returning * into b;

  insert into booking_drivers (booking_id, driver_id, is_primary)
  select b.id, d, ord = 1 from unnest(p_driver_ids) with ordinality as x(d, ord);
  insert into booking_documents (booking_id, document_id, requirement_key)
  select b.id, doc.id, doc.requirement_key from documents doc
   where doc.superseded_by is null
     and (doc.customer_id = p_customer_id or doc.guarantor_id = p_guarantor_id
          or doc.tractor_id = p_tractor_id or doc.driver_id = p_driver_ids[1]);
  insert into deposits (booking_id, amount) values (b.id, q.deposit);
  insert into appointments (booking_id, kind, yard_id, scheduled_at, checkin_code, code_valid_from, code_valid_to)
  values
    (b.id, 'PICKUP', b.pickup_yard_id, b.pickup_at, lpad((floor(random() * 1000000))::int::text, 6, '0'),
     b.pickup_at - interval '1 day', b.pickup_at + interval '1 day'),
    (b.id, 'RETURN', b.return_yard_id, b.return_at, lpad((floor(random() * 1000000))::int::text, 6, '0'),
     b.return_at - interval '1 day', b.return_at + interval '1 day');
  return b;
exception
  when exclusion_violation then
    raise exception 'หางคันนี้ถูกจองในช่วงเวลาที่เลือกแล้ว กรุณาเลือกช่วงวันหรือหางคันอื่น';
end $$;

grant execute on function quote_rental(uuid, int, int),
  create_booking(uuid, uuid, uuid, uuid[], uuid, timestamptz, timestamptz, uuid, booking_channel, text, text, text, int)
  to authenticated;
revoke execute on function quote_rental(uuid, int, int),
  create_booking(uuid, uuid, uuid, uuid[], uuid, timestamptz, timestamptz, uuid, booking_channel, text, text, text, int)
  from anon, public;
