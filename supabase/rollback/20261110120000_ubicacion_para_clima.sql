-- Deshace supabase/migrations/20261110120000_ubicacion_para_clima.sql.
-- Se pierden las ubicaciones elegidas; el destino (texto) de cada viaje queda igual.

drop trigger if exists trg_limpiar_ubicacion_viaje on public.trips;
drop function if exists public.limpiar_ubicacion_viaje();
drop function if exists public.guardar_ubicacion_viaje(bigint, double precision, double precision, text);

alter table public.trips
  drop constraint if exists trips_ubicacion_valida,
  drop column if exists latitude,
  drop column if exists longitude,
  drop column if exists place_label;
