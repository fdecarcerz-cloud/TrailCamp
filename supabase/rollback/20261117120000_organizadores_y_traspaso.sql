-- Deshace supabase/migrations/20261117120000_organizadores_y_traspaso.sql.
-- Antes: volver a la versión anterior de la app (sin "Traspasar" ni "Salir del viaje").
-- OJO: los viajes que ya se traspasaron siguen con su nuevo creador, y quienes salieron de un
-- viaje siguen fuera. Si se borra la cuenta de un creador, sus viajes vuelven a borrarse.

drop trigger if exists reasignar_viajes_al_borrar_cuenta on auth.users;
drop function if exists public.reasignar_viajes_al_borrar_cuenta();
drop function if exists public.salir_del_viaje(bigint);
drop function if exists public.traspasar_viaje(bigint, bigint);

-- Editar el viaje: solo el creador (como estaba)
drop policy if exists "Modificar viaje (creador u organizador)" on public.trips;
drop policy if exists "Modificar mis viajes" on public.trips;
create policy "Modificar mis viajes" on public.trips
  as permissive for update to public
  using ((auth.uid() = user_id));

drop trigger if exists proteger_creador_viaje on public.trips;
drop function if exists public.proteger_creador_viaje();

drop policy if exists "Borrar del equipo (creador)" on public.participants;
create policy "Borrar del equipo (creador)" on public.participants
  as permissive for delete to authenticated
  using (public.es_creador_viaje(trip_id));

-- Funciones como estaban: editar y sacar personas, solo el creador
create or replace function public.renombrar_participante(p_id bigint, p_nombre text, p_email text, p_rol text, p_telefono text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viejo text;
  v_viaje bigint;
  v_nuevo text := btrim(coalesce(p_nombre, ''));
begin
  if v_nuevo = '' then
    raise exception 'El nombre no puede quedar vacío.';
  end if;

  select name, trip_id into v_viejo, v_viaje from public.participants where id = p_id;
  if not found then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;
  if not public.es_creador_viaje(v_viaje) then
    raise exception 'Solo el creador del viaje puede editar el equipo.';
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

create or replace function public.borrar_participante(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_viaje bigint;
  v_gastos int;
  v_papelera int;
  v_texto text;
begin
  select name, trip_id into v_nombre, v_viaje from public.participants where id = p_id;
  if not found then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;
  if not public.es_creador_viaje(v_viaje) then
    raise exception 'Solo el creador del viaje puede borrar personas del equipo.';
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

drop function if exists public.es_tarjeta_del_creador(bigint);
