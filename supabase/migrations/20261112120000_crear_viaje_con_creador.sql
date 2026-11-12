-- Crear un viaje y sumar al creador al equipo en una sola operación: o se hacen las dos
-- cosas o ninguna. Antes la app hacía dos pasos separados y, si fallaba el segundo, el
-- viaje quedaba sin su creador en el equipo (la app no lo reconocía).
-- Es security invoker: corre con los permisos de quien la llama, así que valen las mismas
-- políticas RLS de siempre (crear viajes propios y agregar al equipo de un viaje que ves).
-- No cambia nada de lo existente: la versión anterior de la app sigue funcionando.
-- Para volver atrás: supabase/rollback/20261112120000_crear_viaje_con_creador.sql

create or replace function public.crear_viaje(
  p_tipo text,
  p_nombre text,
  p_destino text,
  p_inicio text,
  p_fin text,
  p_lat double precision,
  p_lon double precision,
  p_lugar text,
  p_mi_nombre text
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := (select auth.jwt()) ->> 'email';
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_destino text := nullif(btrim(coalesce(p_destino, '')), '');
  v_inicio text := nullif(btrim(coalesce(p_inicio, '')), '');
  v_fin text := nullif(btrim(coalesce(p_fin, '')), '');
  v_yo text := nullif(btrim(coalesce(p_mi_nombre, '')), '');
  v_viaje bigint;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para crear un viaje.';
  end if;
  if v_nombre = '' then
    raise exception 'Escribe un nombre.';
  end if;
  if coalesce(p_tipo, 'viaje') not in ('viaje', 'gastos') then
    raise exception 'Tipo de viaje no válido.';
  end if;

  -- Con una sola fecha, el viaje es de un día
  v_inicio := coalesce(v_inicio, v_fin);
  v_fin := coalesce(v_fin, v_inicio);
  if v_inicio is not null and v_inicio !~ '^\d{4}-\d{2}-\d{2}$' or v_fin is not null and v_fin !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Las fechas no son válidas.';
  end if;
  if v_fin < v_inicio then
    raise exception 'La fecha de término no puede ser antes de la fecha de inicio.';
  end if;
  if coalesce(p_tipo, 'viaje') = 'viaje' and (v_destino is null or v_inicio is null) then
    raise exception 'Un viaje necesita destino y fechas.';
  end if;

  insert into public.trips (kind, name, destination, start_date, end_date, latitude, longitude, place_label, user_id)
  values (
    coalesce(p_tipo, 'viaje'), v_nombre, v_destino, v_inicio, v_fin, p_lat, p_lon,
    case when p_lat is null then null else left(nullif(btrim(coalesce(p_lugar, '')), ''), 200) end,
    v_uid
  )
  returning id into v_viaje;

  -- El creador entra como Organizador con su nombre de "Mi cuenta" (o el comienzo del correo)
  insert into public.participants (trip_id, name, email, user_id, role, status)
  values (
    v_viaje,
    coalesce(v_yo, nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'Organizador'),
    v_email,
    v_uid,
    'Organizador',
    'Confirmado'
  );

  return v_viaje;
end;
$$;

revoke execute on function public.crear_viaje(text, text, text, text, text, double precision, double precision, text, text) from public, anon;
grant execute on function public.crear_viaje(text, text, text, text, text, double precision, double precision, text, text) to authenticated;
