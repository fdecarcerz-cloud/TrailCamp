-- Deshace supabase/migrations/20261014120000_proteger_tablas_por_viaje.sql
-- y deja las políticas exactamente como estaban el 2026-10-14 (abiertas).

drop policy if exists "Acceso por viaje" on public.participants;
drop policy if exists "Acceso por viaje" on public.gear;
drop policy if exists "Acceso por viaje" on public.carpools;
drop policy if exists "Acceso por viaje" on public.expenses;

create policy "Permitir todo en participants" on public.participants for all to public using (true) with check (true);
create policy "Permitir todo en gear" on public.gear for all to public using (true) with check (true);
create policy "Permitir todo en carpools" on public.carpools for all to public using (true) with check (true);
create policy "Permitir todo en expenses" on public.expenses for all to public using (true) with check (true);

drop function if exists public.puede_ver_viaje(bigint);

alter function public.sync_trip_title_name() reset search_path;
alter function public.sync_trip_legacy_dates() reset search_path;
