-- Links de invitación protegidos (parte A).
--
-- Hasta ahora el link de cada persona (participants.invite_token) lo podía leer cualquiera del
-- viaje, y con él quedarse con esa tarjeta. Desde aquí:
--   - los links viven en participant_invites, que nadie puede leer directamente;
--   - cada tarjeta guarda quién la agregó (participants.added_by, lo pone la base);
--   - link_invitacion(persona) entrega el link solo al creador del viaje, a los organizadores
--     y a quien agregó a esa persona;
--   - solo el creador puede nombrar organizadores al sumar a alguien (editar ya era solo suyo);
--   - el correo tiene que tener forma de correo.
-- /invitacion/<link> sigue funcionando igual: los links se copian tal cual.
--
-- No quita nada: la versión anterior de la app sigue funcionando (todavía lee invite_token).
-- La parte B (20261116130000_links_invitacion_cerrar.sql) borra invite_token de participants.
-- Para volver atrás: supabase/rollback/20261116120000_links_invitacion_protegidos.sql

alter table public.participants
  add column if not exists added_by uuid references auth.users(id) on delete set null;

-- Correo con forma de correo (los que hay ya la cumplen)
alter table public.participants drop constraint if exists participants_email_valido;
alter table public.participants add constraint participants_email_valido
  check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

-- Los links: sin políticas, así que solo las funciones de la base los leen
create table if not exists public.participant_invites (
  participant_id bigint primary key references public.participants(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamp with time zone not null default now()
);
alter table public.participant_invites enable row level security;
revoke all on table public.participant_invites from public, anon, authenticated;

-- Es organizador del viaje quien tiene una tarjeta con ese rol (por su cuenta o su correo)
create or replace function public.es_organizador_viaje(viaje_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participants p
    where p.trip_id = viaje_id
      and p.role = 'Organizador'
      and (p.user_id = (select auth.uid())
        or lower(p.email) = lower((select auth.jwt()) ->> 'email'))
  );
$$;

-- Al sumar a alguien: link nuevo, quién lo agregó, y organizadores solo los nombra el creador
create or replace function public.participante_nuevo_seguro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.invite_token := gen_random_uuid();
  new.added_by := (select auth.uid());
  if new.user_id is distinct from (select auth.uid()) then
    new.user_id := null;
  end if;
  if new.role = 'Organizador' and not public.es_creador_viaje(new.trip_id) then
    raise exception 'Solo el creador del viaje puede nombrar organizadores.';
  end if;
  return new;
end;
$$;

-- Guarda el link de la tarjeta nueva. Mientras exista participants.invite_token usa ese mismo
-- (para que la app anterior mande un link que funcione); después, uno nuevo.
create or replace function public.crear_invitacion_participante()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.participant_invites (participant_id, token)
  values (new.id, coalesce((to_jsonb(new) ->> 'invite_token')::uuid, gen_random_uuid()))
  on conflict (participant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_invitacion_participante on public.participants;
create trigger crear_invitacion_participante after insert on public.participants
  for each row execute function public.crear_invitacion_participante();

-- Los links que ya existen, tal cual
insert into public.participant_invites (participant_id, token)
select id, invite_token from public.participants
on conflict (participant_id) do nothing;

-- El link de una persona: solo para el creador, los organizadores y quien la agregó
create or replace function public.link_invitacion(p_participante bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_part public.participants%rowtype;
  v_token uuid;
begin
  select * into v_part from public.participants where id = p_participante;
  if not found or not public.puede_ver_viaje(v_part.trip_id) then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;
  if not (public.es_creador_viaje(v_part.trip_id)
          or public.es_organizador_viaje(v_part.trip_id)
          or v_part.added_by = (select auth.uid())) then
    raise exception 'Solo el creador del viaje, los organizadores o quien sumó a % pueden ver su link de invitación.', v_part.name;
  end if;

  select token into v_token from public.participant_invites where participant_id = p_participante;
  if not found then
    insert into public.participant_invites (participant_id) values (p_participante)
    returning token into v_token;
  end if;
  return v_token;
end;
$$;

-- Igual que antes, pero el link se busca en participant_invites
create or replace function public.ver_invitacion(p_token uuid)
returns table(trip_id bigint, viaje text, destino text, inicio text, fin text, nombre text, ocupada boolean, es_mia boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.destination, t.start_date, t.end_date, p.name,
    p.user_id is not null,
    p.user_id is not null and p.user_id = (select auth.uid())
  from public.participant_invites i
  join public.participants p on p.id = i.participant_id
  join public.trips t on t.id = p.trip_id
  where i.token = p_token;
$$;

create or replace function public.aceptar_invitacion(p_token uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := (select auth.jwt()) ->> 'email';
  v_part public.participants%rowtype;
  v_otro text;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para aceptar la invitación.';
  end if;

  select p.* into v_part
  from public.participant_invites i
  join public.participants p on p.id = i.participant_id
  where i.token = p_token;
  if not found then
    raise exception 'Este link de invitación no es válido. Pídele uno nuevo a quien te invitó.';
  end if;

  if v_part.user_id = v_uid then
    return v_part.trip_id;
  end if;
  if v_part.user_id is not null then
    raise exception 'Esta invitación ya la usó otra cuenta. Pídele a quien te invitó que lo revise.';
  end if;

  select name into v_otro from public.participants
  where trip_id = v_part.trip_id and id <> v_part.id
    and (user_id = v_uid or lower(email) = lower(v_email))
  limit 1;
  if found then
    raise exception 'Ya estás en este viaje como "%".', v_otro;
  end if;

  -- El correo pasa a ser el de la cuenta, para que la app lo muestre y lo reconozca
  update public.participants
  set user_id = v_uid,
      email = coalesce(v_email, email)
  where id = v_part.id;

  return v_part.trip_id;
end;
$$;

revoke execute on function public.es_organizador_viaje(bigint) from public, anon;
grant execute on function public.es_organizador_viaje(bigint) to authenticated;
revoke execute on function public.participante_nuevo_seguro() from public, anon, authenticated;
revoke execute on function public.crear_invitacion_participante() from public, anon, authenticated;
revoke execute on function public.link_invitacion(bigint) from public, anon;
grant execute on function public.link_invitacion(bigint) to authenticated;
revoke execute on function public.ver_invitacion(uuid) from public;
grant execute on function public.ver_invitacion(uuid) to anon, authenticated;
revoke execute on function public.aceptar_invitacion(uuid) from public, anon;
grant execute on function public.aceptar_invitacion(uuid) to authenticated;
