-- Deshace supabase/migrations/20261116130000_links_invitacion_cerrar.sql:
-- vuelve a poner participants.invite_token con el mismo link de cada persona.

alter table public.participants
  add column if not exists invite_token uuid default gen_random_uuid() not null;

update public.participants p
set invite_token = i.token
from public.participant_invites i
where i.participant_id = p.id;

create unique index if not exists participants_invite_token_key on public.participants (invite_token);

-- participante_nuevo_seguro como en la parte A (el link nuevo se copia a participant_invites)
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

revoke execute on function public.participante_nuevo_seguro() from public, anon, authenticated;
