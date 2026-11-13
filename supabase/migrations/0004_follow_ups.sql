-- One-time links for owners and customers, automatic follow-ups, and flagging of possible unreported deals.
-- The functions are called only by n8n and the website server with the secret key. Run once in the Supabase SQL editor.

alter table leads
  add column last_follow_up_at timestamptz,
  add column follow_up_count int not null default 0;

-- Creates a one-time link token for a customer or owner. Only its hash is stored; the token itself is returned once, to go in an email.
create function make_party_token(p_lead uuid, p_party text, p_purpose text, p_days int) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into party_tokens (token_hash, lead_id, party, purpose, expires_at)
  values (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_lead, p_party, p_purpose, now() + make_interval(days => p_days));
  return v_token;
end $$;

-- Follow-up for one lead: a link each for the customer and the owner, asking whether the inspection
-- took place and whether the deal was completed. Returns the two emails to send, or nothing if the lead
-- has no released contact or is already closed.
create function create_follow_up(p_lead uuid) returns jsonb
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
                       'property', v_property, 'token', make_party_token(l.id, 'customer', 'follow-up', 14)),
    jsonb_build_object('leadCode', l.code, 'kind', l.kind, 'party', 'owner', 'name', o.name, 'email', o.email,
                       'property', v_property, 'token', make_party_token(l.id, 'owner', 'follow-up', 14)));
end $$;

-- Flags leads where a deal may have been done without being reported: contact was released, three or more
-- follow-ups went unanswered by both sides, and the property has been taken off the website or 60 days have passed.
create function flag_suspects() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  with hit as (
    update leads l set suspect_reason =
      'Contact was released ' || (current_date - l.released_at::date) || ' days ago, ' || l.follow_up_count
      || ' follow-ups went unanswered by both sides, and '
      || case when li.published then 'more than 60 days have passed.' else 'the property is no longer on the website.' end
    from listings li
    where li.id = l.listing_id
      and l.suspect_reason is null and l.released_at is not null
      and l.status not in ('Successfully Rented', 'Successfully Sold', 'Unsuccessful', 'Disputed')
      and l.follow_up_count >= 3
      and l.customer_inspected is null and l.owner_inspected is null and l.customer_completed is null and l.owner_completed is null
      and (not li.published or l.released_at < now() - interval '60 days')
    returning 1)
  select count(*) into n from hit;
  return n;
end $$;

-- The daily run: flags suspects, then sends a follow-up for every open lead whose contact was released at least
-- p_min_days ago, at most once every 7 days and at most 4 times. Returns every email to send.
create function create_follow_ups(p_min_days int default 3) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_out jsonb := '[]'::jsonb;
begin
  perform flag_suspects();
  for r in
    select id from leads
     where released_at is not null and released_at <= now() - make_interval(days => p_min_days)
       and status not in ('Successfully Rented', 'Successfully Sold', 'Unsuccessful', 'Disputed')
       and follow_up_count < 4
       and (last_follow_up_at is null or last_follow_up_at <= now() - interval '7 days')
     order by released_at
  loop
    v_out := v_out || create_follow_up(r.id);
  end loop;
  return v_out;
end $$;

revoke execute on function make_party_token(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function create_follow_up(uuid) from public, anon, authenticated;
revoke execute on function flag_suspects() from public, anon, authenticated;
revoke execute on function create_follow_ups(int) from public, anon, authenticated;
