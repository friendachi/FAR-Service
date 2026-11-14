-- FAR Service — Row Level Security (database.md §13)
-- Business writes (bookings, approvals, payments, documents, drivers) go through
-- security-definer RPCs; table policies below cover reads and simple owner edits.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- reference data
create policy yards_read on yards for select using (true);
create policy yards_admin on yards for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

create policy trailer_types_read on trailer_types for select using (true);
create policy trailer_types_admin on trailer_types for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

create policy doc_requirements_read on doc_requirements for select using (true);
create policy doc_requirements_admin on doc_requirements for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

create policy checklist_templates_read on checklist_templates for select using (is_staff() or auth.uid() is not null);
create policy checklist_templates_admin on checklist_templates for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');
create policy checklist_items_read on checklist_template_items for select using (auth.uid() is not null);
create policy checklist_items_admin on checklist_template_items for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

-- settings: everyone signed in may read policy values (prices need VAT etc.), only SA writes
create policy settings_read on settings for select using (true);
create policy settings_admin on settings for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------- profiles
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_staff());
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));
create policy profiles_admin on profiles for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------- customers & their things
create policy customers_read on customers for select
  using (owner_id = auth.uid() or is_staff()
         or id in (select customer_id from customer_drivers where driver_id = my_driver_id()));
create policy customers_owner_update on customers for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and is_blacklisted = false);
create policy customers_staff_write on customers for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy guarantors_read on guarantors for select using (customer_id = my_customer_id() or is_staff());
create policy guarantors_owner_write on guarantors for all
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());
create policy guarantors_staff_write on guarantors for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy tractors_read on tractors for select using (customer_id = my_customer_id() or is_staff());
create policy tractors_owner_write on tractors for all
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());
create policy tractors_staff_write on tractors for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy drivers_read on drivers for select
  using (is_staff() or profile_id = auth.uid()
         or id in (select driver_id from customer_drivers where customer_id = my_customer_id() and removed_at is null));
create policy drivers_self_update on drivers for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy drivers_staff_write on drivers for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy customer_drivers_read on customer_drivers for select
  using (customer_id = my_customer_id() or driver_id = my_driver_id() or is_staff());
create policy customer_drivers_owner_update on customer_drivers for update
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());

create policy invites_read on invites for select
  using (is_staff() or customer_id = my_customer_id()
         or driver_id in (select driver_id from customer_drivers where customer_id = my_customer_id()));

-- ---------------------------------------------------------------- fleet
create policy trailers_public_read on trailers for select using ((is_published and retired_at is null) or is_staff());
create policy trailers_staff_insert on trailers for insert with check (is_staff());
create policy trailers_staff_update on trailers for update using (is_staff()) with check (is_staff());
-- OPS may not change prices (handled in trigger below)

create policy trailer_photos_read on trailer_photos for select using (true);
create policy trailer_photos_staff on trailer_photos for all using (is_staff()) with check (is_staff());
create policy trailer_compliance_staff on trailer_compliance for all using (is_staff()) with check (is_staff());
create policy maintenance_read on maintenance_records for select using (is_staff());
create policy maintenance_write on maintenance_records for all
  using (auth_role() in ('OPS','SUPER_ADMIN')) with check (auth_role() in ('OPS','SUPER_ADMIN'));
create policy yard_transfers_read on yard_transfers for select using (is_staff());
create policy yard_transfers_write on yard_transfers for insert with check (auth_role() in ('OPS','SUPER_ADMIN'));

create or replace function guard_trailer_prices() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() = 'OPS' and (new.daily_rate, new.weekly_rate, new.monthly_rate)
                          is distinct from (old.daily_rate, old.weekly_rate, old.monthly_rate) then
    raise exception 'Staff (Ops) แก้เรทราคาไม่ได้';
  end if;
  if auth_role() <> 'SUPER_ADMIN' and new.deposit_amount is distinct from old.deposit_amount then
    raise exception 'แก้เงินค้ำประกันได้เฉพาะ Super Admin';
  end if;
  if auth_role() = 'SALES' and new.retired_at is distinct from old.retired_at then
    raise exception 'ปลดระวางหางได้เฉพาะ Ops และ Super Admin';
  end if;
  return new;
end $$;
create trigger trailers_guard before update on trailers for each row execute function guard_trailer_prices();

