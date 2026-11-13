-- Enquiry flow: prove the customer's email with a 6-digit code, then register the lead.
-- Both functions are called only by n8n with the secret key. Run once in the Supabase SQL editor.

-- Step 1. Holds the enquiry and returns a fresh code for n8n to email.
-- At most 5 codes per email address per hour. A new code cancels the previous one.
create function request_email_code(p_email text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_code  text;
begin
  delete from email_codes where created_at < now() - interval '1 day';
  if (select count(*) from email_codes where email = v_email and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'Too many codes have been sent to this email. Please wait an hour and try again.');
  end if;
  update email_codes set expires_at = now(), payload = '{}' where email = v_email and expires_at > now();
  -- Six digits taken from a random UUID.
  v_code := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into email_codes (email, code_hash, payload, expires_at)
  values (v_email, encode(sha256(convert_to(v_code || v_email, 'UTF8')), 'hex'), p_payload, now() + interval '10 minutes');
  return jsonb_build_object('ok', true, 'code', v_code, 'minutes', 10);
end $$;

-- Step 2. Checks the code. If it is right, registers the lead and returns it with its Lead ID.
-- A wrong code is counted, and the code stops working after 5 wrong tries.
create function register_lead(p_email text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email   text := lower(trim(p_email));
  c         email_codes;
  p         jsonb;
  l         leads;
  v_listing listings;
begin
  select * into c from email_codes where email = v_email and expires_at > now()
   order by created_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That code has expired. Send the form again to get a new one.');
  end if;
  if c.code_hash <> encode(sha256(convert_to(trim(p_code) || v_email, 'UTF8')), 'hex') then
    if c.attempts >= 4 then
      update email_codes set attempts = attempts + 1, expires_at = now(), payload = '{}' where id = c.id;
      return jsonb_build_object('ok', false, 'reason', 'Too many wrong codes. Send the form again to get a new one.');
    end if;
    update email_codes set attempts = attempts + 1 where id = c.id;
    return jsonb_build_object('ok', false, 'reason', 'That code is not correct. Check the email and try again.');
  end if;

  p := c.payload;
  select * into v_listing from listings where code = p ->> 'listingId' and published;
  perform set_config('app.actor', 'Website', true);
  insert into leads (kind, enquiry_type, customer_name, customer_email, customer_phone, email_verified_at, customer_ack_at,
                     listing_id, source, property_type, location, budget, move_in_date, facilities, assistance, note)
  values (
    case when p ->> 'enquiryType' = 'Rent' then 'Rent' else 'Buy' end,
    p ->> 'enquiryType', p ->> 'fullName', v_email, p ->> 'phone', now(),
    coalesce((p ->> 'acknowledgedAt')::timestamptz, now()),
    v_listing.id, coalesce(nullif(p ->> 'source', ''), 'Direct'),
    coalesce(p ->> 'propertyType', ''), coalesce(p ->> 'location', ''), coalesce(p ->> 'budget', ''),
    nullif(p ->> 'moveInDate', '')::date,
    array(select jsonb_array_elements_text(coalesce(p -> 'facilities', '[]'::jsonb))),
    coalesce((p ->> 'assistance')::boolean, false), coalesce(p ->> 'note', '')
  ) returning * into l;
  -- The code is used up and the held copy of the enquiry is cleared.
  update email_codes set expires_at = now(), payload = '{}' where id = c.id;

  return jsonb_build_object('ok', true, 'lead', jsonb_build_object(
    'code', l.code, 'fullName', l.customer_name, 'email', l.customer_email, 'phone', l.customer_phone,
    'enquiryType', l.enquiry_type, 'propertyType', l.property_type, 'location', l.location, 'budget', l.budget,
    'moveInDate', l.move_in_date, 'facilities', to_jsonb(l.facilities), 'assistance', l.assistance,
    'note', l.note, 'source', l.source,
    'property', case when v_listing.id is null then null else v_listing.code || ': ' || v_listing.title || ', ' || v_listing.location end));
end $$;

revoke execute on function request_email_code(text, jsonb) from public, anon, authenticated;
revoke execute on function register_lead(text, text) from public, anon, authenticated;
