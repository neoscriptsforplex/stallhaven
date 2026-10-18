-- Store of Geilenor online saves: one row per (user, slot 1-3).
-- Row-level security: a signed-in player can read and write only their own rows.

create table if not exists public.saves (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  slot         smallint    not null check (slot between 1 and 3),
  data         jsonb       not null,
  name         text        not null default '' check (char_length(name) <= 64),
  level        integer     not null default 1,
  playtime     double precision not null default 0,
  updated_at   timestamptz not null default now(),
  device_id    text        not null default '' check (char_length(device_id) <= 64),
  device_label text        not null default '' check (char_length(device_label) <= 64),
  revision     integer     not null default 1,
  primary key (user_id, slot),
  -- Keep a single save under ~2 MB so one player cannot fill the free tier.
  constraint saves_data_size check (pg_column_size(data) < 2000000)
);

alter table public.saves enable row level security;

drop policy if exists "saves: read own" on public.saves;
create policy "saves: read own" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "saves: insert own" on public.saves;
create policy "saves: insert own" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "saves: update own" on public.saves;
create policy "saves: update own" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "saves: delete own" on public.saves;
create policy "saves: delete own" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.saves from anon;
grant select, insert, update, delete on public.saves to authenticated;

-- Compare-and-swap save. Writes only when the caller's base revision matches the
-- stored one (or the slot is new and base is 0). Otherwise returns the cloud row
-- so the client can show the conflict prompt. SECURITY INVOKER, so RLS applies.
create or replace function public.save_slot(
  p_slot smallint,
  p_data jsonb,
  p_name text,
  p_level integer,
  p_playtime double precision,
  p_device_id text,
  p_device_label text,
  p_base_revision integer
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.saves;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into cur from public.saves where user_id = uid and slot = p_slot for update;
  if not found then
    if coalesce(p_base_revision, 0) <> 0 then
      return jsonb_build_object('ok', false, 'conflict', true, 'row', null);
    end if;
    insert into public.saves (user_id, slot, data, name, level, playtime, device_id, device_label, revision)
      values (uid, p_slot, p_data, left(coalesce(p_name, ''), 64), coalesce(p_level, 1), coalesce(p_playtime, 0),
              left(coalesce(p_device_id, ''), 64), left(coalesce(p_device_label, ''), 64), 1)
      returning * into cur;
    return jsonb_build_object('ok', true, 'conflict', false, 'row', to_jsonb(cur) - 'user_id');
  end if;
  if cur.revision <> coalesce(p_base_revision, 0) then
    return jsonb_build_object('ok', false, 'conflict', true, 'row', to_jsonb(cur) - 'user_id');
  end if;
  update public.saves set
      data = p_data,
      name = left(coalesce(p_name, ''), 64),
      level = coalesce(p_level, 1),
      playtime = coalesce(p_playtime, 0),
      device_id = left(coalesce(p_device_id, ''), 64),
      device_label = left(coalesce(p_device_label, ''), 64),
      updated_at = now(),
      revision = cur.revision + 1
    where user_id = uid and slot = p_slot
    returning * into cur;
  return jsonb_build_object('ok', true, 'conflict', false, 'row', to_jsonb(cur) - 'user_id');
end;
$$;

revoke all on function public.save_slot(smallint, jsonb, text, integer, double precision, text, text, integer) from public, anon;
grant execute on function public.save_slot(smallint, jsonb, text, integer, double precision, text, text, integer) to authenticated;
