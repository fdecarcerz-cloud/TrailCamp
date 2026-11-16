-- Deshace supabase/migrations/20261118120000_borrar_mi_cuenta.sql.
-- Antes: volver a la versión anterior de la app (sin "Borrar mi cuenta").
-- OJO: las cuentas que ya se borraron no vuelven.

drop function if exists public.borrar_mi_cuenta(text);
drop function if exists public.resumen_borrar_mi_cuenta();

-- Como en la etapa 6: solo reasigna los viajes, sin limpiar las tarjetas
create or replace function public.reasignar_viajes_al_borrar_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viaje bigint;
  v_part bigint;
  v_nuevo uuid;
begin
  for v_viaje in select id from public.trips where user_id = old.id loop
    select p.id, coalesce(p.user_id, u.id) into v_part, v_nuevo
    from public.participants p
    left join auth.users u on p.user_id is null and lower(u.email) = lower(p.email)
    where p.trip_id = v_viaje
      and coalesce(p.user_id, u.id) is not null
      and coalesce(p.user_id, u.id) <> old.id
    order by (p.role = 'Organizador') desc, p.created_at, p.id
    limit 1;

    if v_nuevo is not null then
      update public.trips set user_id = v_nuevo where id = v_viaje;
      update public.participants set role = 'Organizador' where id = v_part;
    end if;
    v_part := null;
    v_nuevo := null;
  end loop;
  return old;
end;
$$;

revoke execute on function public.reasignar_viajes_al_borrar_cuenta() from public, anon, authenticated;

drop function if exists public.sucesor_del_viaje(bigint, uuid);
