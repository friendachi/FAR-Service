-- FAR Service — functions, triggers and business rules (database.md §12)

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['yards','checklist_templates','profiles','customers','guarantors','tractors','drivers',
                           'trailers','documents','bookings','extra_charges','payments','deposits','appointments','inspections']
  loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('SUPER_ADMIN','SALES','OPS'), false)
$$;

create or replace function my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from customers where owner_id = auth.uid()
$$;

create or replace function my_driver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from drivers where profile_id = auth.uid()
$$;

create or replace function setting_num(p_key text) returns numeric
language sql stable security definer set search_path = public as $$
  select (value #>> '{}')::numeric from settings where key = p_key
$$;

create or replace function setting_text(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select value #>> '{}' from settings where key = p_key
$$;

-- ---------------------------------------------------------------- new auth user → profile (+ customer)
-- Role comes from app_metadata (only the service role can set it). Customer details come from the
-- sign-up form's user_metadata: customer_kind, customer_name, tax_id, phone, full_name.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := coalesce((new.raw_app_meta_data ->> 'role')::app_role, 'CUSTOMER');
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into profiles (id, role, full_name, phone, email)
  values (new.id, v_role, coalesce(v_meta ->> 'full_name', v_meta ->> 'customer_name', ''),
          nullif(v_meta ->> 'phone', ''), new.email);

  if v_role = 'CUSTOMER' and v_meta ? 'tax_id' then
    -- A customer created by staff on behalf of a caller is claimed by matching tax id.
    update customers set owner_id = new.id
     where tax_id = v_meta ->> 'tax_id' and owner_id is null;
    if not found then
      insert into customers (owner_id, kind, name, tax_id, contact_name, phone, email, pdpa_consent_at,
                             marketing_consent, created_by)
      values (new.id, (v_meta ->> 'customer_kind')::customer_kind, v_meta ->> 'customer_name', v_meta ->> 'tax_id',
              v_meta ->> 'full_name', v_meta ->> 'phone', new.email, now(),
              coalesce((v_meta ->> 'marketing_consent')::boolean, false), new.id);
    end if;
  end if;

  if v_role = 'DRIVER' then
    update drivers set profile_id = new.id
     where profile_id is null and phone = regexp_replace(coalesce(v_meta ->> 'phone', new.phone, ''), '\D', '', 'g');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- booking number (§12.1)
create or replace function next_booking_no() returns text
language plpgsql security definer set search_path = public as $$
declare k char(4) := to_char(now() at time zone 'Asia/Bangkok', 'YYMM'); n int;
begin
  insert into booking_counters values (k, 1)
  on conflict (yymm) do update set last_no = booking_counters.last_no + 1
  returning last_no into n;
  return format('FAR-%s-%s', k, lpad(n::text, 5, '0'));
end $$;

-- ---------------------------------------------------------------- lock range + no double booking (§12.2)
create or replace function set_lock_range() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.lock_range := tstzrange(new.pickup_at,
                              new.return_at + coalesce(setting_text('booking_buffer'), '1 day')::interval, '[)');
  return new;
end $$;

create trigger bookings_lock_range before insert or update of pickup_at, return_at
  on bookings for each row execute function set_lock_range();

alter table bookings add constraint bookings_no_overlap
  exclude using gist (trailer_id with =, lock_range with &&)
  where (status in ('PENDING_REVIEW','NEED_MORE_DOCS','APPROVED_AWAITING_PAYMENT','CONFIRMED',
                    'READY_FOR_PICKUP','IN_RENTAL','RETURNED_PENDING_SETTLEMENT'));

-- ---------------------------------------------------------------- status history
create or replace function log_booking_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into booking_status_history (booking_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger bookings_status_log after insert or update of status on bookings
  for each row execute function log_booking_status();

-- ---------------------------------------------------------------- pricing (BR-01, BR-02, D15)
create or replace function rental_days(p_from timestamptz, p_to timestamptz) returns int
language sql stable as $$
  select greatest(1,
    floor(extract(epoch from (p_to - p_from)) / 86400)::int
    + case when extract(epoch from (p_to - p_from)) / 3600
                - floor(extract(epoch from (p_to - p_from)) / 86400) * 24
                > coalesce(setting_num('day_remainder_hours'), 3) then 1 else 0 end)
$$;

create or replace function quote_rental(p_trailer uuid, p_days int)
returns table (tier rate_tier, rental numeric, vat_rate numeric, vat numeric, deposit numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare t trailers; v_rate numeric := coalesce(setting_num('vat_rate'), 0.07);
begin
  select * into t from trailers where id = p_trailer;
  if not found then raise exception 'ไม่พบหาง'; end if;
  if p_days >= coalesce(setting_num('monthly_tier_min_days'), 30) then
    tier := 'MONTHLY'; rental := round(t.monthly_rate / 30 * p_days);
  elsif p_days >= coalesce(setting_num('weekly_tier_min_days'), 7) then
    tier := 'WEEKLY';  rental := round(t.weekly_rate / 7 * p_days);
  else
    tier := 'DAILY';   rental := t.daily_rate * p_days;
  end if;
  vat_rate := v_rate;
  vat := round(rental * v_rate);
  deposit := coalesce(t.deposit_amount, (select default_deposit from trailer_types where code = t.type));
  total := rental + vat + deposit;
  return next;
end $$;

-- ---------------------------------------------------------------- expected yard on a date (BR-22)
create or replace function expected_yard(p_trailer uuid, p_at timestamptz) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select b.return_yard_id from bookings b
      where b.trailer_id = p_trailer and b.return_at <= p_at
        and b.status not in ('REJECTED','CANCELLED','EXPIRED','DRAFT')
      order by b.return_at desc limit 1),
    (select current_yard_id from trailers where id = p_trailer))
$$;

-- ---------------------------------------------------------------- create booking (§12.3)
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
  p_invoice_address text default null
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := auth_role();
  v_customer customers;
  v_trailer trailers;
  v_days int;
  q record;
  b bookings;
  v_driver uuid;
begin
  if v_role is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  select * into v_customer from customers where id = p_customer_id;
  if not found then raise exception 'ไม่พบลูกค้า'; end if;

  -- who may book (D3, D5): the customer themself, or Sales / Super Admin on their behalf
  if not (v_customer.owner_id = auth.uid() or v_role in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์จองให้ลูกค้ารายนี้';
  end if;
  if v_role = 'CUSTOMER' then p_channel := 'WEB'; end if;
  if v_customer.is_blacklisted then raise exception 'บัญชีนี้จองไม่ได้ กรุณาติดต่อเจ้าหน้าที่'; end if;

  select * into v_trailer from trailers where id = p_trailer_id and retired_at is null for update;
  if not found or v_trailer.status = 'MAINTENANCE' then raise exception 'หางคันนี้ไม่พร้อมให้เช่า'; end if;
  if p_return_at <= p_pickup_at then raise exception 'วันคืนต้องอยู่หลังวันรับ'; end if;
  if p_pickup_at < now() + make_interval(hours => coalesce(setting_num('min_lead_hours'), 24)::int) and v_role = 'CUSTOMER' then
    raise exception 'ต้องจองล่วงหน้าอย่างน้อย % ชั่วโมง', coalesce(setting_num('min_lead_hours'), 24);
  end if;

  -- tractor, guarantor and drivers must belong to this customer (BR-19)
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

  -- trailer must be at the pickup yard on that day (BR-22) and not under maintenance
  if exists (select 1 from maintenance_records m where m.trailer_id = p_trailer_id
              and m.period && tstzrange(p_pickup_at, p_return_at)) then
    raise exception 'หางคันนี้มีกำหนดซ่อมในช่วงเวลาที่เลือก';
  end if;
  if exists (select 1 from trailer_compliance c where c.trailer_id = p_trailer_id and c.expires_on < p_return_at::date) then
    raise exception 'เอกสารหางหมดอายุก่อนวันคืน';
  end if;

  -- price is always computed here, never taken from the client (BR-20)
  v_days := rental_days(p_pickup_at, p_return_at);
  select * into q from quote_rental(p_trailer_id, v_days);

  insert into bookings (booking_no, customer_id, trailer_id, guarantor_id, tractor_id,
                        pickup_yard_id, return_yard_id, pickup_at, return_at, lock_range, status, channel, created_by,
                        rate_daily, rate_weekly, rate_monthly, rental_days, rate_tier, rental_amount,
                        vat_rate, vat_amount, deposit_amount, total_amount,
                        invoice_name, invoice_tax_id, invoice_branch, invoice_address)
  values (next_booking_no(), p_customer_id, p_trailer_id, p_guarantor_id, p_tractor_id,
          expected_yard(p_trailer_id, p_pickup_at), coalesce(p_return_yard, expected_yard(p_trailer_id, p_pickup_at)),
          p_pickup_at, p_return_at, tstzrange(p_pickup_at, p_return_at), 'PENDING_REVIEW', p_channel, auth.uid(),
          v_trailer.daily_rate, v_trailer.weekly_rate, v_trailer.monthly_rate, v_days, q.tier, q.rental,
          q.vat_rate, q.vat, q.deposit, q.total,
          coalesce(p_invoice_name, v_customer.name), coalesce(p_invoice_tax_id, v_customer.tax_id),
          v_customer.branch, coalesce(p_invoice_address, v_customer.billing_address))
  returning * into b;
  -- (bookings_no_overlap raises exclusion_violation here if the trailer is already locked)

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

-- ---------------------------------------------------------------- document review (FR-APV-04)
create or replace function review_document(p_document uuid, p_approve boolean, p_reason text default null,
                                           p_checks jsonb default null) returns documents
language plpgsql security definer set search_path = public as $$
declare d documents;
begin
  if auth_role() not in ('SALES','SUPER_ADMIN') then raise exception 'ไม่มีสิทธิ์ตรวจเอกสาร'; end if;
  if not p_approve and coalesce(p_reason, '') = '' then raise exception 'ระบุเหตุผลที่ไม่ผ่าน'; end if;
  update documents set status = case when p_approve then 'APPROVED' else 'REJECTED' end::doc_status,
         reject_reason = case when p_approve then null else p_reason end,
         review_checks = p_checks, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_document returning * into d;
  return d;
end $$;

-- ---------------------------------------------------------------- approval rule (BR-15, D6, D9)
create or replace function assert_can_decide(p_booking bookings) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_role app_role := auth_role(); v_creator app_role;
begin
  if v_role not in ('SALES','SUPER_ADMIN') then raise exception 'ไม่มีสิทธิ์อนุมัติ'; end if;
  select role into v_creator from profiles where id = p_booking.created_by;
  if v_role = 'SALES' and v_creator = 'SALES' then
    raise exception 'การจองที่ Sales สร้างแทนลูกค้า ต้องให้ Super Admin อนุมัติ';
  end if;
end $$;

-- Required documents (by customer kind) that do not yet have an approved current version.
create or replace function missing_documents(p_booking uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r.label order by r.sort_order), '{}')
    from bookings b
    join customers c on c.id = b.customer_id
    join doc_requirements r on r.is_required and (r.applies_to is null or c.kind = any(r.applies_to))
   where b.id = p_booking
     and not exists (
       select 1 from documents d
        where d.requirement_key = r.key and d.superseded_by is null and d.status = 'APPROVED'
          and case r.owner
                when 'CUSTOMER'  then d.customer_id = b.customer_id
                when 'GUARANTOR' then d.guarantor_id = b.guarantor_id
                when 'TRACTOR'   then d.tractor_id = b.tractor_id
                when 'DRIVER'    then d.driver_id = (select driver_id from booking_drivers
                                                      where booking_id = b.id and is_primary limit 1)
              end)
$$;

create or replace function approve_booking(p_booking uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('PENDING_REVIEW','NEED_MORE_DOCS') then raise exception 'สถานะนี้อนุมัติไม่ได้'; end if;
  perform assert_can_decide(b);
  if cardinality(missing_documents(b.id)) > 0 then
    raise exception 'ยังมีเอกสารที่ไม่ผ่านการตรวจ: %', array_to_string(missing_documents(b.id), ', ');
  end if;
  update bookings set status = 'APPROVED_AWAITING_PAYMENT', approved_by = auth.uid(), approved_at = now(),
         self_approved = (created_by = auth.uid()),
         payment_due_at = now() + make_interval(hours => coalesce(setting_num('payment_window_hours'), 24)::int)
   where id = b.id returning * into b;
  return b;
end $$;

create or replace function request_more_docs(p_booking uuid, p_note text) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('PENDING_REVIEW','NEED_MORE_DOCS') then raise exception 'สถานะนี้ขอเอกสารเพิ่มไม่ได้'; end if;
  perform assert_can_decide(b);
  update bookings set status = 'NEED_MORE_DOCS', internal_note = coalesce(p_note, internal_note),
         need_docs_due_at = now() + make_interval(hours => coalesce(setting_num('need_docs_window_hours'), 48)::int)
   where id = b.id returning * into b;
  return b;
end $$;

create or replace function reject_booking(p_booking uuid, p_reason text) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('PENDING_REVIEW','NEED_MORE_DOCS') then raise exception 'สถานะนี้ปฏิเสธไม่ได้'; end if;
  perform assert_can_decide(b);
  update bookings set status = 'REJECTED', reject_reason = p_reason where id = b.id returning * into b;
  return b;
end $$;

-- ---------------------------------------------------------------- customer resubmits documents
create or replace function resubmit_documents(p_booking uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.customer_id is distinct from my_customer_id() and auth_role() not in ('SALES','SUPER_ADMIN') then
    raise exception 'ไม่มีสิทธิ์';
  end if;
  if b.status <> 'NEED_MORE_DOCS' then raise exception 'การจองนี้ไม่ได้รอเอกสารเพิ่ม'; end if;
  -- point the booking at the latest version of each document
  delete from booking_documents where booking_id = b.id;
  insert into booking_documents (booking_id, document_id, requirement_key)
  select b.id, doc.id, doc.requirement_key from documents doc
   where doc.superseded_by is null
     and (doc.customer_id = b.customer_id or doc.guarantor_id = b.guarantor_id or doc.tractor_id = b.tractor_id
          or doc.driver_id = (select driver_id from booking_drivers where booking_id = b.id and is_primary limit 1));
  update bookings set status = 'PENDING_REVIEW', need_docs_due_at = null where id = b.id returning * into b;
  return b;
end $$;

-- ---------------------------------------------------------------- payments (D2, D10, BR-17, BR-18)
create or replace function submit_payment(p_booking uuid, p_method payment_method, p_slip_path text default null)
returns payments
language plpgsql security definer set search_path = public as $$
declare b bookings; p payments;
begin
  select * into b from bookings where id = p_booking;
  if b.customer_id is distinct from my_customer_id() and auth_role() not in ('SALES','SUPER_ADMIN') then
    raise exception 'ไม่มีสิทธิ์';
  end if;
  if b.status <> 'APPROVED_AWAITING_PAYMENT' then
    raise exception 'ชำระได้หลังการจองได้รับอนุมัติเท่านั้น';
  end if;
  if p_method = 'TRANSFER' and coalesce(p_slip_path, '') = '' then raise exception 'แนบสลิปการโอน'; end if;
  insert into payments (booking_id, method, amount, status, slip_path, recorded_by)
  values (b.id, p_method, b.total_amount, 'PENDING_VERIFICATION', p_slip_path, auth.uid())
  returning * into p;
  return p;
end $$;

create or replace function verify_payment(p_payment uuid, p_approve boolean) returns payments
language plpgsql security definer set search_path = public as $$
declare p payments; v_role app_role := auth_role(); v_recorder app_role;
begin
  if v_role not in ('SALES','SUPER_ADMIN') then raise exception 'ไม่มีสิทธิ์ยืนยันการชำระ'; end if;
  select * into p from payments where id = p_payment for update;
  select role into v_recorder from profiles where id = p.recorded_by;
  if v_role = 'SALES' and v_recorder = 'SALES' then
    raise exception 'การชำระที่ Sales บันทึกแทนลูกค้า ต้องให้ Super Admin ยืนยัน';
  end if;
  if p.status <> 'PENDING_VERIFICATION' then raise exception 'รายการนี้ไม่ได้รอตรวจ'; end if;

  if p_approve then
    update payments set status = 'PAID', verified_by = auth.uid(), verified_at = now(), paid_at = now()
     where id = p.id returning * into p;
    if p.purpose = 'RENTAL_AND_DEPOSIT' then
      update bookings set status = 'CONFIRMED' where id = p.booking_id;
      update deposits set status = 'HELD' where booking_id = p.booking_id;
    end if;
  else
    update payments set status = 'REJECTED', verified_by = auth.uid(), verified_at = now()
     where id = p.id returning * into p;
  end if;
  return p;
end $$;

-- ---------------------------------------------------------------- cancellation (D17, BR-08)
create or replace function cancel_booking(p_booking uuid, p_reason text default null) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; v_role app_role := auth_role(); v_paid boolean; v_fee numeric;
begin
  select * into b from bookings where id = p_booking for update;
  if not (b.customer_id = my_customer_id() or v_role in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์ยกเลิก';
  end if;
  if b.status not in ('PENDING_REVIEW','NEED_MORE_DOCS','APPROVED_AWAITING_PAYMENT','CONFIRMED','READY_FOR_PICKUP') then
    raise exception 'ยกเลิกได้ก่อนรับหางเท่านั้น';
  end if;
  v_paid := b.status in ('CONFIRMED','READY_FOR_PICKUP');
  v_fee := case when v_paid and v_role = 'CUSTOMER' then setting_num('cancellation_fee') end;
  if v_fee is not null and v_fee > 0 then
    insert into extra_charges (booking_id, kind, amount, description, status, approved_by)
    values (b.id, 'CANCELLATION_FEE', v_fee, 'ค่าธรรมเนียมยกเลิกก่อนรับหาง', 'APPROVED', auth.uid());
  end if;
  update bookings set status = 'CANCELLED', cancel_reason = p_reason, cancelled_by = auth.uid(),
         cancellation_fee = v_fee
   where id = b.id returning * into b;
  -- refunds are recorded by Sales/SA when the money is actually transferred back
  return b;
end $$;

-- ---------------------------------------------------------------- audit log (FR-ADM-19)
create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor_id, action, table_name, row_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'key',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'booking_id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['bookings','payments','refunds','deposits','extra_charges','trailers','documents',
                           'profiles','customers','settings']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit_row()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- views (§15)
-- Runs with the view owner's rights (drivers cannot read bookings directly) and filters to the
-- signed-in driver, exposing no money or company documents (PRD §5.1 note 2).
create or replace view driver_appointments_v as
select a.id, a.booking_id, a.kind, a.scheduled_at, a.checkin_code, a.completed_at,
       y.code as yard_code, y.number as yard_number, y.short_name as yard_short, y.address as yard_address,
       y.map_url as yard_map_url,
       t.id as trailer_id, t.code as trailer_code, t.plate_no as trailer_plate, t.type as trailer_type,
       t.length_ft as trailer_length_ft,
       tr.plate_no || ' ' || tr.province as tractor_plate, b.booking_no, b.status as booking_status,
       b.flagged_reason, c.name as customer_name
  from appointments a
  join bookings b on b.id = a.booking_id
  join booking_drivers bd on bd.booking_id = b.id and bd.driver_id = my_driver_id()
  join yards y on y.id = a.yard_id
  join trailers t on t.id = b.trailer_id
  join tractors tr on tr.id = b.tractor_id
  join customers c on c.id = b.customer_id;

create or replace view revenue_by_month_v with (security_invoker = true) as
select date_trunc('month', pickup_at at time zone 'Asia/Bangkok')::date as month,
       sum(coalesce(recalculated_rental, rental_amount)) as rental
  from bookings
 where status in ('CONFIRMED','READY_FOR_PICKUP','IN_RENTAL','RETURNED_PENDING_SETTLEMENT','COMPLETED')
 group by 1;

revoke all on driver_appointments_v from anon;

-- RPCs callable by signed-in users only
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- RLS policies call these helpers for anonymous visitors too (public trailer search)
grant execute on function auth_role(), is_staff(), my_customer_id(), my_driver_id(), expected_yard(uuid, timestamptz)
  to anon;
