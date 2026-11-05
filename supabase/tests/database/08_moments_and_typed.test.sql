-- Phase 2.5: typed recipes (create_typed_recipe) and family moments (attempts, remove_moment,
-- moment photos in vault-images).
begin;
select plan(33);
select tests.seed_two_families();
select set_config('storage.allow_delete_query', 'true', true);

create table tests.c1 (name text primary key, id uuid);
grant select on tests.c1 to anon, authenticated, service_role;
grant insert on tests.c1 to service_role, authenticated;
create function tests.c1(p_name text) returns uuid language sql stable as $$
  select id from tests.c1 where name = p_name;
$$;
grant execute on function tests.c1(text) to anon, authenticated, service_role;

create function tests.typed(p_title text, p_ingredients jsonb default null) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'title', p_title,
    'servings', 4,
    'ingredients', coalesce(p_ingredients,
      '[{"original_text": "be vaati ghau no lot", "name": "wheat flour", "suggested_quantity": 240,
         "suggested_unit": "g", "confidence": 0.7, "note": null}]'::jsonb),
    'steps', '[{"text": "Knead a soft dough."}]'::jsonb,
    'tips', '[]'::jsonb,
    'story', null,
    'language', 'en',
    'uncertain_fields', '["/ingredients/0/name"]'::jsonb
  );
$$;
grant execute on function tests.typed(text, jsonb) to service_role;

-- Typed recipes ------------------------------------------------------------------------------
select tests.authenticate_as('mom');
select throws_ok(
  format($$select public.create_typed_recipe(%L, %L, '{}')$$, tests.uid('mom'), tests.family('shah')),
  '42501', null, 'Clients cannot call create_typed_recipe');

select tests.as_superuser();
set local role service_role;
select throws_ok(
  format($$select public.create_typed_recipe(%L, %L, tests.typed('Rotli'))$$, tests.uid('cousin'), tests.family('shah')),
  '42501', null, 'A viewer cannot add a typed recipe');
select throws_ok(
  format($$select public.create_typed_recipe(%L, %L, tests.typed('Rotli'))$$, tests.uid('raj'), tests.family('shah')),
  '42501', null, 'Nobody can add a recipe to another vault');
select throws_ok(
  format($$select public.create_typed_recipe(%L, %L, tests.typed('Rotli'), %L)$$, tests.uid('mom'), tests.family('shah'), tests.person('dada')),
  '42501', null, 'A typed recipe cannot credit a person from another vault');
select throws_ok(
  format($$select public.create_typed_recipe(%L, %L, tests.typed('Rotli', '[{"name": "flour"}]'))$$, tests.uid('mom'), tests.family('shah')),
  '23514', null, 'Typed ingredients must keep the cook''s own words too');

insert into tests.c1 select 'rotli', public.create_typed_recipe(tests.uid('mom'), tests.family('shah'), tests.typed('Rotli'), tests.person('ba'));
insert into tests.c1 select 'private', public.create_typed_recipe(tests.uid('dhruv'), tests.family('shah'), tests.typed('Secret kadhi'));
update public.recipes set visibility = 'private' where id = tests.c1('private');

select results_eq(
  format($$select kind::text, status::text, source_type::text, author_person_id
           from public.recipe_versions where recipe_id = %L$$, tests.c1('rotli')),
  format($$values ('original', 'confirmed', 'typed', %L::uuid)$$, tests.person('ba')),
  'A typed recipe is a confirmed original, credited to the chosen person');
select ok((select root_version_id = current_version_id and origin_person_id = tests.person('ba')
           from public.recipes where id = tests.c1('rotli')),
  'Its original is both root and current');
select is((select uncertain_fields from public.recipe_versions where recipe_id = tests.c1('rotli')), '[]'::jsonb,
  'Nothing is flagged as uncertain on a recipe the family typed themselves');

-- Moments: writing --------------------------------------------------------------------------
select tests.authenticate_as('mom');
with created as (
  insert into public.attempts (family_id, recipe_id, note, rating, author_profile_id)
  values (tests.family('shah'), tests.c1('rotli'), 'Less ghee, kids loved it', 5, tests.uid('dhruv'))
  returning id
)
insert into tests.c1 select 'moment', id from created;
select is((select author_profile_id from public.attempts where id = tests.c1('moment')), tests.uid('mom'),
  'A moment is always authored by whoever adds it, whatever the client sends');
select lives_ok(
  format($$insert into public.attempts (family_id, recipe_id) values (%L, %L)$$, tests.family('shah'), tests.c1('rotli')),
  'A member can add a bare "I cooked it"');
select throws_ok(
  format($$insert into public.attempts (family_id, recipe_id, cooked_on) values (%L, %L, current_date + 7)$$, tests.family('shah'), tests.c1('rotli')),
  '23514', null, 'A moment cannot be dated in the future');
