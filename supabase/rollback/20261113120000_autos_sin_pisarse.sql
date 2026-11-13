-- Deshace supabase/migrations/20261113120000_autos_sin_pisarse.sql.
-- Antes deshacer la parte B (rollback/20261113130000_autos_solo_por_funciones.sql) y volver
-- a la versión de la app que escribe los autos directamente.

drop function if exists public.crear_auto(bigint, text, text, text, text, int);
drop function if exists public.editar_auto(bigint, text, text, text, text, int);
drop function if exists public.subir_al_auto(bigint, text);
drop function if exists public.bajar_del_auto(bigint, text);
drop function if exists public.es_del_equipo(bigint, text);
drop function if exists public.bloquear_autos_viaje(bigint);

-- Como estaban: con los permisos de quien las llama
alter function public.renombrar_participante(bigint, text, text, text, text) security invoker;
alter function public.borrar_participante(bigint) security invoker;
