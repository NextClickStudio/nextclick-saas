-- Remove the previous Yeppo app from this Supabase project (requested by the owner).
-- Auth users are kept. Storage files must be removed from the dashboard (SQL deletes are blocked).
do $$
declare r record;
begin
  for r in select jobname from cron.job where jobname like 'yeppo-%' loop
    perform cron.unschedule(r.jobname);
  end loop;
end $$;

drop trigger if exists on_auth_user_created on auth.users;

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind in ('f','p') loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typtype in ('e','c') and not exists (select 1 from pg_class c where c.reltype = t.oid) loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;

drop schema if exists private cascade;
