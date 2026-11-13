-- Autos sin pisarse (parte A): funciones que hacen cada cambio de un auto en un solo paso.
-- Antes cada celular reescribía la lista completa de pasajeros con lo que tenía cargado, y
-- las reglas solo se revisaban en el celular: dos personas a la vez podían borrarse entre sí
-- o sobrecupar un auto.
--
-- Cada función bloquea el viaje mientras trabaja (las demás operaciones de autos de ese
-- viaje esperan su turno, unos milisegundos) y valida en la base:
--   - la persona es del equipo del viaje;
--   - cada persona va en un solo auto (al subirse a uno se baja del otro en la misma operación);
--   - quien maneja no es pasajero, y maneja un solo auto;
--   - no se superan los asientos; los asientos van de 1 a 9 y no quedan bajo los pasajeros.
--
-- Además renombrar_participante y borrar_participante pasan a security definer: tocan los
-- autos, y en la parte B los autos ya no se podrán modificar directamente. Ambas ya revisan
-- que quien las llama sea el creador del viaje.
--
-- No quita nada: la versión anterior de la app sigue funcionando. La parte B
-- (20261113130000_autos_solo_por_funciones.sql) cierra la vía directa.
-- Para volver atrás: supabase/rollback/20261113120000_autos_sin_pisarse.sql

-- Bloquea el viaje para que las operaciones de autos de ese viaje vayan de a una.
-- "no key update" no choca con las inserciones de otras tablas que apuntan al viaje.
create or replace function public.bloquear_autos_viaje(p_viaje bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.puede_ver_viaje(p_viaje) then
    raise exception 'No tienes acceso a este viaje.';
  end if;
  perform 1 from public.trips where id = p_viaje for no key update;
  if not found then
    raise exception 'Este viaje ya no existe.';
  end if;
end;
$$;

create or replace function public.es_del_equipo(p_viaje bigint, p_nombre text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.participants where trip_id = p_viaje and name = p_nombre);
$$;

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

-- Sube a una persona (tú u otra) a un auto. Si iba en otro, se baja de ese en la misma operación.
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

create or replace function public.bajar_del_auto(p_auto bigint, p_nombre text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viaje bigint;
begin
  select trip_id into v_viaje from public.carpools where id = p_auto;
  if not found then
    raise exception 'Este auto ya no existe (alguien lo borró).';
  end if;
  perform public.bloquear_autos_viaje(v_viaje);
  update public.carpools set passengers = array_remove(passengers, p_nombre)
  where id = p_auto;
end;
$$;

alter function public.renombrar_participante(bigint, text, text, text, text) security definer;
alter function public.borrar_participante(bigint) security definer;

revoke execute on function public.bloquear_autos_viaje(bigint) from public, anon, authenticated;
revoke execute on function public.es_del_equipo(bigint, text) from public, anon, authenticated;
revoke execute on function public.crear_auto(bigint, text, text, text, text, int) from public, anon;
grant execute on function public.crear_auto(bigint, text, text, text, text, int) to authenticated;
revoke execute on function public.editar_auto(bigint, text, text, text, text, int) from public, anon;
grant execute on function public.editar_auto(bigint, text, text, text, text, int) to authenticated;
revoke execute on function public.subir_al_auto(bigint, text) from public, anon;
grant execute on function public.subir_al_auto(bigint, text) to authenticated;
revoke execute on function public.bajar_del_auto(bigint, text) from public, anon;
grant execute on function public.bajar_del_auto(bigint, text) to authenticated;
