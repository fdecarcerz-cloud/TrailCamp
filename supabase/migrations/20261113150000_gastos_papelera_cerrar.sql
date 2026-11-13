-- Gastos con historial y papelera (parte B): se aplica cuando la app nueva ya está publicada.
--
-- Hasta ahora cualquiera del viaje podía borrar un gasto para siempre. Desde aquí:
--   - borrar para siempre: solo el creador del viaje, y solo lo que ya está en la papelera;
--   - editar: solo gastos que no están en la papelera;
--   - la foto de la boleta de un gasto (también en la papelera) solo la puede borrar el
--     creador. Una foto que ya ningún gasto usa (se cambió o se quitó) la puede borrar
--     cualquiera del viaje, como antes.
-- Ver y registrar gastos sigue igual: cualquiera del viaje.
-- Para volver atrás: supabase/rollback/20261113150000_gastos_papelera_cerrar.sql

drop policy if exists "Acceso por viaje" on public.expenses;

create policy "Ver gastos del viaje" on public.expenses as PERMISSIVE for SELECT to authenticated
  using (puede_ver_viaje(trip_id));

create policy "Registrar gastos" on public.expenses as PERMISSIVE for INSERT to authenticated
  with check (puede_ver_viaje(trip_id));

create policy "Editar gastos fuera de la papelera" on public.expenses as PERMISSIVE for UPDATE to authenticated
  using (puede_ver_viaje(trip_id) and deleted_at is null)
  with check (puede_ver_viaje(trip_id));

create policy "Borrar para siempre (creador, desde la papelera)" on public.expenses as PERMISSIVE for DELETE to authenticated
  using (es_creador_viaje(trip_id) and deleted_at is not null);

-- La carpeta (el viaje) se revisa primero: si no es un número, no se convierte
create or replace function public.puede_borrar_boleta(ruta text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when public.puede_ver_boleta(ruta) then
      public.es_creador_viaje(((storage.foldername(ruta))[1])::bigint)
      or not exists (select 1 from public.expenses where receipt_path = ruta)
    else false
  end;
$$;

revoke execute on function public.puede_borrar_boleta(text) from public, anon;
grant execute on function public.puede_borrar_boleta(text) to authenticated;

drop policy if exists "Boletas: borrar" on storage.objects;
create policy "Boletas: borrar" on storage.objects as PERMISSIVE for DELETE to authenticated
  using (((bucket_id = 'boletas'::text) AND public.puede_borrar_boleta(name)));
