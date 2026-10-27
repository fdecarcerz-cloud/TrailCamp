-- Foto opcional en cada gasto (la boleta). Las fotos van en el bucket privado "boletas",
-- en una carpeta por viaje: <trip_id>/<uuid>.jpg. Solo la gente del viaje puede verlas,
-- subirlas o borrarlas (mismo criterio que los gastos: puede_ver_viaje).
-- expenses.receipt_path guarda la ruta dentro del bucket.
-- Supabase no deja borrar archivos con SQL (trigger protect_objects_delete): la app los
-- borra con la API de Storage al eliminar el gasto, cambiar la foto o borrar el viaje.
-- Para volver atrás: supabase/rollback/20261027120000_fotos_de_boletas.sql

alter table public.expenses add column receipt_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boletas', 'boletas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- La primera carpeta de la ruta es el id del viaje; si no es un número, no hay acceso
create or replace function public.puede_ver_boleta(ruta text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when (storage.foldername(ruta))[1] ~ '^[0-9]+$'
      then public.puede_ver_viaje(((storage.foldername(ruta))[1])::bigint)
    else false
  end;
$$;

revoke execute on function public.puede_ver_boleta(text) from public, anon;
grant execute on function public.puede_ver_boleta(text) to authenticated;

create policy "Boletas: ver" on storage.objects for select to authenticated
  using (bucket_id = 'boletas' and public.puede_ver_boleta(name));

create policy "Boletas: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'boletas' and public.puede_ver_boleta(name));

create policy "Boletas: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'boletas' and public.puede_ver_boleta(name));
