-- Deshace supabase/migrations/20261014190000_equipo_editar_y_borrar_seguro.sql.
-- Los nombres ya cambiados con renombrar_participante no vuelven al nombre anterior.

drop function if exists public.borrar_participante(bigint);
drop function if exists public.renombrar_participante(bigint, text, text, text);

drop index if exists public.participants_nombre_unico_por_viaje;

drop policy if exists "Ver equipo del viaje" on public.participants;
drop policy if exists "Agregar al equipo" on public.participants;
drop policy if exists "Editar equipo (creador)" on public.participants;
drop policy if exists "Borrar del equipo (creador)" on public.participants;

create policy "Acceso por viaje" on public.participants
  for all to authenticated
  using (public.puede_ver_viaje(trip_id))
  with check (public.puede_ver_viaje(trip_id));

drop function if exists public.es_creador_viaje(bigint);
