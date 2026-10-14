-- Cierra el acceso abierto a participants, gear, carpools y expenses.
-- Antes: política "Permitir todo" (cualquiera, incluso sin sesión, podía leer y modificar).
-- Ahora: solo el dueño del viaje o alguien cuyo email está en participants de ese viaje.
-- Para volver atrás: supabase/rollback/20261014120000_proteger_tablas_por_viaje.sql

-- security definer: consulta trips/participants sin pasar por sus políticas,
-- así la política de participants puede usarla sin recursión infinita.
create or replace function public.puede_ver_viaje(viaje_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips t
    where t.id = viaje_id and t.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.participants p
    where p.trip_id = viaje_id
      and lower(p.email) = lower((select auth.jwt()) ->> 'email')
  );
$$;

revoke execute on function public.puede_ver_viaje(bigint) from public, anon;
grant execute on function public.puede_ver_viaje(bigint) to authenticated;

drop policy if exists "Permitir todo en participants" on public.participants;
create policy "Acceso por viaje" on public.participants
  for all to authenticated
  using (public.puede_ver_viaje(trip_id))
  with check (public.puede_ver_viaje(trip_id));

drop policy if exists "Permitir todo en gear" on public.gear;
create policy "Acceso por viaje" on public.gear
  for all to authenticated
  using (public.puede_ver_viaje(trip_id))
  with check (public.puede_ver_viaje(trip_id));

drop policy if exists "Permitir todo en carpools" on public.carpools;
create policy "Acceso por viaje" on public.carpools
  for all to authenticated
  using (public.puede_ver_viaje(trip_id))
  with check (public.puede_ver_viaje(trip_id));

drop policy if exists "Permitir todo en expenses" on public.expenses;
create policy "Acceso por viaje" on public.expenses
  for all to authenticated
  using (public.puede_ver_viaje(trip_id))
  with check (public.puede_ver_viaje(trip_id));

-- Aviso del advisor de Supabase (search_path mutable). Estas funciones solo usan NEW,
-- así que fijar search_path vacío no cambia su comportamiento.
alter function public.sync_trip_title_name() set search_path = '';
alter function public.sync_trip_legacy_dates() set search_path = '';
