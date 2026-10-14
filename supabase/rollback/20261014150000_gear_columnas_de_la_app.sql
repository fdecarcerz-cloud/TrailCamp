-- Deshace supabase/migrations/20261014150000_gear_columnas_de_la_app.sql.
-- Copia a item los nombres de material creado desde la app, para no perderlos.

update public.gear set item = name where item is null;
alter table public.gear alter column item set not null;

update public.gear set priority = case priority
  when 'Imprescindible' then 'Crítica'
  when 'Importante' then 'Alta'
  else 'Media'
end;
alter table public.gear alter column priority set default 'Media';

alter table public.gear drop column if exists status;
alter table public.gear drop column if exists name;
