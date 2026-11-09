-- 075: a coin a few seconds old is read in full (3 Nov 2026). yr_cc gets each new coin within 30-60 s (yr_cc_roll), so
-- until then the read knew neither its name (no namesakes, no "is it THE coin?") nor its creator. yr_obirth has both
-- the instant it launches: yr_creator now takes the creator from there, and returns the launch's ticker, name and time.
do $$
declare d text := pg_get_functiondef('yr_creator(text,text)'::regprocedure);
begin
  d := replace(d, $x$d := coalesce(me.dev, nullif(p_dev, ''));$x$,
    $x$d := coalesce(me.dev, nullif(p_dev, ''), (select b.dev from yr_obirth b where b.mint = p_mint));$x$);
  d := replace(d, $x$'uri', (select b.uri from yr_obirth b where b.mint = p_mint),$x$,
    $x$'uri', (select b.uri from yr_obirth b where b.mint = p_mint),
      'birth', (select jsonb_build_object('sym', left(b.symbol, 16), 'name', left(b.name, 40), 't', b.t) from yr_obirth b where b.mint = p_mint),$x$);
  if position('''birth''' in d) = 0 or position('select b.dev from yr_obirth' in d) = 0 then raise exception 'yr_creator: lines not found'; end if;
  execute d;
end $$;
