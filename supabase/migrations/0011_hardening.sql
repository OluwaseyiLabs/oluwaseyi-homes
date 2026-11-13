-- Security hardening found in the pre-launch audit. Run once in the Supabase SQL editor.

-- Trigger functions run by themselves when a row changes; nobody should be able to call them over the API.
revoke execute on function handle_new_user()   from public, anon, authenticated;
revoke execute on function lead_audit()        from public, anon, authenticated;
revoke execute on function lead_guard()        from public, anon, authenticated;
revoke execute on function listing_guard()     from public, anon, authenticated;
revoke execute on function protect_profiles()  from public, anon, authenticated;

-- The two permission helpers are only meaningful for a signed-in team member (the row-level rules use them).
revoke execute on function has_permission(text) from public, anon;
revoke execute on function current_actor()      from public, anon;
grant  execute on function has_permission(text) to authenticated;
grant  execute on function current_actor()      to authenticated;

-- The public photo bucket takes only photos, of a sensible size. (Uploads in the app are already compressed JPEGs.)
update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'listings';
