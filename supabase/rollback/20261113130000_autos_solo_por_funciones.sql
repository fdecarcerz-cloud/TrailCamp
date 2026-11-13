-- Deshace supabase/migrations/20261113130000_autos_solo_por_funciones.sql: vuelve a dejar que
-- cualquiera del equipo cree y modifique autos directamente (sin las validaciones).

drop policy if exists "Ver autos del viaje" on public.carpools;
drop policy if exists "Borrar autos del viaje" on public.carpools;

create policy "Acceso por viaje" on public.carpools
  for all to authenticated
  using (public.puede_ver_viaje(trip_id))
  with check (public.puede_ver_viaje(trip_id));
