-- Gastos con historial y papelera (parte A).
--
-- Cada gasto (y pago) guarda:
--   - expense_date: la fecha del gasto (se puede editar; por defecto, hoy en Chile);
--   - quién lo registró y cuándo (created_by, created_by_name, created_at);
--   - quién lo modificó por última vez y cuándo (updated_by, updated_by_name, updated_at);
--   - si está en la papelera: quién lo mandó y cuándo (deleted_by, deleted_by_name, deleted_at).
-- La base pone quién lo hizo a partir de la sesión: la app no puede inventarlo.
-- El nombre se guarda como estaba en ese momento, para que se lea aunque la persona deje el viaje.
--
-- Borrar un gasto o deshacer un pago lo manda a la papelera (mandar_gasto_a_papelera) y
-- cualquiera del viaje lo puede restaurar (restaurar_gasto). Lo de la papelera no cuenta en
-- totales ni saldos: la app lo separa por deleted_at.
--
-- Los gastos antiguos quedan con estos campos vacíos: la app muestra la fecha de creación y
-- no muestra "Registrado por".
--
-- No quita nada: la versión anterior de la app sigue funcionando. La parte B
-- (20261113150000_gastos_papelera_cerrar.sql) deja el borrado definitivo solo al creador.
-- Para volver atrás: supabase/rollback/20261113140000_gastos_historial_papelera.sql

-- Sin default al agregarla, para que los gastos antiguos no queden con la fecha de hoy
alter table public.expenses
  add column if not exists expense_date date,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by_name text,
  add column if not exists updated_at timestamp with time zone,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_name text,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_by_name text;

alter table public.expenses
  alter column expense_date set default ((now() at time zone 'America/Santiago')::date);

-- El nombre de quien usa la app dentro del viaje: su tarjeta del equipo (por cuenta o correo),
-- o si no tiene, el nombre de su cuenta o el comienzo de su correo
create or replace function public.mi_nombre_en_viaje(p_viaje bigint)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select p.name from public.participants p
     where p.trip_id = p_viaje
       and (p.user_id = (select auth.uid())
         or lower(p.email) = lower((select auth.jwt()) ->> 'email'))
     order by (p.user_id = (select auth.uid())) desc nulls last
     limit 1),
    nullif(btrim((select auth.jwt()) -> 'user_metadata' ->> 'nombre'), ''),
    nullif(btrim((select auth.jwt()) -> 'user_metadata' ->> 'full_name'), ''),
    split_part((select auth.jwt()) ->> 'email', '@', 1)
  );
$$;

-- Llena el historial en los cambios hechos desde la app (rol authenticated). Las funciones de
-- la base (papelera, renombrar personas) corren como su dueño y no pasan por aquí: así
-- renombrar a alguien no deja a otra persona como "Modificado por".
create or replace function public.gasto_historial()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
    new.created_by_name := public.mi_nombre_en_viaje(new.trip_id);
    new.expense_date := coalesce(new.expense_date, (now() at time zone 'America/Santiago')::date);
    new.updated_at := null;
    new.updated_by := null;
    new.updated_by_name := null;
    new.deleted_at := null;
    new.deleted_by := null;
    new.deleted_by_name := null;
    return new;
  end if;

  if old.deleted_at is not null then
    raise exception 'Este gasto está en la papelera. Restáuralo antes de editarlo.';
  end if;

  -- Quién lo registró y la papelera no se cambian editando
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.created_by_name := old.created_by_name;
  new.deleted_at := old.deleted_at;
  new.deleted_by := old.deleted_by;
  new.deleted_by_name := old.deleted_by_name;

  if (new.trip_id, new.description, new.amount, new.paid_by, new.split_between, new.split_mode,
      new.split_values, new.category, new.receipt_path, new.expense_date, new.is_settlement)
     is distinct from
     (old.trip_id, old.description, old.amount, old.paid_by, old.split_between, old.split_mode,
      old.split_values, old.category, old.receipt_path, old.expense_date, old.is_settlement) then
    new.updated_at := now();
    new.updated_by := (select auth.uid());
    new.updated_by_name := public.mi_nombre_en_viaje(new.trip_id);
  else
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
    new.updated_by_name := old.updated_by_name;
  end if;
  return new;
end;
$$;

drop trigger if exists gasto_historial on public.expenses;
create trigger gasto_historial before insert or update on public.expenses
  for each row execute function public.gasto_historial();

create or replace function public.mandar_gasto_a_papelera(p_gasto bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.expenses%rowtype;
begin
  select * into v from public.expenses where id = p_gasto for update;
  if not found or not public.puede_ver_viaje(v.trip_id) then
    raise exception 'Este gasto ya no existe (alguien lo borró).';
  end if;
  if v.deleted_at is not null then
    return; -- otra persona ya lo mandó a la papelera
  end if;
  update public.expenses
  set deleted_at = now(),
      deleted_by = (select auth.uid()),
      deleted_by_name = public.mi_nombre_en_viaje(v.trip_id)
  where id = p_gasto;
end;
$$;

create or replace function public.restaurar_gasto(p_gasto bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.expenses%rowtype;
begin
  select * into v from public.expenses where id = p_gasto for update;
  if not found or not public.puede_ver_viaje(v.trip_id) then
    raise exception 'Este gasto ya no existe (alguien lo borró definitivamente).';
  end if;
  if v.deleted_at is null then
    return; -- otra persona ya lo restauró
  end if;
  update public.expenses
  set deleted_at = null,
      deleted_by = null,
      deleted_by_name = null
  where id = p_gasto;
end;
$$;

-- Igual que antes, pero avisa si los gastos donde aparece la persona están en la papelera
-- (ahí también cuentan: si se restauran, la persona tiene que seguir en el equipo)
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

revoke execute on function public.mi_nombre_en_viaje(bigint) from public, anon;
grant execute on function public.mi_nombre_en_viaje(bigint) to authenticated;
revoke execute on function public.gasto_historial() from public, anon, authenticated;
revoke execute on function public.mandar_gasto_a_papelera(bigint) from public, anon;
grant execute on function public.mandar_gasto_a_papelera(bigint) to authenticated;
revoke execute on function public.restaurar_gasto(bigint) from public, anon;
grant execute on function public.restaurar_gasto(bigint) to authenticated;
