-- Bloque 2, etapa 1: asistencia (Voy / Tal vez / No voy), guardada en participants.status.
--   Voy = 'Confirmado', Tal vez = 'Pendiente', No voy = 'Cancelado'.
-- Aplicar ANTES de publicar la app nueva. La app anterior sigue funcionando igual.
-- No cambia ningún dato: hoy todos están en 'Confirmado' (= Voy).

-- 1. Solo esos tres valores, y quien se suma parte en "Voy"
alter table public.participants alter column status set default 'Confirmado';

alter table public.participants add constraint participants_status_valido
  check (status in ('Confirmado', 'Pendiente', 'Cancelado'));

-- 2. ¿Esta persona marcó "No voy"? (lo usan las funciones de autos)
create or replace function public.no_va(p_viaje bigint, p_nombre text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participants
    where trip_id = p_viaje and name = p_nombre and status = 'Cancelado'
  );
$$;

revoke execute on function public.no_va(bigint, text) from public, anon, authenticated;

-- 3. Al pasar a "No voy" se libera su asiento y su material (sin responsable y sin empacar).
--    Si maneja un auto, se rechaza: primero hay que cambiar el conductor o borrar el auto.
--    Corre con cualquier cambio de asistencia, venga de la app o de cambiar_asistencia.
create or replace function public.asistencia_no_voy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Cancelado' and old.status is distinct from 'Cancelado' then
    -- El mismo bloqueo que usan las funciones de autos, para no pisarse
    perform 1 from public.trips where id = new.trip_id for no key update;

    if exists (select 1 from public.carpools where trip_id = new.trip_id and driver_name = old.name) then
      raise exception '% maneja un auto en este viaje. Cambia el conductor o borra ese auto antes de marcar "No voy".', old.name;
    end if;

    update public.carpools set passengers = array_remove(passengers, old.name)
    where trip_id = new.trip_id and old.name = any(passengers);

    update public.gear set assigned_to = null, status = 'Pendiente'
    where trip_id = new.trip_id and assigned_to = old.name;
  end if;
  return new;
end;
$$;

revoke execute on function public.asistencia_no_voy() from public, anon, authenticated;

create trigger asistencia_no_voy
  before update of status on public.participants
  for each row execute function public.asistencia_no_voy();

-- 4. A quien marcó "No voy" no se le asigna material
create or replace function public.material_sin_no_voy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and exists (
       select 1 from public.participants
       where trip_id = new.trip_id and name = new.assigned_to and status = 'Cancelado'
     ) then
    raise exception '% marcó "No voy": no se le puede asignar material.', new.assigned_to;
  end if;
  return new;
end;
$$;

revoke execute on function public.material_sin_no_voy() from public, anon, authenticated;

create trigger material_sin_no_voy
  before insert or update of assigned_to on public.gear
  for each row execute function public.material_sin_no_voy();

-- 5. Cambiar la asistencia: la propia, o la de cualquiera si eres el creador o un organizador
create or replace function public.cambiar_asistencia(p_participante bigint, p_estado text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_part public.participants%rowtype;
  v_propia boolean;
begin
  if p_estado is null or p_estado not in ('Confirmado', 'Pendiente', 'Cancelado') then
    raise exception 'La asistencia no es válida.';
  end if;

  select * into v_part from public.participants where id = p_participante;
  if not found or not public.puede_ver_viaje(v_part.trip_id) then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;

  v_propia := v_part.user_id = (select auth.uid())
    or lower(v_part.email) = lower((select auth.jwt()) ->> 'email');
  if not coalesce(v_propia, false)
     and not public.es_creador_viaje(v_part.trip_id)
     and not public.es_organizador_viaje(v_part.trip_id) then
    raise exception 'Solo %, el creador del viaje y los organizadores pueden cambiar su asistencia.', v_part.name;
  end if;

  update public.participants set status = p_estado where id = p_participante;
end;
$$;

revoke execute on function public.cambiar_asistencia(bigint, text) from public, anon;
grant execute on function public.cambiar_asistencia(bigint, text) to authenticated;

-- 6. Autos: quien marcó "No voy" no maneja ni se sube
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
  if public.no_va(p_viaje, p_conductor) then
    raise exception '% marcó "No voy": no puede manejar.', p_conductor;
  end if;
  if exists (select 1 from public.carpools where trip_id = p_viaje and driver_name = p_conductor) then
    raise exception '% ya maneja otro auto en este viaje.', p_conductor;
  end if;
  if p_asientos is null or p_asientos not between 1 and 9 then
    raise exception 'Los asientos para pasajeros van de 1 a 9.';
  end if;

  -- Quien pasa a manejar se baja de los autos donde iba de pasajero
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
  -- Se vuelve a leer ya con el bloqueo, por si cambió mientras tanto
  select * into v_auto from public.carpools where id = p_auto;
  if not found then
    raise exception 'Este auto ya no existe (alguien lo borró).';
  end if;

  if coalesce(p_conductor, '') = '' then
    raise exception 'Elige quién maneja.';
  end if;
  -- Un conductor antiguo escrito a mano (que no está en el equipo) se puede mantener
  if p_conductor is distinct from v_auto.driver_name and not public.es_del_equipo(v_viaje, p_conductor) then
    raise exception '% no está en el equipo de este viaje.', p_conductor;
  end if;
  if p_conductor is distinct from v_auto.driver_name and public.no_va(v_viaje, p_conductor) then
    raise exception '% marcó "No voy": no puede manejar.', p_conductor;
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
  if public.no_va(v_viaje, p_nombre) then
    raise exception '% marcó "No voy": no puede subirse a un auto.', p_nombre;
  end if;
  if v_auto.driver_name = p_nombre then
    raise exception '% maneja este auto.', p_nombre;
  end if;
  if exists (select 1 from public.carpools where trip_id = v_viaje and driver_name = p_nombre) then
    raise exception '% maneja otro auto, no puede ir de pasajero.', p_nombre;
  end if;
  if p_nombre = any(coalesce(v_auto.passengers, '{}')) then
    return; -- ya iba en este auto
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

-- 7. La invitación dice si es un viaje o un grupo de gastos (en un grupo no se pregunta asistencia).
--    Cambia lo que devuelve, así que se borra y se vuelve a crear (con los mismos permisos).
drop function public.ver_invitacion(uuid);

create function public.ver_invitacion(p_token uuid)
returns table(trip_id bigint, viaje text, destino text, inicio text, fin text, nombre text, ocupada boolean, es_mia boolean, tipo text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.destination, t.start_date, t.end_date, p.name,
    p.user_id is not null,
    p.user_id is not null and p.user_id = (select auth.uid()),
    t.kind
  from public.participant_invites i
  join public.participants p on p.id = i.participant_id
  join public.trips t on t.id = p.trip_id
  where i.token = p_token;
$$;

revoke execute on function public.ver_invitacion(uuid) from public;
grant execute on function public.ver_invitacion(uuid) to anon, authenticated;
