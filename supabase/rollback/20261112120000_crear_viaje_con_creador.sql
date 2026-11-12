-- Deshace supabase/migrations/20261112120000_crear_viaje_con_creador.sql.
-- Ojo: la app que usa crear_viaje deja de poder crear viajes. Volver antes a la versión
-- anterior de la app (que crea el viaje y suma al creador en dos pasos).

drop function if exists public.crear_viaje(text, text, text, text, text, double precision, double precision, text, text);
