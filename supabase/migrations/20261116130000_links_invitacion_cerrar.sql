-- Links de invitación protegidos (parte B): se aplica cuando la app nueva ya está publicada.
--
-- Borra participants.invite_token, la copia del link que cualquiera del viaje podía leer.
-- Los links siguen en participant_invites (se copiaron en la parte A), así que los que ya se
-- mandaron siguen funcionando.
-- Para volver atrás: supabase/rollback/20261116130000_links_invitacion_cerrar.sql

-- Igual que en la parte A, sin invite_token
create or replace function public.participante_nuevo_seguro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

revoke execute on function public.participante_nuevo_seguro() from public, anon, authenticated;

-- Por si acaso: toda tarjeta tiene su link guardado antes de borrar la columna
insert into public.participant_invites (participant_id, token)
select id, invite_token from public.participants
on conflict (participant_id) do nothing;

alter table public.participants drop column if exists invite_token;
