-- Deshace supabase/migrations/20261119120000_asistencia.sql.
-- Antes: volver a la versión anterior de la app (sin Voy / Tal vez / No voy).
-- La asistencia que la gente ya marcó queda guardada en participants.status (no se borra).
-- Los asientos y el material que se liberaron al marcar "No voy" no vuelven.

drop trigger if exists asistencia_no_voy on public.participants;
drop function if exists public.asistencia_no_voy();
drop trigger if exists material_sin_no_voy on public.gear;
drop function if exists public.material_sin_no_voy();
drop function if exists public.cambiar_asistencia(bigint, text);

alter table public.participants drop constraint if exists participants_status_valido;
alter table public.participants alter column status set default 'Pendiente';

-- Autos como en 20261113130000_autos_solo_por_funciones.sql
create or replace function public.crear_auto(
  p_viaje bigint,
  p_conductor text,
  p_auto text,
  p_salida text,
  p_hora text,
  p_asientos int
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform public.bloquear_autos_viaje(p_viaje);

  if coalesce(p_conductor, '') = '' then
    raise exception 'Elige quién maneja.';
  end if;
  if not public.es_del_equipo(p_viaje, p_conductor) then
    raise exception '% no está en el equipo de este viaje.', p_conductor;
  end if;
  if exists (select 1 from public.carpools where trip_id = p_viaje and driver_name = p_conductor) then
    raise exception '% ya maneja otro auto en este viaje.', p_conductor;
  end if;
  if p_asientos is null or p_asientos not between 1 and 9 then
    raise exception 'Los asientos para pasajeros van de 1 a 9.';
  end if;

  update public.carpools set passengers = array_remove(passengers, p_conductor)
  where trip_id = p_viaje and p_conductor = any(passengers);

  insert into public.carpools (trip_id, driver_name, car, departure_location, departure_time, seats_available, passengers)
  values (
    p_viaje,
    p_conductor,
    left(nullif(btrim(coalesce(p_auto, '')), ''), 100),
    left(btrim(coalesce(p_salida, '')), 200),
    left(btrim(coalesce(p_hora, '')), 20),
    p_asientos,
    '{}'
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.editar_auto(
  p_auto bigint,
  p_conductor text,
  p_etiqueta text,
  p_salida text,
  p_hora text,
  p_asientos int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viaje bigint;
  v_auto public.carpools%rowtype;
  v_pasajeros text[];
begin
  select trip_id into v_viaje from public.carpools where id = p_auto;
  if not found then
    raise exception 'Este auto ya no existe (alguien lo borró).';
  end if;
  perform public.bloquear_autos_viaje(v_viaje);
  select * into v_auto from public.carpools where id = p_auto;
  if not found then
    raise exception 'Este auto ya no existe (alguien lo borró).';
  end if;

  if coalesce(p_conductor, '') = '' then
    raise exception 'Elige quién maneja.';
  end if;
  if p_conductor is distinct from v_auto.driver_name and not public.es_del_equipo(v_viaje, p_conductor) then
    raise exception '% no está en el equipo de este viaje.', p_conductor;
  end if;
  if exists (select 1 from public.carpools where trip_id = v_viaje and id <> p_auto and driver_name = p_conductor) then
    raise exception '% ya maneja otro auto en este viaje.', p_conductor;
  end if;
  if p_asientos is null or p_asientos not between 1 and 9 then
    raise exception 'Los asientos para pasajeros van de 1 a 9.';
  end if;

  v_pasajeros := array_remove(coalesce(v_auto.passengers, '{}'), p_conductor);
  if cardinality(v_pasajeros) > p_asientos then
    raise exception 'Este auto lleva % pasajeros. Baja a alguien antes de dejar % asientos.', cardinality(v_pasajeros), p_asientos;
  end if;

  update public.carpools set passengers = array_remove(passengers, p_conductor)
  where trip_id = v_viaje and id <> p_auto and p_conductor = any(passengers);

  update public.carpools
  set driver_name = p_conductor,
      car = left(nullif(btrim(coalesce(p_etiqueta, '')), ''), 100),
      departure_location = left(btrim(coalesce(p_salida, '')), 200),
      departure_time = left(btrim(coalesce(p_hora, '')), 20),
      seats_available = p_asientos,
      passengers = v_pasajeros
  where id = p_auto;
end;
$$;

create or replace function public.subir_al_auto(p_auto bigint, p_nombre text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viaje bigint;
  v_auto public.carpools%rowtype;
begin
  select trip_id into v_viaje from public.carpools where id = p_auto;
  if not found then
    raise exception 'Este auto ya no existe (alguien lo borró).';
  end if;
  perform public.bloquear_autos_viaje(v_viaje);
  select * into v_auto from public.carpools where id = p_auto;
  if not found then
    raise exception 'Este auto ya no existe (alguien lo borró).';
  end if;

  if not public.es_del_equipo(v_viaje, p_nombre) then
    raise exception '% no está en el equipo de este viaje.', p_nombre;
  end if;
  if v_auto.driver_name = p_nombre then
    raise exception '% maneja este auto.', p_nombre;
  end if;
  if exists (select 1 from public.carpools where trip_id = v_viaje and driver_name = p_nombre) then
    raise exception '% maneja otro auto, no puede ir de pasajero.', p_nombre;
  end if;
  if p_nombre = any(coalesce(v_auto.passengers, '{}')) then
    return;
  end if;
  if cardinality(coalesce(v_auto.passengers, '{}')) >= v_auto.seats_available then
    raise exception 'Este auto se llenó recién: ya no quedan asientos libres.';
  end if;

  update public.carpools set passengers = array_remove(passengers, p_nombre)
  where trip_id = v_viaje and id <> p_auto and p_nombre = any(passengers);

  update public.carpools set passengers = coalesce(passengers, '{}') || p_nombre
  where id = p_auto;
end;
$$;

drop function if exists public.no_va(bigint, text);

-- La invitación vuelve a no decir el tipo
drop function public.ver_invitacion(uuid);

create function public.ver_invitacion(p_token uuid)
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

revoke execute on function public.ver_invitacion(uuid) from public;
grant execute on function public.ver_invitacion(uuid) to anon, authenticated;
