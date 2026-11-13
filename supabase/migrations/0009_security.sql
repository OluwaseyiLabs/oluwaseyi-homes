-- Rate limits (enquiry form, codes, tracking) and shorter-lived emailed response links.
-- Run once in the Supabase SQL editor.

create table rate_limits (
  bucket text not null,
  at     timestamptz not null default now()
);
create index rate_limits_bucket_idx on rate_limits (bucket, at);
alter table rate_limits enable row level security; -- no policies: server only

-- True when fewer than p_max hits for this bucket happened within p_seconds. Counts the hit when allowed.
create function hit_rate_limit(p_key text, p_max int, p_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  select count(*) into n from rate_limits where bucket = p_key and at > now() - make_interval(secs => p_seconds);
  if n >= p_max then return false; end if;
  insert into rate_limits (bucket) values (p_key);
  -- Old rows are tidied now and then.
  if random() < 0.02 then delete from rate_limits where at < now() - interval '1 day'; end if;
  return true;
end $$;
revoke execute on function hit_rate_limit(text, int, int) from public, anon, authenticated;

-- Follow-up links for owners and customers last 48 hours instead of 14 days (they stay one-time and hashed).
create or replace function create_follow_up(p_lead uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l leads;
  o owners;
  v_property text;
begin
  select * into l from leads where id = p_lead for update;
  if not found or l.released_at is null
     or l.status in ('Successfully Rented', 'Successfully Sold', 'Unsuccessful', 'Disputed') then
    return '[]'::jsonb;
  end if;
  select * into o from owners where id = l.owner_id;
  select title || ', ' || location into v_property from listings where id = l.listing_id;

  update leads set last_follow_up_at = now(), follow_up_count = follow_up_count + 1 where id = l.id;
  insert into audit (lead_id, actor, action, detail)
  values (l.id, coalesce(nullif(current_setting('app.actor', true), ''), 'System'), 'Follow-up sent to the customer and the owner',
          'Follow-up number ' || (l.follow_up_count + 1) || ': did the inspection take place, and was the ' || case when l.kind = 'Rent' then 'rental' else 'sale' end || ' completed?');

  return jsonb_build_array(
    jsonb_build_object('leadCode', l.code, 'kind', l.kind, 'party', 'customer', 'name', l.customer_name, 'email', l.customer_email,
                       'property', v_property, 'token', make_party_token(l.id, 'customer', 'follow-up', 2)),
    jsonb_build_object('leadCode', l.code, 'kind', l.kind, 'party', 'owner', 'name', o.name, 'email', o.email,
                       'property', v_property, 'token', make_party_token(l.id, 'owner', 'follow-up', 2)));
end $$;
revoke execute on function create_follow_up(uuid) from public, anon, authenticated;
