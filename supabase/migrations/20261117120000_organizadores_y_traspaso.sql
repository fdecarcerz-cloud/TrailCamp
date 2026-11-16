-- Organizadores, traspasar el viaje y salir del viaje.
--
-- Hasta ahora todo el viaje dependía de una sola cuenta (el creador). Desde aquí:
--   - los organizadores pueden editar el viaje y editar o sacar personas del equipo, pero no a
--     otros organizadores ni al creador; borrar y traspasar el viaje sigue siendo del creador;
--   - dar o quitar el rol de Organizador lo hace solo el creador;
--   - nadie puede sacar la tarjeta del creador del equipo;
--   - traspasar_viaje: el creador le pasa el viaje a alguien del equipo que ya entró con su cuenta;
--   - salir_del_viaje: cualquiera menos el creador deja el viaje; su nombre queda en el equipo
--     (para que gastos y cuentas no cambien) pero sin su cuenta ni su correo;
--   - si se borra la cuenta del creador, el viaje pasa a un organizador con cuenta, o si no a la
--     persona con cuenta más antigua del equipo; si no hay nadie con cuenta, se borra como antes.
--
-- Solo agrega permisos y reglas: la versión anterior de la app sigue funcionando.
-- Para volver atrás: supabase/rollback/20261117120000_organizadores_y_traspaso.sql

-- La tarjeta del creador: unida a su cuenta, o con su correo si todavía no se une
create or replace function public.es_tarjeta_del_creador(p_participante bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants p
    join public.trips t on t.id = p.trip_id
    left join auth.users u on u.id = t.user_id
    where p.id = p_participante
      and (p.user_id = t.user_id
        or (p.user_id is null and lower(p.email) = lower(u.email)))
  );
$$;

-- El creador solo cambia con traspasar_viaje (o al borrarse su cuenta), nunca desde la app
create or replace function public.proteger_creador_viaje()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id and current_user in ('authenticated', 'anon') then
    raise exception 'Para cambiar el creador del viaje usa "Traspasar viaje".';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_creador_viaje on public.trips;
create trigger proteger_creador_viaje before update on public.trips
  for each row execute function public.proteger_creador_viaje();

-- Editar el viaje: el creador o un organizador
drop policy if exists "Modificar mis viajes" on public.trips;
drop policy if exists "Modificar viaje (creador u organizador)" on public.trips;
create policy "Modificar viaje (creador u organizador)" on public.trips
  as permissive for update to authenticated
  using ((select auth.uid()) = user_id or public.es_organizador_viaje(id))
  with check ((select auth.uid()) = user_id or public.es_organizador_viaje(id));

-- Borrar directo del equipo: solo el creador, y nunca su propia tarjeta (la app usa borrar_participante)
drop policy if exists "Borrar del equipo (creador)" on public.participants;
create policy "Borrar del equipo (creador)" on public.participants
  as permissive for delete to authenticated
  using (public.es_creador_viaje(trip_id) and not public.es_tarjeta_del_creador(id));

