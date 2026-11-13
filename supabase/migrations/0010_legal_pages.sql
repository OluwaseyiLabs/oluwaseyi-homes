-- Editable legal pages (privacy policy, terms, refund policy, agreement text) with a permanent history of every saved version.
-- The starter text lives in the website code and is shown until a page is saved here. Run once in the Supabase SQL editor.

create table legal_pages (
  slug       text primary key check (slug in ('privacy', 'terms', 'refunds', 'agreement')),
  title      text not null check (length(title) between 2 and 120),
  body       text not null check (length(body) between 20 and 60000),
  version    int  not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

-- Every saved version, kept for good: a record of what the terms said on any given day.
create table legal_history (
  id       bigint generated always as identity primary key,
  slug     text not null,
  title    text not null,
  body     text not null,
  version  int  not null,
  saved_at timestamptz not null default now(),
  saved_by text not null
);
create index legal_history_slug_idx on legal_history (slug, version desc);

create function legal_pages_stamp() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.version := coalesce((select max(version) from legal_history where slug = new.slug), 0) + 1;
  new.updated_at := now();
  new.updated_by := current_actor();
  insert into legal_history (slug, title, body, version, saved_by) values (new.slug, new.title, new.body, new.version, new.updated_by);
  return new;
end $$;
create trigger legal_pages_stamp before insert or update on legal_pages for each row execute function legal_pages_stamp();

alter table legal_pages   enable row level security;
alter table legal_history enable row level security;
create policy "public reads legal pages" on legal_pages for select to anon, authenticated using (true);
create policy "editors write legal pages" on legal_pages for all to authenticated using (has_permission('content')) with check (has_permission('content'));
create policy "editors read legal history" on legal_history for select to authenticated using (has_permission('content'));
-- No policy lets anyone add to, change or delete the history: only the trigger writes it.
revoke execute on function legal_pages_stamp() from public, anon, authenticated;
