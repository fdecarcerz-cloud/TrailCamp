-- Deshace supabase/migrations/20261113150000_gastos_papelera_cerrar.sql:
-- vuelve a dejar que cualquiera del viaje edite y borre gastos y fotos de boletas.

drop policy if exists "Ver gastos del viaje" on public.expenses;
drop policy if exists "Registrar gastos" on public.expenses;
drop policy if exists "Editar gastos fuera de la papelera" on public.expenses;
drop policy if exists "Borrar para siempre (creador, desde la papelera)" on public.expenses;

create policy "Acceso por viaje" on public.expenses as PERMISSIVE for ALL to authenticated
  using (puede_ver_viaje(trip_id))
  with check (puede_ver_viaje(trip_id));

drop policy if exists "Boletas: borrar" on storage.objects;
create policy "Boletas: borrar" on storage.objects as PERMISSIVE for DELETE to authenticated
  using (((bucket_id = 'boletas'::text) AND puede_ver_boleta(name)));

drop function if exists public.puede_borrar_boleta(text);
