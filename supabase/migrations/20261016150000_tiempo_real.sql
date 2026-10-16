-- Cambios en tiempo real: la app se suscribe a estas tablas (Supabase Realtime) y recarga el
-- viaje abierto cuando alguien más agrega, edita o borra algo. Realtime respeta las políticas
-- RLS para INSERT/UPDATE (cada uno solo recibe filas de sus viajes). Los DELETE llegan solo
-- con el id, sin datos; la app los compara con lo que tiene cargado.
-- Para volver atrás: supabase/rollback/20261016150000_tiempo_real.sql

alter publication supabase_realtime
  add table public.trips, public.participants, public.gear, public.carpools, public.expenses;
