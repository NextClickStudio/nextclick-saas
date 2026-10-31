-- yeppo radar: how far the post on X behind a coin reached. yr-social now also stores the post's likes and
-- replies and whether its author is verified, read once per coin from the public endpoint X's own embeds use
-- (no key, no login). Counting every post that mentions a coin would need X's paid search API; this measures
-- the post the coin was launched from. Additive.

alter table yr_social add column if not exists likes int;
alter table yr_social add column if not exists replies int;
alter table yr_social add column if not exists verified boolean;
alter table yr_social add column if not exists posted_at bigint;

create or replace function yr_social_recent() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_array(s.mint, s.tweet_id, s.x_handle, s.x_author, s.tweet, s.website is not null,
           s.telegram is not null, s.launcher, s.boost, s.dex_paid, s.twitter, s.likes, s.replies, s.verified, s.posted_at) order by s.at desc), '[]'::jsonb)
  from yr_social s where s.at > yr_now() - 3 * 3600000
$$;
