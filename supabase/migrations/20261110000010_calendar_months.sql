-- Monthly plans (flatbed, chassis) are priced by calendar months, not by days ÷ 30.4375.
-- Before this, 9 Nov → 9 Dec (31 days, or 32 with the return-time remainder) was billed as 2 months.
-- contract_months() = the fewest whole months from the pickup date that reach the return date (Bangkok dates,
-- time of day ignored). quote_rental() takes it as an optional 4th argument; create_booking and the early-return
-- re-price in complete_handover pass it. Safe to run more than once. Run after 20261109000009.

create or replace function contract_months(p_from timestamptz, p_to timestamptz) returns int
language plpgsql immutable as $$
declare
  f date := (p_from at time zone 'Asia/Bangkok')::date;
  t date := (p_to at time zone 'Asia/Bangkok')::date;
  m int;
begin
  m := greatest(1, (extract(year from age(t, f)) * 12 + extract(month from age(t, f)))::int);
  while (f + make_interval(months => m))::date < t loop m := m + 1; end loop;
  return m;
end $$;

drop function if exists quote_rental(uuid, int, int);
create or replace function quote_rental(p_trailer uuid, p_days int, p_tyres int default 0, p_months int default null)
returns table (tier text, months int, rental numeric, tyre_fee numeric, vat_rate numeric, vat numeric,
               deposit numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare t trailers; m trailer_models; v_rate numeric := coalesce(setting_num('vat_rate'), 0.07);
        v_rem int; v_weeks int; v_days int; v_day_cost numeric; v_rem_cost numeric;
begin
  select * into t from trailers where id = p_trailer;
  if not found then raise exception 'ไม่พบหาง'; end if;
  select * into m from trailer_models where id = t.model_id;
  if not found then raise exception 'หางคันนี้ยังไม่ได้กำหนดรุ่นและราคา'; end if;

  if m.rate_plan = 'MONTHLY_TIERED' then
    -- calendar months from the caller when known (contract_months), otherwise converted from days
    months := greatest(1, coalesce(p_months, ceil(p_days / 30.4375)::int));
    if months >= 12 then tier := 'MONTHLY_12'; rental := m.monthly_rate_12 * months;
    elsif months >= 6 then tier := 'MONTHLY_6_11'; rental := m.monthly_rate_6_11 * months;
    else tier := 'MONTHLY_1_5'; rental := m.monthly_rate_1_5 * months;
    end if;
  else
    months := case when m.monthly_rate is null then 0 else floor(p_days / 30.0)::int end;
    v_rem := p_days - months * 30;
    v_weeks := case when m.weekly_rate is null then 0 else floor(v_rem / 7.0)::int end;
    v_days := v_rem - v_weeks * 7;
    v_day_cost := m.daily_rate * v_days;
    tier := case when months > 0 then 'MONTHLY' when v_weeks > 0 then 'WEEKLY' else 'DAILY' end;
    if m.weekly_rate is not null and v_day_cost > m.weekly_rate then
      v_day_cost := m.weekly_rate;
      if tier = 'DAILY' then tier := 'WEEKLY'; end if;
    end if;
    v_rem_cost := coalesce(m.weekly_rate, 0) * v_weeks + v_day_cost;
    if m.monthly_rate is not null and v_rem_cost > m.monthly_rate then
      v_rem_cost := m.monthly_rate;
      tier := 'MONTHLY';
    end if;
    rental := coalesce(m.monthly_rate, 0) * months + v_rem_cost;
  end if;

  tyre_fee := case when m.tyre_fee > 0 then m.tyre_fee * greatest(coalesce(p_tyres, 0), 0) else 0 end;
  vat_rate := v_rate;
  vat := round((rental + tyre_fee) * v_rate);
  deposit := coalesce(t.deposit_amount, m.deposit);
  total := rental + tyre_fee + vat + deposit;
  return next;
end $$;

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
  select * into q from quote_rental(p_trailer_id, v_days, p_tyre_count, contract_months(p_pickup_at, p_return_at));

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
    select * into q from quote_rental(b.trailer_id, v_days, b.tyre_count, contract_months(b.pickup_at, b.actual_return_at));
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

grant execute on function contract_months(timestamptz, timestamptz) to authenticated, anon;
grant execute on function quote_rental(uuid, int, int, int) to authenticated;
revoke execute on function quote_rental(uuid, int, int, int) from anon, public;
