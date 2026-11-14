-- Remembers whether the owner has been emailed that their property is now on the website, so it is sent once.
-- Run once in the Supabase SQL editor.

alter table listings add column owner_notified_at timestamptz;

-- Properties that are already on the website count as announced, so nobody gets an email about an old listing.
update listings set owner_notified_at = now() where published;
