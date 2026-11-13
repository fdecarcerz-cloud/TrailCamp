-- Deshace supabase/migrations/20261113140000_gastos_historial_papelera.sql.
-- Antes: deshacer la parte B (rollback/20261113150000_gastos_papelera_cerrar.sql) y volver a
-- la versión de la app sin papelera.
-- OJO: se pierde el historial (fecha del gasto, quién lo registró, modificó o borró), y lo que
-- esté en la papelera volvería a contar en las cuentas. Restaura o borra definitivamente lo
-- de la papelera antes de correr esto.

drop trigger if exists gasto_historial on public.expenses;
drop function if exists public.gasto_historial();
drop function if exists public.mandar_gasto_a_papelera(bigint);
drop function if exists public.restaurar_gasto(bigint);

-- borrar_participante como estaba
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

drop function if exists public.mi_nombre_en_viaje(bigint);

alter table public.expenses
  drop column if exists expense_date,
  drop column if exists created_by,
  drop column if exists created_by_name,
  drop column if exists updated_at,
  drop column if exists updated_by,
  drop column if exists updated_by_name,
  drop column if exists deleted_at,
  drop column if exists deleted_by,
  drop column if exists deleted_by_name;
