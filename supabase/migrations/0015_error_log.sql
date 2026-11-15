-- An error log the team can read in the dashboard. The site writes to it (with the secret key) whenever something goes
-- wrong; people with the "errors" permission can read it. The Owner chooses which other roles get that permission on the Team page.
-- Run once in the Supabase SQL editor, after 0014.

create table error_log (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null,                 -- the ID shown to the visitor, e.g. ERR-Q7K5R9
  place       text not null,                 -- where in the site it happened
  message     text not null,
  detail      jsonb not null default '{}',   -- stack lines and context. Never passwords, keys or email addresses.
  staged      boolean not null default false,-- true for the Owner's "Send a test error" button
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index error_log_created on error_log (created_at desc);
create index error_log_ref on error_log (ref);

alter table error_log enable row level security;
create policy "error team reads the log" on error_log for select to authenticated using (has_permission('errors'));
-- No insert, update or delete policy: the site writes and marks errors fixed on the server, after checking the permission.

-- Entries are never edited or removed by hand, except by the server marking them fixed.
create function error_log_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'The error log cannot be deleted from.'; end if;
  if (new.ref, new.place, new.message, new.detail, new.created_at) is distinct from (old.ref, old.place, old.message, old.detail, old.created_at) then
    raise exception 'Only the fixed mark of an error can change.';
  end if;
  return new;
end $$;
create trigger error_log_no_edit before update or delete on error_log for each row execute function error_log_guard();
revoke execute on function error_log_guard() from public, anon, authenticated;

-- The Owner always holds every permission, stored as rows.
insert into role_permissions (role, permission) values ('Owner', 'errors');
