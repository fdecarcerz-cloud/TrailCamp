-- Deshace supabase/migrations/20261116120000_links_invitacion_protegidos.sql.
-- Antes: deshacer la parte B (rollback/20261116130000_links_invitacion_cerrar.sql), para que
-- participants.invite_token vuelva a existir, y volver a la versión anterior de la app.
-- OJO: se pierde quién agregó a cada persona, y cualquiera del viaje vuelve a ver todos los links.

-- Por si alguien se sumó entre medio: su link queda en participants
update public.participants p
set invite_token = i.token
from public.participant_invites i
where i.participant_id = p.id and p.invite_token is distinct from i.token;

-- Funciones como estaban
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
  from public.participants p
  join public.trips t on t.id = p.trip_id
  where p.invite_token = p_token;
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

  select * into v_part from public.participants where invite_token = p_token;
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

create or replace function public.participante_nuevo_seguro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.invite_token := gen_random_uuid();
  if new.user_id is distinct from (select auth.uid()) then
    new.user_id := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.participante_nuevo_seguro() from public, anon, authenticated;

drop trigger if exists crear_invitacion_participante on public.participants;
drop function if exists public.crear_invitacion_participante();
drop function if exists public.link_invitacion(bigint);
drop function if exists public.es_organizador_viaje(bigint);
drop table if exists public.participant_invites;

alter table public.participants drop constraint if exists participants_email_valido;
alter table public.participants drop column if exists added_by;
