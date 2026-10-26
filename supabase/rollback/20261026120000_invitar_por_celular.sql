-- Deshace supabase/migrations/20261026120000_invitar_por_celular.sql.
-- Se pierden los celulares guardados y las cuentas unidas por link: esas personas vuelven a
-- ver el viaje solo si su correo en el equipo coincide con el de su cuenta (aceptar la
-- invitación ya les dejó puesto ese correo).

drop function if exists public.aceptar_invitacion(uuid);
drop function if exists public.ver_invitacion(uuid);

drop function if exists public.renombrar_participante(bigint, text, text, text, text);

create or replace function public.renombrar_participante(p_id bigint, p_nombre text, p_email text, p_rol text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_viejo text;
  v_viaje bigint;
  v_nuevo text := btrim(coalesce(p_nombre, ''));
begin
  if v_nuevo = '' then
    raise exception 'El nombre no puede quedar vacío.';
  end if;

  select name, trip_id into v_viejo, v_viaje from public.participants where id = p_id;
  if not found then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;
  if not public.es_creador_viaje(v_viaje) then
    raise exception 'Solo el creador del viaje puede editar el equipo.';
  end if;

  update public.participants
  set name = v_nuevo,
      email = nullif(btrim(coalesce(p_email, '')), ''),
      role = p_rol
  where id = p_id;

  if v_viejo is distinct from v_nuevo then
    update public.gear set assigned_to = v_nuevo
    where trip_id = v_viaje and assigned_to = v_viejo;

    update public.carpools set driver_name = v_nuevo
    where trip_id = v_viaje and driver_name = v_viejo;

    update public.carpools set passengers = array_replace(passengers, v_viejo, v_nuevo)
    where trip_id = v_viaje and v_viejo = any(passengers);

    update public.expenses set paid_by = v_nuevo
    where trip_id = v_viaje and paid_by = v_viejo;

    update public.expenses set split_between = array_replace(split_between, v_viejo, v_nuevo)
    where trip_id = v_viaje and v_viejo = any(split_between);

    update public.expenses set description = 'Pago de ' || paid_by || ' a ' || split_between[1]
    where trip_id = v_viaje and is_settlement;
  end if;
end;
$$;

revoke execute on function public.renombrar_participante(bigint, text, text, text) from public, anon;
grant execute on function public.renombrar_participante(bigint, text, text, text) to authenticated;

drop policy "Ver mis viajes o donde participo" on public.trips;
create policy "Ver mis viajes o donde participo" on public.trips for select to public
  using ((auth.uid() = user_id) or (id in (select participants.trip_id from participants
    where (participants.email = (auth.jwt() ->> 'email'::text)))));

create or replace function public.puede_ver_viaje(viaje_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips t
    where t.id = viaje_id and t.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.participants p
    where p.trip_id = viaje_id
      and lower(p.email) = lower((select auth.jwt()) ->> 'email')
  );
$$;

drop trigger if exists participante_nuevo_seguro on public.participants;
drop function if exists public.participante_nuevo_seguro();

drop index if exists public.participants_viaje_cuenta_key;
drop index if exists public.participants_invite_token_key;
alter table public.participants
  drop constraint if exists participants_phone_largo,
  drop column if exists invite_token,
  drop column if exists user_id,
  drop column if exists phone;
