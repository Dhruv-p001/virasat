-- Development seed. Loaded by `supabase db reset` after migrations. Local only, never production.
--
-- Sign in locally with any of these emails (magic links land in the local Supabase inbox):
--   dhruv@example.test  owner of the Shah family
--   meena@example.test  member of the Shah family (linked to "Mom")
--   raj@example.test    owner of the Patel family (unrelated; proves vault isolation by hand)

-- GoTrue reads the token columns as strings ('' not null) and needs the timestamps set.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change, created_at, updated_at
)
select
  id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, now(),
  '{"provider": "email", "providers": ["email"]}', meta::jsonb, '', '', '', '', now(), now()
from (values
  ('10000000-0000-4000-8000-000000000001', 'dhruv@example.test', '{"display_name": "Dhruv"}'),
  ('10000000-0000-4000-8000-000000000002', 'meena@example.test', '{"display_name": "Meena", "preferred_language": "gu"}'),
  ('10000000-0000-4000-8000-000000000003', 'raj@example.test', '{"display_name": "Raj", "preferred_language": "hi"}')
) as seed (id, email, meta);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from auth.users
where email like '%@example.test';

insert into public.families (id, name, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'Shah family', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Patel family', '10000000-0000-4000-8000-000000000003');

insert into public.family_members (family_id, profile_id, role) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'member'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'owner');

insert into public.people (family_id, display_name, relation_label, profile_id, birth_year, notes, created_by)
values
  ('20000000-0000-4000-8000-000000000001', 'Kantaben Shah', 'Ba', null, 1941,
   'Learned to cook in Rajkot. Never measured anything.', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', 'Meena Shah', 'Mom', '10000000-0000-4000-8000-000000000002', 1968,
   null, '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', 'Sarla Mehta', 'Masi', null, 1972,
   'Lives in Leicester. Keeps the diary of Ba''s festival sweets.', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Ramesh Patel', 'Dada', null, 1938,
   null, '10000000-0000-4000-8000-000000000003');
