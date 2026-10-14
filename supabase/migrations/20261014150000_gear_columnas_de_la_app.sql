-- GearSection escribía name/category/status, pero la tabla tenía item/priority y no tenía status,
-- así que agregar o editar material fallaba. Se agregan name y status, y se usa priority
-- (nivel de importancia) en vez de category. item se deja (sin borrar datos), pero pasa a
-- ser opcional porque la app no lo envía.
-- Para volver atrás: supabase/rollback/20261014150000_gear_columnas_de_la_app.sql

alter table public.gear add column if not exists name text;
alter table public.gear add column if not exists status text not null default 'Pendiente';

update public.gear set name = item where name is null;
update public.gear set status = 'Asignado' where assigned_to is not null and status = 'Pendiente';

-- Valores antiguos (Crítica/Alta/Media) -> 3 niveles que muestra la app.
update public.gear set priority = case priority
  when 'Crítica' then 'Imprescindible'
  when 'Alta' then 'Importante'
  else 'Opcional'
end
where priority not in ('Imprescindible', 'Importante', 'Opcional');

alter table public.gear alter column priority set default 'Importante';
alter table public.gear alter column item drop not null;
