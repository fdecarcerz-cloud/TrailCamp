-- Autos sin pisarse (parte B): los autos ya no se pueden crear ni modificar directamente,
-- solo con las funciones de la parte A (crear_auto, editar_auto, subir_al_auto,
-- bajar_del_auto), que validan las reglas y no se pisan entre sí.
-- Verlos y borrarlos sigue igual: cualquiera del equipo.
-- Aplicar DESPUÉS de publicar la app que usa esas funciones: la versión anterior de la app
-- deja de poder crear o editar autos (muestra un error; al recargar, carga la nueva).
-- Para volver atrás: supabase/rollback/20261113130000_autos_solo_por_funciones.sql

drop policy if exists "Acceso por viaje" on public.carpools;

create policy "Ver autos del viaje" on public.carpools
  for select to authenticated
  using (public.puede_ver_viaje(trip_id));

create policy "Borrar autos del viaje" on public.carpools
  for delete to authenticated
  using (public.puede_ver_viaje(trip_id));
