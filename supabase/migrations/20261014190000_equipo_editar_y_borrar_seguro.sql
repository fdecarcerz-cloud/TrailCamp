-- Sección Equipo:
-- * Solo el creador del viaje puede editar o borrar participantes; todos los del viaje pueden ver y agregar.
-- * renombrar_participante: cambia nombre/email/rol y propaga el nombre a gear, carpools y expenses
--   (todo se referencia por nombre), en una sola transacción.
-- * borrar_participante: no deja borrar a quien aparece en gastos o pagos (romperia los balances);
--   libera su material asignado y su asiento en autos.
-- * Nombres únicos por viaje (sin distinguir mayúsculas ni espacios en los extremos).
-- Para volver atrás: supabase/rollback/20261014190000_equipo_editar_y_borrar_seguro.sql

create or replace function public.es_creador_viaje(viaje_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips t
    where t.id = viaje_id and t.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.es_creador_viaje(bigint) from public, anon;
grant execute on function public.es_creador_viaje(bigint) to authenticated;

drop policy if exists "Acceso por viaje" on public.participants;

create policy "Ver equipo del viaje" on public.participants
  for select to authenticated
  using (public.puede_ver_viaje(trip_id));

create policy "Agregar al equipo" on public.participants
  for insert to authenticated
  with check (public.puede_ver_viaje(trip_id));

create policy "Editar equipo (creador)" on public.participants
  for update to authenticated
  using (public.es_creador_viaje(trip_id))
  with check (public.es_creador_viaje(trip_id));

create policy "Borrar del equipo (creador)" on public.participants
  for delete to authenticated
  using (public.es_creador_viaje(trip_id));

create unique index if not exists participants_nombre_unico_por_viaje
  on public.participants (trip_id, lower(btrim(name)));

-- security invoker: corre con los permisos (RLS) de quien la llama.
create or replace function public.renombrar_participante(
  p_id bigint,
  p_nombre text,
  p_email text,
  p_rol text
)
returns void
language plpgsql
security invoker
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
      role = p_rol
  where id = p_id;

  if v_viejo is distinct from v_nuevo then
    update public.gear set assigned_to = v_nuevo
    where trip_id = v_viaje and assigned_to = v_viejo;

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

revoke execute on function public.renombrar_participante(bigint, text, text, text) from public, anon;
grant execute on function public.renombrar_participante(bigint, text, text, text) to authenticated;

create or replace function public.borrar_participante(p_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text;
  v_viaje bigint;
  v_gastos int;
begin
  select name, trip_id into v_nombre, v_viaje from public.participants where id = p_id;
  if not found then
    raise exception 'No se encontró a esa persona en el equipo.';
  end if;
  if not public.es_creador_viaje(v_viaje) then
    raise exception 'Solo el creador del viaje puede borrar personas del equipo.';
  end if;

  select count(*) into v_gastos from public.expenses
  where trip_id = v_viaje and (paid_by = v_nombre or v_nombre = any(split_between));

  if v_gastos > 0 then
    raise exception '% aparece en %. Edita o borra esos gastos primero, para que las cuentas no queden mal.',
      v_nombre,
      case when v_gastos = 1 then '1 gasto o pago' else v_gastos || ' gastos o pagos' end;
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

revoke execute on function public.borrar_participante(bigint) from public, anon;
grant execute on function public.borrar_participante(bigint) to authenticated;
