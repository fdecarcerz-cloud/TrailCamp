-- Borrar mi cuenta.
--
--   - borrar_mi_cuenta('BORRAR'): la persona borra su propia cuenta (la palabra se revisa aquí,
--     no solo en la app).
--   - resumen_borrar_mi_cuenta(): antes de confirmar, qué pasará con cada viaje que creó
--     (a quién pasa, o si se borra).
--   - Al borrar una cuenta (desde la app o desde el panel de Supabase), sus tarjetas en los
--     viajes quedan con el nombre, para que gastos y cuentas no cambien, pero sin cuenta,
--     correo ni celular, y con un link de invitación nuevo. Sus viajes pasan a otra persona
--     como en la etapa 6 (sucesor_del_viaje), o se borran si no hay nadie con cuenta.
--
-- Solo agrega: la versión anterior de la app sigue funcionando.
-- Para volver atrás: supabase/rollback/20261118120000_borrar_mi_cuenta.sql

-- A quién pasa un viaje si se va su creador: un organizador con cuenta, o si no la persona con
-- cuenta más antigua del equipo. "Con cuenta" = unida a su cuenta, o con el correo de una cuenta.
create or replace function public.sucesor_del_viaje(p_viaje bigint, p_saliente uuid)
returns table(participant_id bigint, user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(p.user_id, u.id)
  from public.participants p
  left join auth.users u on p.user_id is null and lower(u.email) = lower(p.email)
  where p.trip_id = p_viaje
    and coalesce(p.user_id, u.id) is not null
    and coalesce(p.user_id, u.id) <> p_saliente
  order by (p.role = 'Organizador') desc, p.created_at, p.id
  limit 1;
$$;

-- Al borrar una cuenta: primero sus viajes pasan a otra persona; después sus tarjetas quedan
-- sin datos de contacto (solo el nombre)
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
  v_ids bigint[];
begin
  for v_viaje in select id from public.trips where user_id = old.id loop
    select s.participant_id, s.user_id into v_part, v_nuevo
    from public.sucesor_del_viaje(v_viaje, old.id) s;

    if v_nuevo is not null then
      update public.trips set user_id = v_nuevo where id = v_viaje;
      update public.participants set role = 'Organizador' where id = v_part;
    end if;
    v_part := null;
    v_nuevo := null;
  end loop;

  select array_agg(id) into v_ids from public.participants
  where user_id = old.id or (old.email is not null and lower(email) = lower(old.email));
  if v_ids is not null then
    update public.participants
    set user_id = null,
        email = null,
        phone = null,
        role = case when role = 'Organizador' then 'Participante' else role end
    where id = any(v_ids);

    update public.participant_invites set token = gen_random_uuid(), created_at = now()
    where participant_id = any(v_ids);
  end if;

  return old;
end;
$$;

-- Qué pasará con los viajes que creé si borro mi cuenta (pasa_a null = se borra)
create or replace function public.resumen_borrar_mi_cuenta()
returns table(trip_id bigint, viaje text, pasa_a text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, (
    select p.name from public.participants p
    where p.id = (select s.participant_id from public.sucesor_del_viaje(t.id, (select auth.uid())) s)
  )
  from public.trips t
  where t.user_id = (select auth.uid())
  order by t.created_at, t.id;
$$;

-- Borra la cuenta de quien la llama. El trigger de arriba se encarga de viajes y tarjetas.
create or replace function public.borrar_mi_cuenta(p_confirmacion text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Inicia sesión para borrar tu cuenta.';
  end if;
  if upper(btrim(coalesce(p_confirmacion, ''))) <> 'BORRAR' then
    raise exception 'Para confirmar, escribe BORRAR.';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.sucesor_del_viaje(bigint, uuid) from public, anon, authenticated;
revoke execute on function public.reasignar_viajes_al_borrar_cuenta() from public, anon, authenticated;
revoke execute on function public.resumen_borrar_mi_cuenta() from public, anon;
grant execute on function public.resumen_borrar_mi_cuenta() to authenticated;
revoke execute on function public.borrar_mi_cuenta(text) from public, anon;
grant execute on function public.borrar_mi_cuenta(text) to authenticated;
