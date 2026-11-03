-- Hard paywall: new accounts start without a trial and must choose a plan
-- before they can use the dashboard or sell. Trials already granted by 0027
-- run to their end; creator_plan_tier still honours them.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'name'), ''))
  on conflict (id) do nothing;
  return new;
end $$;
