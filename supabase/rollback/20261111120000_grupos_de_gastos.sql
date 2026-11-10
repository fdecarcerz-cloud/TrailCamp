-- Deshace supabase/migrations/20261111120000_grupos_de_gastos.sql.
-- Los grupos de gastos vuelven a verse como viajes (algunos sin destino ni fechas).

alter table public.trips
  drop constraint if exists trips_kind_valido,
  drop column if exists kind;
