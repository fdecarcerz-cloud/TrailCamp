-- Ubicación del destino para el pronóstico del clima. Se elige en el buscador de lugares
-- (Photon / OpenStreetMap) al crear o editar el viaje, o desde el recuadro de clima.
-- place_label es el lugar elegido tal como se muestra ("Camping Pucón, Araucanía").
-- Cualquiera del viaje puede guardarla con guardar_ubicacion_viaje (como las notas), aunque
-- solo el creador puede modificar trips. Si el destino cambia sin elegir un lugar nuevo, el
-- trigger borra la ubicación vieja para que se vuelva a buscar.
-- Para volver atrás: supabase/rollback/20261110120000_ubicacion_para_clima.sql

alter table public.trips
  add column latitude double precision,
  add column longitude double precision,
  add column place_label text;

alter table public.trips
  add constraint trips_ubicacion_valida check (
    (latitude is null) = (longitude is null)
    and (latitude is null or (latitude between -90 and 90 and longitude between -180 and 180))
  );

CREATE OR REPLACE FUNCTION public.guardar_ubicacion_viaje(p_viaje bigint, p_lat double precision, p_lon double precision, p_lugar text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.puede_ver_viaje(p_viaje) then
    raise exception 'No tienes acceso a este viaje.';
  end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'La ubicación no es válida.';
  end if;

  update public.trips
  set latitude = p_lat,
      longitude = p_lon,
      place_label = left(nullif(btrim(coalesce(p_lugar, '')), ''), 200)
  where id = p_viaje;
end;
$function$
;

revoke execute on function public.guardar_ubicacion_viaje(bigint, double precision, double precision, text) from public, anon;
grant execute on function public.guardar_ubicacion_viaje(bigint, double precision, double precision, text) to authenticated;

CREATE OR REPLACE FUNCTION public.limpiar_ubicacion_viaje()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.destination is distinct from old.destination
     and new.latitude is not distinct from old.latitude
     and new.longitude is not distinct from old.longitude then
    new.latitude := null;
    new.longitude := null;
    new.place_label := null;
  end if;
  return new;
end;
$function$
;

CREATE TRIGGER trg_limpiar_ubicacion_viaje BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION limpiar_ubicacion_viaje();
