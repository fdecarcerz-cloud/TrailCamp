-- Deshace supabase/migrations/20261016150000_tiempo_real.sql.

alter publication supabase_realtime
  drop table public.trips, public.participants, public.gear, public.carpools, public.expenses;
