-- FAR Service — storage buckets (database.md §14)
-- Safe to run more than once.
-- Paths: documents/{customer_id}/{requirement_key}/{uuid}.{ext}
--        payment-slips/{booking_id}/{uuid}.{ext}
--        inspection-photos/{booking_id}/{inspection_id}/{uuid}.jpg
--        signatures/{booking_id}/{inspection_id}.png

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('trailer-photos',    'trailer-photos',    true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('documents',         'documents',         false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('payment-slips',     'payment-slips',     false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('inspection-photos', 'inspection-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('signatures',        'signatures',        false, 1048576,  array['image/png']),
  ('refund-proofs',     'refund-proofs',     false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- trailer photos: public read, staff write
drop policy if exists "trailer photos read" on storage.objects;
create policy "trailer photos read" on storage.objects for select using (bucket_id = 'trailer-photos');
drop policy if exists "trailer photos staff" on storage.objects;
create policy "trailer photos staff" on storage.objects for all
  using (bucket_id = 'trailer-photos' and public.is_staff())
  with check (bucket_id = 'trailer-photos' and public.is_staff());

-- documents: first folder = customer id
drop policy if exists "documents owner" on storage.objects;
create policy "documents owner" on storage.objects for all
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.my_customer_id()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = public.my_customer_id()::text);
drop policy if exists "documents reviewers" on storage.objects;
create policy "documents reviewers" on storage.objects for all
  using (bucket_id = 'documents' and public.auth_role() in ('SALES','SUPER_ADMIN'))
  with check (bucket_id = 'documents' and public.auth_role() in ('SALES','SUPER_ADMIN'));

-- payment slips: first folder = booking id of the customer
drop policy if exists "slips owner" on storage.objects;
create policy "slips owner" on storage.objects for all
  using (bucket_id = 'payment-slips' and (storage.foldername(name))[1]::uuid in
         (select id from public.bookings where customer_id = public.my_customer_id()))
  with check (bucket_id = 'payment-slips' and (storage.foldername(name))[1]::uuid in
         (select id from public.bookings where customer_id = public.my_customer_id()));
drop policy if exists "slips staff" on storage.objects;
create policy "slips staff" on storage.objects for all
  using (bucket_id in ('payment-slips','refund-proofs') and public.auth_role() in ('SALES','SUPER_ADMIN'))
  with check (bucket_id in ('payment-slips','refund-proofs') and public.auth_role() in ('SALES','SUPER_ADMIN'));

-- inspection photos & signatures: staff write; customer and booked drivers read; drivers may add photos/signature
drop policy if exists "inspection media staff" on storage.objects;
create policy "inspection media staff" on storage.objects for all
  using (bucket_id in ('inspection-photos','signatures') and public.is_staff())
  with check (bucket_id in ('inspection-photos','signatures') and public.is_staff());
drop policy if exists "inspection media parties" on storage.objects;
create policy "inspection media parties" on storage.objects for select
  using (bucket_id in ('inspection-photos','signatures') and (storage.foldername(name))[1]::uuid in (
    select id from public.bookings where customer_id = public.my_customer_id()
    union select booking_id from public.booking_drivers where driver_id = public.my_driver_id()));
drop policy if exists "inspection media driver upload" on storage.objects;
create policy "inspection media driver upload" on storage.objects for insert
  with check (bucket_id in ('inspection-photos','signatures') and (storage.foldername(name))[1]::uuid in (
    select booking_id from public.booking_drivers where driver_id = public.my_driver_id()));
