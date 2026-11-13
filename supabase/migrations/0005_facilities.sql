-- Facilities the admin can add to (24-hour power, CCTV, and so on). Run once in the Supabase SQL editor.
-- Properties keep the facility names they were saved with, so removing one from this list never changes a saved property.

create table facilities (
  name     text primary key check (length(name) between 1 and 40 and name !~ ','),  -- commas are used to join names in forms
  position int not null default 0
);
create unique index facilities_name_lower_idx on facilities (lower(name));

alter table facilities enable row level security;

-- Everyone sees the list: the enquiry and List Property forms offer it.
create policy "public reads facilities" on facilities for select to anon, authenticated using (true);
-- Anyone who can add and edit properties can add or remove a facility.
create policy "team adds facilities" on facilities for insert to authenticated with check (has_permission('drafts'));
create policy "team removes facilities" on facilities for delete to authenticated using (has_permission('drafts'));

insert into facilities (name, position) values
  ('24-hour power', 1), ('Prepaid meter', 2), ('Borehole water', 3), ('Fitted kitchen', 4),
  ('Wardrobes', 5), ('Air conditioning', 6), ('Generator', 7), ('Gated estate', 8),
  ('Parking space', 9), ('Security guard', 10), ('CCTV', 11), ('Boys'' quarters', 12);
