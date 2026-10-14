-- Notas del viaje (columna trips.description): cualquiera del viaje puede editarlas.
-- La política de UPDATE de trips solo deja al creador, así que se usa una función
-- security definer que toca únicamente description, para que nadie más pueda cambiar
-- el nombre, el destino o las fechas.
-- Para volver atrás: supabase/rollback/20261014230000_notas_del_viaje.sql

create or replace function public.guardar_notas_viaje(p_viaje bigint, p_notas text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.puede_ver_viaje(p_viaje) then
    raise exception 'No tienes acceso a este viaje.';
  end if;
  if length(coalesce(p_notas, '')) > 5000 then
    raise exception 'Las notas pueden tener como máximo 5.000 caracteres.';
  end if;

  update public.trips
  set description = nullif(btrim(coalesce(p_notas, '')), '')
  where id = p_viaje;
end;
$$;

revoke execute on function public.guardar_notas_viaje(bigint, text) from public, anon;
grant execute on function public.guardar_notas_viaje(bigint, text) to authenticated;
