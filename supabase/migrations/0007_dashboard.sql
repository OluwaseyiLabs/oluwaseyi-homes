-- Team protections, fee changes that start a new agreement version, and real traffic figures.
-- Run once in the Supabase SQL editor.

-- ───────────── Team: the Owner account is fixed, and nobody changes their own role ─────────────
create function protect_profiles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'Owner' and (new.role <> 'Owner' or new.active = false) then
    raise exception 'The Owner account cannot be changed or switched off.';
  end if;
  if new.role = 'Owner' and old.role <> 'Owner' then
    raise exception 'There is only one Owner account.';
  end if;
  if auth.uid() is not null and old.id = auth.uid() and new.role <> old.role then
    raise exception 'You cannot change your own role.';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on profiles for each row execute function protect_profiles();

-- ───────────── Fees: only the Owner changes them, and a change starts a new agreement version ─────────────
drop policy "editors write pricing" on pricing;
create policy "owner writes pricing" on pricing for update to authenticated
  using (has_permission('team')) with check (has_permission('team'));

-- Owners who already accepted keep the terms they accepted (each agreement stores its own copy).
-- From now on new agreements carry the new version, for example 2026-11-14, then 2026-11-14.2 for a second change that day.
create function pricing_new_version() returns trigger language plpgsql as $$
declare
  v_today text := to_char(now() at time zone 'Africa/Lagos', 'YYYY-MM-DD');
begin
  if (new.listing_fee, new.agency_fee_pct, new.sale_commission_pct, new.tenant_assist_fee, new.protection_months)
     is distinct from (old.listing_fee, old.agency_fee_pct, old.sale_commission_pct, old.tenant_assist_fee, old.protection_months) then
    if old.agreement_version = v_today or old.agreement_version like v_today || '.%' then
      new.agreement_version := v_today || '.' || (coalesce(nullif(split_part(old.agreement_version, '.', 2), ''), '1')::int + 1);
    else
      new.agreement_version := v_today;
    end if;
  else
    new.agreement_version := old.agreement_version;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger pricing_version before update on pricing for each row execute function pricing_new_version();

-- ───────────── Traffic ─────────────
-- A daily-changing hash lets us count visitors without cookies or IP addresses, and cannot follow anyone from one day to the next.
alter table page_views add column visitor text;
create index page_views_path_idx on page_views (path);

-- Visits are entries to the site (a click from inside the site is not a new visit). Pages counts every page view.
create function traffic_summary(p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_days   int := greatest(1, least(coalesce(p_days, 7), 366));
  v_today  date := (now() at time zone 'Africa/Lagos')::date;
  v_from   timestamptz := ((v_today - (v_days - 1))::timestamp at time zone 'Africa/Lagos');
  v_prev   timestamptz := v_from - make_interval(days => v_days);
  v_series jsonb;
  v_visits int;
  v_prevn  int;
  v_people int;
begin
  if not has_permission('view') then raise exception 'You are not allowed to see traffic.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('day', s.d::date, 'visits', coalesce(v.n, 0), 'visitors', coalesce(v.u, 0)) order by s.d), '[]')
    into v_series
    from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as s(d)
    left join (
      select (at at time zone 'Africa/Lagos')::date d, count(*) n, count(distinct visitor) u
        from page_views where event is null and source <> 'Internal' and at >= v_from group by 1) v on v.d = s.d::date;

  select count(*) filter (where at >= v_from), count(*) filter (where at < v_from), count(distinct visitor) filter (where at >= v_from)
    into v_visits, v_prevn, v_people
    from page_views where event is null and source <> 'Internal' and at >= v_prev;

  return jsonb_build_object(
    'days', v_series, 'visits', v_visits, 'previous', v_prevn, 'visitors', v_people,
    'sources', (select coalesce(jsonb_agg(jsonb_build_array(source, n)), '[]') from (
        select source, count(*) n from page_views where event is null and source <> 'Internal' and at >= v_from group by 1 order by 2 desc limit 8) x),
    'devices', (select coalesce(jsonb_agg(jsonb_build_array(device, n)), '[]') from (
        select device, count(*) n from page_views where event is null and source <> 'Internal' and at >= v_from group by 1 order by 2 desc) x),
    'clicks', (select coalesce(jsonb_agg(jsonb_build_array(event, n)), '[]') from (
        select event, count(*) n from page_views where event is not null and at >= v_from group by 1 order by 2 desc limit 10) x),
    'topProperties', (select coalesce(jsonb_agg(jsonb_build_array(path, n)), '[]') from (
        select path, count(*) n from page_views where event is null and path like '/properties/%' and at >= v_from group by 1 order by 2 desc limit 6) x),
    'topPages', (select coalesce(jsonb_agg(jsonb_build_array(path, n)), '[]') from (
        select path, count(*) n from page_views where event is null and path not like '/properties/%' and at >= v_from group by 1 order by 2 desc limit 6) x)
  );
end $$;
revoke execute on function traffic_summary(int) from public, anon;
grant execute on function traffic_summary(int) to authenticated;