-- Editar a alguien: el creador a todos; un organizador a quienes no son organizadores ni el
-- creador (y a sí mismo). El rol de Organizador lo da o lo quita solo el creador.
create or replace function public.renombrar_participante(p_id bigint, p_nombre text, p_email text, p_rol text, p_telefono text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_part public.participants%rowtype;
  v_viejo text;
  v_viaje bigint;
  v_nuevo text := btrim(coalesce(p_nombre, ''));
  v_propia boolean;
begin
  if v_nuevo = '' then
    raise exception 'El nombre no puede quedar vacío.';
  end if;
  if p_rol is null or p_rol not in ('Participante', 'Guía', 'Organizador') then
    raise exception 'El rol no es válido.';
  end if;

  select * into v_part from public.participants where id = p_id;
  if not found then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;
  v_viejo := v_part.name;
  v_viaje := v_part.trip_id;

  if not public.es_creador_viaje(v_viaje) then
    if not public.es_organizador_viaje(v_viaje) then
      raise exception 'Solo el creador del viaje y los organizadores pueden editar el equipo.';
    end if;
    v_propia := v_part.user_id = (select auth.uid())
      or lower(v_part.email) = lower((select auth.jwt()) ->> 'email');
    if not coalesce(v_propia, false)
       and (v_part.role = 'Organizador' or public.es_tarjeta_del_creador(p_id)) then
      raise exception 'Los organizadores no pueden editar al creador del viaje ni a otros organizadores.';
    end if;
    if (p_rol = 'Organizador') <> (v_part.role = 'Organizador') then
      raise exception 'Solo el creador del viaje puede dar o quitar el rol de Organizador.';
    end if;
  end if;

  update public.participants
  set name = v_nuevo,
      email = nullif(btrim(coalesce(p_email, '')), ''),
      phone = case when p_telefono is null then phone else nullif(btrim(p_telefono), '') end,
      role = p_rol
  where id = p_id;

  if v_viejo is distinct from v_nuevo then
    update public.gear set assigned_to = v_nuevo
    where trip_id = v_viaje and assigned_to = v_viejo;

    update public.carpools set driver_name = v_nuevo
    where trip_id = v_viaje and driver_name = v_viejo;

    update public.carpools set passengers = array_replace(passengers, v_viejo, v_nuevo)
    where trip_id = v_viaje and v_viejo = any(passengers);

    update public.expenses set paid_by = v_nuevo
    where trip_id = v_viaje and paid_by = v_viejo;

    update public.expenses set split_between = array_replace(split_between, v_viejo, v_nuevo)
    where trip_id = v_viaje and v_viejo = any(split_between);

    update public.expenses set description = 'Pago de ' || paid_by || ' a ' || split_between[1]
    where trip_id = v_viaje and is_settlement;
  end if;
end;
$$;

-- Sacar a alguien: el creador a todos menos a sí mismo; un organizador a quienes no son
-- organizadores ni el creador. Igual que antes, no deja sacar a quien aparece en gastos.
create or replace function public.borrar_participante(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_part public.participants%rowtype;
  v_nombre text;
  v_viaje bigint;
  v_gastos int;
  v_papelera int;
  v_texto text;
begin
  select * into v_part from public.participants where id = p_id;
  if not found then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;
  v_nombre := v_part.name;
  v_viaje := v_part.trip_id;

  if public.es_tarjeta_del_creador(p_id) then
    raise exception 'No se puede sacar del equipo al creador del viaje. Para dejarlo, primero tiene que traspasarlo a otra persona.';
  end if;
  if not public.es_creador_viaje(v_viaje) then
    if not public.es_organizador_viaje(v_viaje) then
      raise exception 'Solo el creador del viaje y los organizadores pueden sacar personas del equipo.';
    end if;
    if v_part.user_id = (select auth.uid()) or lower(v_part.email) = lower((select auth.jwt()) ->> 'email') then
      raise exception 'Para dejar el viaje usa "Salir del viaje", al final de Equipo.';
    end if;
    if v_part.role = 'Organizador' then
      raise exception 'Solo el creador del viaje puede sacar a un organizador.';
    end if;
  end if;

  select count(*) filter (where deleted_at is null), count(*) filter (where deleted_at is not null)
  into v_gastos, v_papelera
  from public.expenses
  where trip_id = v_viaje and (paid_by = v_nombre or v_nombre = any(split_between));

  if v_gastos > 0 then
    v_texto := format('%s aparece en %s. Edita o borra esos gastos primero, para que las cuentas no queden mal.',
      v_nombre,
      case when v_gastos = 1 then '1 gasto o pago' else v_gastos || ' gastos o pagos' end);
    if v_papelera > 0 then
      v_texto := v_texto || format(' También aparece en %s de la papelera.', v_papelera);
    end if;
    raise exception '%', v_texto;
  end if;
  if v_papelera > 0 then
    raise exception '% aparece en % de la papelera. Bórralos definitivamente desde la papelera de Gastos primero.',
      v_nombre,
      case when v_papelera = 1 then '1 gasto o pago' else v_papelera || ' gastos o pagos' end;
  end if;

  if exists (select 1 from public.carpools where trip_id = v_viaje and driver_name = v_nombre) then
    raise exception '% maneja un auto en este viaje. Cambia el conductor o borra ese auto primero.', v_nombre;
  end if;

  update public.gear
  set assigned_to = null,
      status = case when status = 'Asignado' then 'Pendiente' else status end
  where trip_id = v_viaje and assigned_to = v_nombre;

  update public.carpools set passengers = array_remove(passengers, v_nombre)
  where trip_id = v_viaje and v_nombre = any(passengers);

  delete from public.participants where id = p_id;
end;
$$;

-- El creador le pasa el viaje a alguien del equipo que ya entró con su cuenta.
-- Esa persona queda como Organizador y el creador anterior también.
create or replace function public.traspasar_viaje(p_viaje bigint, p_participante bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := (select auth.jwt()) ->> 'email';
  v_part public.participants%rowtype;
begin
  if not public.es_creador_viaje(p_viaje) then
    raise exception 'Solo el creador del viaje puede traspasarlo.';
  end if;

  select * into v_part from public.participants where id = p_participante and trip_id = p_viaje;
  if not found then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;
  if v_part.user_id = v_uid then
    raise exception 'Ya eres el creador de este viaje.';
  end if;
  if v_part.user_id is null then
    raise exception '% todavía no entra con su cuenta. Mándale su invitación y, cuando entre, podrás traspasarle el viaje.', v_part.name;
  end if;

  update public.trips set user_id = v_part.user_id where id = p_viaje;

  update public.participants set role = 'Organizador'
  where trip_id = p_viaje
    and (id = p_participante or user_id = v_uid or (user_id is null and lower(email) = lower(v_email)));
end;
$$;

-- Dejar el viaje. El creador primero tiene que traspasarlo (o borrarlo).
-- La tarjeta queda con su nombre para que gastos, material y autos no cambien, pero sin cuenta
-- ni correo (así deja de ver el viaje) y con un link de invitación nuevo (el anterior ya no sirve).
create or replace function public.salir_del_viaje(p_viaje bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := (select auth.jwt()) ->> 'email';
  v_ids bigint[];
begin
  if v_uid is null then
    raise exception 'Inicia sesión para salir del viaje.';
  end if;
  if public.es_creador_viaje(p_viaje) then
    raise exception 'Eres el creador de este viaje. Para salir, primero traspásalo a otra persona del equipo (o bórralo).';
  end if;

  select array_agg(id) into v_ids from public.participants
  where trip_id = p_viaje and (user_id = v_uid or lower(email) = lower(v_email));
  if v_ids is null then
    raise exception 'No estás en el equipo de este viaje.';
  end if;

  update public.participants
  set user_id = null,
      email = null,
      role = case when role = 'Organizador' then 'Participante' else role end
  where id = any(v_ids);

  update public.participant_invites set token = gen_random_uuid(), created_at = now()
  where participant_id = any(v_ids);
end;
$$;

-- Al borrar una cuenta: sus viajes pasan a un organizador con cuenta, o si no a la persona con
-- cuenta más antigua del equipo. Si no hay nadie, el viaje se borra (como hasta ahora).
-- "Con cuenta" = unida a su cuenta, o con el correo de una cuenta que existe.
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

drop trigger if exists reasignar_viajes_al_borrar_cuenta on auth.users;
create trigger reasignar_viajes_al_borrar_cuenta before delete on auth.users
  for each row execute function public.reasignar_viajes_al_borrar_cuenta();

revoke execute on function public.es_tarjeta_del_creador(bigint) from public, anon;
grant execute on function public.es_tarjeta_del_creador(bigint) to authenticated;
revoke execute on function public.proteger_creador_viaje() from public, anon, authenticated;
revoke execute on function public.traspasar_viaje(bigint, bigint) from public, anon;
grant execute on function public.traspasar_viaje(bigint, bigint) to authenticated;
revoke execute on function public.salir_del_viaje(bigint) from public, anon;
grant execute on function public.salir_del_viaje(bigint) to authenticated;
revoke execute on function public.reasignar_viajes_al_borrar_cuenta() from public, anon, authenticated;
