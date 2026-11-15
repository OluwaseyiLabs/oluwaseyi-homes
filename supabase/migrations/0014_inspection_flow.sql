-- The inspection time is agreed BEFORE contact is released, so the release email can carry it.
-- Run once in the Supabase SQL editor, after 0013.

-- What the owner says when they acknowledge: up to three times that suit them, or "the customer's time suits me".
alter table leads
  add column if not exists owner_proposed_times timestamptz[] not null default '{}',
  add column if not exists owner_proposed_note text not null default '',
  add column if not exists owner_agreed_customer_time boolean,
  add column if not exists owner_proposed_at timestamptz;

-- Contact cannot be released until an inspection time is confirmed.
create or replace function release_blockers(l leads) returns text[] language sql stable as $$
  select array_remove(array[
    case when l.listing_id is null then 'No property is linked to this lead.' end,
    case when l.email_verified_at is null then 'The customer''s email is not verified.' end,
    case when l.customer_ack_at is null then 'The customer has not acknowledged that the introduction comes from the platform.' end,
    case when l.listing_id is not null and l.agreement_id is null then 'The owner has not accepted the Property Listing and Agency Agreement.' end,
    case when l.listing_id is not null and l.owner_ack_at is null then 'The owner has not acknowledged receiving this customer.' end,
    case when l.listing_id is not null and l.inspection_confirmed_for is null then 'No inspection time is confirmed yet. Agree one with the owner and the customer first.' end
  ], null);
$$;

-- The team confirms the time once the owner has acknowledged. Before release this only saves the time (it goes out in the
-- release email); after release it is a change of time and both sides are emailed by the app.
create or replace function confirm_inspection(p_lead uuid, p_when timestamptz, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l leads;
begin
  perform set_config('app.actor', p_actor, true);
  select * into l from leads where id = p_lead for update;
  if not found then raise exception 'That lead could not be found.'; end if;
  if l.listing_id is null then raise exception 'Link a property to this lead first.'; end if;
  if l.owner_ack_at is null then raise exception 'The owner must acknowledge this customer before an inspection time is confirmed.'; end if;
  if l.status in ('Successfully Rented', 'Successfully Sold', 'Unsuccessful', 'Disputed') then
    raise exception 'This lead is closed.';
  end if;
  if p_when is null or p_when < now() then raise exception 'Choose a date and time that has not passed.'; end if;

  update leads set inspection_confirmed_for = p_when, inspection_confirmed_by = p_actor,
                   status = case when l.released_at is not null and l.status = 'Contact Released' then 'Inspection Scheduled' else l.status end
   where id = p_lead returning * into l;

  return (
    select jsonb_build_object(
      'leadCode', l.code, 'customerName', l.customer_name, 'customerEmail', l.customer_email,
      'ownerName', o.name, 'ownerEmail', o.email, 'property', li.title || ', ' || li.location,
      'when', p_when, 'released', l.released_at is not null,
      'trackToken', make_party_token(l.id, 'customer', 'track', 90))
    from owners o, listings li where o.id = l.owner_id and li.id = l.listing_id
  );
end $$;

-- Release returns the confirmed time too, and moves the lead to Inspection Scheduled.
create or replace function release_contact(p_lead uuid, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l leads;
begin
  perform set_config('app.actor', p_actor, true);
  update leads set released_at = now() where id = p_lead and released_at is null returning * into l;
  if not found then
    raise exception 'This lead does not exist or its contact details were already released';
  end if;
  update leads set status = 'Inspection Scheduled' where id = p_lead and inspection_confirmed_for is not null returning * into l;
  select * into l from leads where id = p_lead;
  return (
    select jsonb_build_object(
      'leadCode', l.code, 'customerName', l.customer_name, 'customerEmail', l.customer_email,
      'ownerName', o.name, 'ownerWhatsapp', o.whatsapp, 'ownerEmail', o.email,
      'property', li.title || ', ' || li.location,
      'inspectionDate', l.inspection_date, 'inspectionSlot', l.inspection_slot,
      'inspectionConfirmedFor', l.inspection_confirmed_for,
      'trackToken', make_party_token(l.id, 'customer', 'track', 90))
    from owners o, listings li where o.id = l.owner_id and li.id = l.listing_id
  );
end $$;

revoke execute on function release_contact(uuid, text) from public, anon, authenticated;
revoke execute on function confirm_inspection(uuid, timestamptz, text) from public, anon, authenticated;