select throws_ok(
  format($$insert into public.attempts (family_id, recipe_id, version_id) values (%L, %L, gen_random_uuid())$$, tests.family('shah'), tests.c1('rotli')),
  '23514', null, 'A moment cannot point at another recipe''s version');
select throws_ok(
  format($$insert into public.attempts (family_id, recipe_id) values (%L, %L)$$, tests.family('shah'), tests.c1('private')),
  '42501', null, 'Nobody can add a moment to a recipe they cannot read');

select tests.authenticate_as('cousin');
select throws_ok(
  format($$insert into public.attempts (family_id, recipe_id) values (%L, %L)$$, tests.family('shah'), tests.c1('rotli')),
  '42501', null, 'A viewer cannot add moments');

select tests.authenticate_as('raj');
select throws_ok(
  format($$insert into public.attempts (family_id, recipe_id) values (%L, %L)$$, tests.family('shah'), tests.c1('rotli')),
  '42501', null, 'Another family cannot add moments to your recipes');
select throws_ok(
  format($$insert into public.attempts (family_id, recipe_id) values (%L, %L)$$, tests.family('patel'), tests.c1('rotli')),
  '23514', null, 'A moment''s recipe must be in the same vault');

-- Moments: reading ------------------------------------------------------------------------
select is_empty('select 1 from public.attempts', 'Another family sees none of your moments');
select tests.authenticate_as('cousin');
select isnt_empty(format('select 1 from public.attempts where id = %L', tests.c1('moment')),
  'A viewer can see family moments');
select tests.as_superuser();
insert into public.attempts (family_id, recipe_id, author_profile_id) values (tests.family('shah'), tests.c1('private'), tests.uid('dhruv'));
select tests.authenticate_as('mom');
select is_empty(format('select 1 from public.attempts where recipe_id = %L', tests.c1('private')),
  'Moments on a private recipe stay private');

-- Moments: editing and removing -------------------------------------------------------------
select is(tests.affected(format($$update public.attempts set note = 'Even better with jaggery' where id = %L$$, tests.c1('moment'))),
  1, 'The author can edit their moment');
select throws_ok(format($$update public.attempts set recipe_id = %L where id = %L$$, tests.c1('private'), tests.c1('moment')),
  '42501', null, 'A moment cannot be moved to another recipe');
select throws_ok(format($$update public.attempts set deleted_at = now() where id = %L$$, tests.c1('moment')),
  '42501', null, 'Removal goes through remove_moment(), not a direct write');
select throws_ok(format($$delete from public.attempts where id = %L$$, tests.c1('moment')),
  '42501', null, 'Moments are never hard-deleted by clients');

select tests.authenticate_as('dhruv');
select is(tests.affected(format($$update public.attempts set note = 'Hacked' where id = %L$$, tests.c1('moment'))),
  0, 'Even the owner cannot edit someone else''s moment');

-- Moment photos (vault-images, {family}/moments/{attempt}/{file})
select tests.authenticate_as('mom');
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vault-images', %L)$$,
    tests.family('shah') || '/moments/' || tests.c1('moment') || '/photo.jpg'),
  'The author uploads a photo for their moment');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vault-images', %L)$$,
    tests.family('shah') || '/moments/' || gen_random_uuid() || '/photo.jpg'),
  '42501', null, 'Photos only go under a moment that exists');
select tests.authenticate_as('dhruv');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vault-images', %L)$$,
    tests.family('shah') || '/moments/' || tests.c1('moment') || '/other.jpg'),
  '42501', null, 'Nobody else can add photos to your moment');
select tests.authenticate_as('cousin');
select is(tests.affected(format($$delete from storage.objects where name = %L$$,
    tests.family('shah') || '/moments/' || tests.c1('moment') || '/photo.jpg')),
  0, 'Others cannot delete your moment photo');
select tests.authenticate_as('mom');
select is(tests.affected(format($$delete from storage.objects where name = %L$$,
    tests.family('shah') || '/moments/' || tests.c1('moment') || '/photo.jpg')),
  1, 'The author can remove their moment photo');

select tests.authenticate_as('cousin');
select throws_ok(format($$select public.remove_moment(%L)$$, tests.c1('moment')),
  '42501', null, 'A viewer cannot remove someone''s moment');
select tests.authenticate_as('aunt');
select lives_ok(format($$select public.remove_moment(%L)$$, tests.c1('moment')),
  'An admin can remove a moment');
select is_empty(format('select 1 from public.attempts where id = %L', tests.c1('moment')),
  'A removed moment disappears');

select tests.as_anon();
select throws_ok('select 1 from public.attempts', '42501', null, 'Anonymous visitors cannot query moments');

select * from finish();
rollback;