-- ---------------------------------------------------------------- documents
create policy documents_read on documents for select using (
  auth_role() in ('SALES','SUPER_ADMIN')
  or customer_id = my_customer_id()
  or guarantor_id in (select id from guarantors where customer_id = my_customer_id())
  or tractor_id in (select id from tractors where customer_id = my_customer_id())
  or driver_id in (select driver_id from customer_drivers where customer_id = my_customer_id())
  or driver_id = my_driver_id()
  -- Ops see only what they check at the gate
  or (auth_role() = 'OPS' and requirement_key in ('driver_license','tractor_book'))
);

-- ---------------------------------------------------------------- bookings
create policy bookings_read on bookings for select using (
  is_staff() or customer_id = my_customer_id()
);
create policy bookings_staff_note on bookings for update
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy booking_drivers_read on booking_drivers for select using (
  is_staff() or driver_id = my_driver_id()
  or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy booking_documents_read on booking_documents for select using (
  auth_role() in ('SALES','SUPER_ADMIN') or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy booking_history_read on booking_status_history for select using (
  is_staff() or booking_id in (select id from bookings where customer_id = my_customer_id())
);

-- ---------------------------------------------------------------- money
create policy payments_read on payments for select using (
  auth_role() in ('SALES','SUPER_ADMIN') or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy refunds_read on refunds for select using (
  auth_role() in ('SALES','SUPER_ADMIN') or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy refunds_write on refunds for insert with check (auth_role() in ('SALES','SUPER_ADMIN'));
create policy deposits_read on deposits for select using (
  auth_role() in ('SALES','SUPER_ADMIN') or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy deposits_write on deposits for update
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));
create policy extra_charges_read on extra_charges for select using (
  is_staff() or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy extra_charges_propose on extra_charges for insert with check (is_staff() and status = 'PROPOSED');
create policy extra_charges_decide on extra_charges for update
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

-- ---------------------------------------------------------------- yard work
create policy appointments_read on appointments for select using (
  is_staff()
  or booking_id in (select id from bookings where customer_id = my_customer_id())
  or booking_id in (select booking_id from booking_drivers where driver_id = my_driver_id())
);
create policy appointments_ops on appointments for update
  using (auth_role() in ('OPS','SUPER_ADMIN')) with check (auth_role() in ('OPS','SUPER_ADMIN'));

create policy inspections_read on inspections for select using (
  is_staff()
  or appointment_id in (select a.id from appointments a join bookings b on b.id = a.booking_id
                         where b.customer_id = my_customer_id())
  or appointment_id in (select a.id from appointments a join booking_drivers bd on bd.booking_id = a.booking_id
                         where bd.driver_id = my_driver_id())
);
create policy inspections_ops on inspections for all
  using (auth_role() in ('OPS','SUPER_ADMIN')) with check (auth_role() in ('OPS','SUPER_ADMIN'));

create policy inspection_items_read on inspection_items for select
  using (inspection_id in (select id from inspections));          -- inherits inspections_read
create policy inspection_items_ops on inspection_items for all
  using (auth_role() in ('OPS','SUPER_ADMIN')) with check (auth_role() in ('OPS','SUPER_ADMIN'));

create policy inspection_photos_read on inspection_photos for select using (inspection_id in (select id from inspections));
create policy inspection_photos_write on inspection_photos for insert
  with check (auth_role() in ('OPS','SUPER_ADMIN') or (auth_role() = 'DRIVER' and inspection_id in (select id from inspections)));

create policy acks_read on driver_acknowledgements for select using (inspection_id in (select id from inspections));
create policy acks_driver on driver_acknowledgements for insert with check (
  (driver_id = my_driver_id() and inspection_id in (select id from inspections))
  or auth_role() in ('OPS','SUPER_ADMIN')               -- signed on the yard tablet
);

-- ---------------------------------------------------------------- system
create policy notifications_own on notifications for select using (recipient_id = auth.uid());
create policy notifications_mark_read on notifications for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
create policy audit_read on audit_logs for select using (auth_role() = 'SUPER_ADMIN');
create policy contact_insert on contact_messages for insert with check (true);
create policy contact_staff on contact_messages for select using (auth_role() in ('SALES','SUPER_ADMIN'));
create policy contact_staff_update on contact_messages for update
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));
-- booking_counters: no policy → only security-definer functions touch it

-- ---------------------------------------------------------------- RPCs for owner-side writes
-- Add (or reuse by phone) a driver, link to the customer, and record an invite.
create or replace function add_driver(p_customer uuid, p_full_name text, p_phone text, p_license_no text,
                                      p_license_class text, p_license_expires date) returns drivers
language plpgsql security definer set search_path = public as $$
declare d drivers; v_phone text := regexp_replace(p_phone, '\D', '', 'g');
begin
  if not (p_customer = my_customer_id() or auth_role() in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์เพิ่มคนขับให้ลูกค้ารายนี้';
  end if;
  if p_license_expires <= current_date then raise exception 'ใบขับขี่หมดอายุแล้ว'; end if;
  select * into d from drivers where phone = v_phone;
  if not found then
    insert into drivers (full_name, phone, license_no, license_class, license_expires_on)
    values (p_full_name, v_phone, p_license_no, p_license_class, p_license_expires) returning * into d;
  end if;
  insert into customer_drivers (customer_id, driver_id, added_by) values (p_customer, d.id, auth.uid())
  on conflict (customer_id, driver_id) do update set removed_at = null;
  if d.profile_id is null then
    insert into invites (kind, customer_id, driver_id, phone, token_hash, invited_by)
    values ('DRIVER', p_customer, d.id, v_phone, encode(sha256(gen_random_uuid()::text::bytea), 'hex'), auth.uid());
  end if;
  return d;
end $$;

create or replace function resend_driver_invite(p_driver uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (p_driver in (select driver_id from customer_drivers where customer_id = my_customer_id())
          or auth_role() in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์';
  end if;
  update invites set sent_count = sent_count + 1, last_sent_at = now(), expires_at = now() + interval '7 days'
   where driver_id = p_driver and accepted_at is null;
  if not found then
    insert into invites (kind, driver_id, phone, token_hash, invited_by)
    select 'DRIVER', id, phone, encode(sha256(gen_random_uuid()::text::bytea), 'hex'), auth.uid()
      from drivers where id = p_driver;
  end if;
end $$;

-- Register an uploaded file as the current version of a required document.
create or replace function register_document(p_requirement text, p_owner doc_owner, p_owner_id uuid,
                                             p_storage_path text, p_file_name text, p_mime text, p_size int,
                                             p_expires date default null) returns documents
language plpgsql security definer set search_path = public as $$
declare d documents; v_mine boolean;
begin
  v_mine := case p_owner
    when 'CUSTOMER'  then p_owner_id = my_customer_id()
    when 'GUARANTOR' then p_owner_id in (select id from guarantors where customer_id = my_customer_id())
    when 'TRACTOR'   then p_owner_id in (select id from tractors where customer_id = my_customer_id())
    when 'DRIVER'    then p_owner_id in (select driver_id from customer_drivers where customer_id = my_customer_id())
                          or p_owner_id = my_driver_id()
  end;
  if not (coalesce(v_mine, false) or auth_role() in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์อัปโหลดเอกสารนี้';
  end if;
  if (select owner from doc_requirements where key = p_requirement) is distinct from p_owner then
    raise exception 'ประเภทเอกสารไม่ตรงกับเจ้าของ';
  end if;

  insert into documents (requirement_key, customer_id, guarantor_id, tractor_id, driver_id,
                         storage_path, file_name, mime_type, size_bytes, expires_on, uploaded_by)
  values (p_requirement,
          case when p_owner = 'CUSTOMER' then p_owner_id end,
          case when p_owner = 'GUARANTOR' then p_owner_id end,
          case when p_owner = 'TRACTOR' then p_owner_id end,
          case when p_owner = 'DRIVER' then p_owner_id end,
          p_storage_path, p_file_name, p_mime, p_size, p_expires, auth.uid())
  returning * into d;
  -- the unique "current" index is enforced after the old version is superseded
  return d;
end $$;

-- Supersede the previous current version before a new one is inserted.
create or replace function supersede_document() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update documents set superseded_by = new.id
   where requirement_key = new.requirement_key and superseded_by is null and id <> new.id
     and coalesce(customer_id, guarantor_id, tractor_id, driver_id)
       = coalesce(new.customer_id, new.guarantor_id, new.tractor_id, new.driver_id);
  return new;
end $$;
-- documents_current_uq must be deferrable for the swap; recreate it as a constraint trigger check instead
drop index documents_current_uq;
create trigger documents_supersede after insert on documents for each row execute function supersede_document();
create index documents_current_idx on documents
  (requirement_key, coalesce(customer_id, guarantor_id, tractor_id, driver_id)) where superseded_by is null;

grant execute on function add_driver(uuid, text, text, text, text, date), resend_driver_invite(uuid),
  register_document(text, doc_owner, uuid, text, text, text, int, date) to authenticated;
revoke execute on function add_driver(uuid, text, text, text, text, date), resend_driver_invite(uuid),
  register_document(text, doc_owner, uuid, text, text, text, int, date) from anon, public;
