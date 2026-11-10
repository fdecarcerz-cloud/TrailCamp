-- Tipo de viaje: 'viaje' (completo: equipo, material, autos, gastos y clima) o 'gastos'
-- (solo equipo y gastos, estilo Tricount: una cena, un depto compartido...). En un grupo de
-- gastos el destino y las fechas son opcionales; la app no lo cuenta como viaje en Inicio ni
-- en las estadísticas. Los viajes existentes quedan como 'viaje'.
-- Para volver atrás: supabase/rollback/20261111120000_grupos_de_gastos.sql

alter table public.trips add column kind text not null default 'viaje';

alter table public.trips
  add constraint trips_kind_valido check (kind in ('viaje', 'gastos'));
