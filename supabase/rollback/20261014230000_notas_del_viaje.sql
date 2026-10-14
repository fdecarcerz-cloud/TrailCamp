-- Deshace supabase/migrations/20261014230000_notas_del_viaje.sql. Las notas ya guardadas se mantienen.

drop function if exists public.guardar_notas_viaje(bigint, text);
