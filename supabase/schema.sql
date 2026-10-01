-- =====================================================================
-- YEPPO — schema del database
-- Incolla tutto questo file nel SQL Editor di Supabase e premi "Run".
-- Si può eseguire più volte: le istruzioni usano "if not exists".
-- =====================================================================

create extension if not exists "pgcrypto";

-- Un progetto = un prodotto dell'utente + un settore di aziende target.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_description text not null,
  target_customer text not null,
  target_sector text not null,
  symptom text,
  -- nome dell'indice pubblico, es. "Indice della consulenza online"
  index_name text,
  public_slug text unique not null,
  public_top_n int not null default 10 check (public_top_n between 1 and 100),
  public_ranking_enabled boolean not null default false,
  report_cta_text text not null default 'Prenota 15 minuti per capire come migliorare',
  report_cta_url text,
  sender_name text,
  created_at timestamptz not null default now()
);

-- Criteri di valutazione (6-10 per progetto). Punteggio alto = sintomo assente.
create table if not exists criteria (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text not null,
  how_to_check text not null,
  weight int not null default 1 check (weight between 1 and 5),
  position int not null default 0
);
create index if not exists criteria_project_idx on criteria(project_id, position);

-- Aziende da analizzare.
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  website_url text not null,
  status text not null default 'da_contattare'
    check (status in ('da_contattare','contattata','report_aperto','ha_risposto','chiamata','cliente','non_interessata')),
  notes text,
  created_at timestamptz not null default now(),
  unique (project_id, website_url)
);
create index if not exists companies_project_idx on companies(project_id);

-- Analisi di un sito. Per ogni azienda vale solo l'ultima analisi "completata".
create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  status text not null default 'in_attesa'
    check (status in ('in_attesa','in_corso','completata','errore')),
  error_message text,
  pages_analyzed jsonb,        -- [{url, title}]
  scores jsonb,                -- [{criterion_id, score, evidence}]
  weak_points jsonb,           -- [{title, explanation, evidence}]
  summary text,
  total_score numeric,         -- 0-100 ponderato
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists analyses_company_idx on analyses(company_id, created_at desc);

-- Report privato (link segreto) per ogni azienda.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references companies(id) on delete cascade,
  slug text unique not null,
  view_count int not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Storico eventi (visite al report, cambi di stato, analisi completate...).
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  type text not null,          -- report_view, status_change, analysis_done, ecc.
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_company_idx on events(company_id, created_at desc);

-- Registra una visita al report in modo atomico (niente conteggi persi
-- se due persone aprono il report nello stesso momento).
create or replace function register_report_view(p_slug text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
begin
  update reports
     set view_count = view_count + 1,
         first_viewed_at = coalesce(first_viewed_at, now()),
         last_viewed_at = now()
   where slug = p_slug
  returning company_id into v_company;

  if v_company is null then
    return;
  end if;

  insert into events (company_id, type) values (v_company, 'report_view');

  -- Se l'azienda era stata contattata, ora sappiamo che ha aperto il report.
  update companies set status = 'report_aperto'
   where id = v_company and status = 'contattata';
  if found then
    insert into events (company_id, type, data)
    values (v_company, 'status_change', '{"from":"contattata","to":"report_aperto","auto":true}'::jsonb);
  end if;
end;
$$;

-- La funzione la può chiamare solo il server (service role), non il pubblico.
revoke all on function register_report_view(text) from public, anon, authenticated;
grant execute on function register_report_view(text) to service_role;

-- Row Level Security attiva ovunque, SENZA policy pubbliche:
-- il browser non può leggere né scrivere nulla; solo il server con la service role key.
-- ---------------------------------------------------------------------
-- v2: account utenti, crediti, pagamenti, ricerca aziende e contatti
-- ---------------------------------------------------------------------
create table if not exists accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  free_sessions int not null default 1 check (free_sessions >= 0),
  credits int not null default 0 check (credits >= 0),
  unlimited boolean not null default false,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  stripe_session_id text unique not null,
  plan text not null,
  credits int not null,
  amount_cents int not null,
  currency text not null default 'eur',
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists purchases_user_idx on purchases(user_id, created_at desc);

alter table projects
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists target_size text not null default 'tutte'
    check (target_size in ('piccole','medie','grandi','tutte')),
  add column if not exists target_country text not null default 'Italia',
  add column if not exists company_limit int not null default 0,
  add column if not exists credit_used_at timestamptz,
  add column if not exists discovery_notes text;
create index if not exists projects_user_idx on projects(user_id, created_at desc);

alter table companies
  add column if not exists source text not null default 'manuale' check (source in ('ricerca','manuale')),
  add column if not exists size_estimate text,
  add column if not exists discovery_reason text,
  add column if not exists contact_channels jsonb,
  add column if not exists contact_plan jsonb;

-- Usa una sessione: prima quelle gratuite (fino a 10 aziende), poi i crediti (fino a 30).
create or replace function use_session_credit(p_user uuid, p_project uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare v_limit int := 0; v_acc accounts%rowtype;
begin
  select * into v_acc from accounts where user_id = p_user for update;
  if not found then return 0; end if;
  if exists (select 1 from projects where id = p_project and user_id = p_user and credit_used_at is not null) then
    return (select company_limit from projects where id = p_project);
  end if;
  if v_acc.unlimited then v_limit := 30;
  elsif v_acc.free_sessions > 0 then
    update accounts set free_sessions = free_sessions - 1 where user_id = p_user; v_limit := 10;
  elsif v_acc.credits > 0 then
    update accounts set credits = credits - 1 where user_id = p_user; v_limit := 30;
  else return 0;
  end if;
  update projects set credit_used_at = now(), company_limit = v_limit where id = p_project and user_id = p_user;
  return v_limit;
end; $$;

-- Segna un acquisto come pagato e aggiunge i crediti (una sola volta).
create or replace function complete_purchase(p_stripe_session text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare v_user uuid; v_credits int;
begin
  update purchases set status = 'paid', paid_at = now()
   where stripe_session_id = p_stripe_session and status <> 'paid'
  returning user_id, credits into v_user, v_credits;
  if v_user is null then return false; end if;
  update accounts set credits = credits + v_credits where user_id = v_user;
  return true;
end; $$;

revoke all on function use_session_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function complete_purchase(text) from public, anon, authenticated;
grant execute on function use_session_credit(uuid, uuid) to service_role;
grant execute on function complete_purchase(text) to service_role;

alter table accounts enable row level security;
alter table purchases enable row level security;
alter table projects enable row level security;
alter table criteria enable row level security;
alter table companies enable row level security;
alter table analyses enable row level security;
alter table reports enable row level security;
alter table events enable row level security;
alter table projects alter column user_id set not null;
