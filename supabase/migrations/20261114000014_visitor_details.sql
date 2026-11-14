-- Visitor details for the traffic report (for planning ads): where visitors are (country / province / city from
-- the hosting provider's IP lookup), device type, operating system, browser / in-app browser (LINE, Facebook)
-- and where they came from (search, Facebook, LINE, ad campaign). Staff visits are left out of the report.
-- Safe to run more than once. Run after 20261113000013.

alter table page_views add column if not exists country      text check (char_length(country) <= 60);
alter table page_views add column if not exists region       text check (char_length(region) <= 80);
alter table page_views add column if not exists city         text check (char_length(city) <= 80);
alter table page_views add column if not exists device       text check (device in ('mobile', 'tablet', 'desktop'));
alter table page_views add column if not exists os           text check (char_length(os) <= 40);
alter table page_views add column if not exists browser      text check (char_length(browser) <= 40);
alter table page_views add column if not exists language     text check (char_length(language) <= 20);
alter table page_views add column if not exists source       text check (char_length(source) <= 80);
alter table page_views add column if not exists utm_campaign text check (char_length(utm_campaign) <= 120);

-- Visits by customers / the public only (staff browsing the site is left out). Read only by the functions below.
create or replace view page_views_public as
  select v.* from page_views v
   where not exists (select 1 from profiles p where p.id = v.profile_id and p.role in ('SUPER_ADMIN', 'SALES', 'OPS'));
revoke all on page_views_public from anon, authenticated, public;

-- Visitors per value of one column (top 12, unknown values grouped as null). Used by analytics_summary only.
create or replace function analytics_breakdown(p_col text, p_from timestamptz) returns jsonb
language plpgsql stable set search_path = public as $$
declare r jsonb;
begin
  if p_col not in ('region', 'city', 'country', 'device', 'os', 'browser', 'source', 'utm_campaign', 'language') then
    raise exception 'bad column';
  end if;
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''name'', k, ''visitors'', u, ''views'', v) order by u desc), ''[]'')
       from (select %1$I k, count(distinct visitor_id) u, count(*) v from page_views_public where created_at >= $1
              group by 1 order by 2 desc limit 12) x', p_col)
    into r using p_from;
  return r;
end $$;
revoke execute on function analytics_breakdown(text, timestamptz) from anon, public, authenticated;

-- Super Admin traffic report for the last p_days days (Bangkok dates), staff visits excluded.
create or replace function analytics_summary(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'
                              - make_interval(days => greatest(p_days, 1) - 1);
        v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
begin
  if auth_role() is distinct from 'SUPER_ADMIN' then raise exception 'ดูสถิติได้เฉพาะ Super Admin'; end if;
  return jsonb_build_object(
    'all_time_views', (select count(*) from page_views_public),
    'all_time_visitors', (select count(distinct visitor_id) from page_views_public),
    'views', (select count(*) from page_views_public where created_at >= v_from),
    'visitors', (select count(distinct visitor_id) from page_views_public where created_at >= v_from),
    'today_views', (select count(*) from page_views_public where created_at >= v_today),
    'today_visitors', (select count(distinct visitor_id) from page_views_public where created_at >= v_today),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'views', v, 'visitors', u) order by d)
        from (select (created_at at time zone 'Asia/Bangkok')::date d, count(*) v, count(distinct visitor_id) u
                from page_views_public where created_at >= v_from group by 1) x), '[]'),
    'top_pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'views', v, 'visitors', u) order by v desc)
        from (select path, count(*) v, count(distinct visitor_id) u
                from page_views_public where created_at >= v_from group by path order by count(*) desc limit 20) x), '[]'),
    'by_hour', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'visitors', u) order by h)
        from (select extract(hour from created_at at time zone 'Asia/Bangkok')::int h, count(distinct visitor_id) u
                from page_views_public where created_at >= v_from group by 1) x), '[]'),
    'breakdown', jsonb_build_object(
      'region',  analytics_breakdown('region', v_from),
      'city',    analytics_breakdown('city', v_from),
      'country', analytics_breakdown('country', v_from),
      'device',  analytics_breakdown('device', v_from),
      'os',      analytics_breakdown('os', v_from),
      'browser', analytics_breakdown('browser', v_from),
      'source',  analytics_breakdown('source', v_from),
      'campaign', analytics_breakdown('utm_campaign', v_from),
      'language', analytics_breakdown('language', v_from)
    )
  );
end $$;

grant execute on function analytics_summary(int) to authenticated;
revoke execute on function analytics_summary(int) from anon, public;
