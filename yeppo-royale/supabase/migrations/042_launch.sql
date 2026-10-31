-- Ready for the public launch:
--  1. Pro: yr_access says whether a license key unlocks the live call. The switch is yr_config 'paywall': while it
--     is not 'true', everyone gets everything.
--  2. Health: yr_health, read by yeppo.it/api/health, which an uptime monitor checks every few minutes.
--  3. Housekeeping, every night: paper wallets idle for 30 days go, and the cron log keeps two days.
--  4. Exchanges: the money trail's list of exchange wallets lives in yr_exch and grows by itself (yr-fund adds every
--     funder busy with thousands of transfers a day). Adding one re-marks the creators it paid.
--  5. A lighter money trail read: the rug check no longer scans every coin.

-- 1. Pro -------------------------------------------------------------------------------------------------------
insert into yr_config (key, value) values ('paywall', 'false'), ('paper_keep', '[]') on conflict (key) do nothing;

create or replace function yr_access(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  with w as (select coalesce((select value from yr_config where key = 'paywall'), 'false') = 'true' on_)
  select jsonb_build_object(
    'paywall', w.on_,
    'pro', not w.on_ or exists (select 1 from yr_licenses l where l.key = upper(trim(coalesce(p_key, ''))) and l.until > now()))
  from w
$$;
grant execute on function yr_access(text) to anon, authenticated;

-- 2. Health ----------------------------------------------------------------------------------------------------
create or replace function yr_health() returns jsonb
language plpgsql stable security definer set search_path = public, cron, net as $$
declare tick_age int; cron_bad int; http_all int; http_bad int;
begin
  select ((yr_now() - max(t)) / 1000)::int into tick_age from yr_ticks;
  select count(*) into cron_bad from cron.job_run_details where start_time > now() - interval '10 minutes' and status = 'failed';
  select count(*), count(*) filter (where timed_out or coalesce(status_code, 0) >= 500 or status_code is null)
    into http_all, http_bad from net._http_response where created > now() - interval '10 minutes';
  return jsonb_build_object(
    'ok', coalesce(tick_age, 99999) < 300 and cron_bad < 10 and (http_all = 0 or http_bad * 2 < http_all),
    'tick_age_s', tick_age,
    'cron_failed_10m', cron_bad,
    'http_failed_10m', http_bad,
    'http_10m', http_all);
end $$;
grant execute on function yr_health() to anon, authenticated;

-- 3. Housekeeping ----------------------------------------------------------------------------------------------
create or replace function yr_paper_gc() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from yr_paper_acct a
  where a.created_at < now() - interval '30 days'
    and not exists (select 1 from yr_paper_fill f where f.acct = a.id and f.at > yr_now() - 30 * 86400000::bigint)
    and a.id::text not in (select e.v from yr_config c, jsonb_each_text(c.value::jsonb) e(k, v) where c.key = 'paper_bots')
    and a.id::text not in (select jsonb_array_elements_text(value::jsonb) from yr_config where key = 'paper_keep');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function yr_paper_gc() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'yr-gc';
select cron.schedule('yr-gc', '17 3 * * *', $job$
  select yr_paper_gc();
  delete from cron.job_run_details where end_time < now() - interval '2 days';
$job$);

-- 4. Exchanges -------------------------------------------------------------------------------------------------
create table if not exists yr_exch (
  addr text primary key,
  name text,
  auto boolean not null default false,
  t bigint not null default yr_now()
);
alter table yr_exch enable row level security;

insert into yr_exch (addr, name) values
  ('5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', 'Binance'),
  ('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'Binance'),
  ('2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S', 'Binance'),
  ('3yFwqXBfZY4jBVUafQ1YEXw189y2dN3V5KQq9uzBDy1E', 'Binance'),
  ('H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS', 'Coinbase'),
  ('GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE', 'Coinbase'),
  ('2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm', 'Coinbase'),
  ('5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD', 'OKX'),
  ('AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2', 'Bybit'),
  ('FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5', 'Kraken'),
  ('ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ', 'MEXC'),
  ('u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w', 'Gate.io'),
  ('BmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6', 'KuCoin'),
  ('AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS', 'Crypto.com'),
  ('88xTWZMeKfiTgbfEmPLdsUCQcZinwUfk25EBQZ21XMAZ', 'HTX'),
  ('A77HErqtfN1hLLpvZ9pCtu66FEtM8BveoaKbbMoZ4RiR', 'Bitget')
on conflict (addr) do nothing;

-- a wallet that turns out to be an exchange stops linking the creators it paid
create or replace function yr_exch_mark() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update yr_fund set kind = 'exchange' where funder = new.addr and kind = 'wallet';
  return new;
end $$;
drop trigger if exists yr_exch_mark on yr_exch;
create trigger yr_exch_mark after insert on yr_exch for each row execute function yr_exch_mark();
update yr_fund f set kind = 'exchange' from yr_exch e where f.funder = e.addr and f.kind = 'wallet';

-- 5. A lighter money trail ---------------------------------------------------------------------------------------
create index if not exists yr_cc_rugger on yr_cc (dev) where rug_s is not null;
