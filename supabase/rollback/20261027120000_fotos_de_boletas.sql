-- Deshace supabase/migrations/20261027120000_fotos_de_boletas.sql.
-- Antes hay que vaciar el bucket "boletas" desde el dashboard (Storage → boletas →
-- seleccionar todo → Delete): Supabase no deja borrar los archivos con SQL, y un bucket con
-- archivos no se puede eliminar. Se pierden las fotos de las boletas.

drop policy if exists "Boletas: ver" on storage.objects;
drop policy if exists "Boletas: subir" on storage.objects;
drop policy if exists "Boletas: borrar" on storage.objects;

drop function if exists public.puede_ver_boleta(text);

delete from storage.buckets where id = 'boletas';

alter table public.expenses drop column if exists receipt_path;
