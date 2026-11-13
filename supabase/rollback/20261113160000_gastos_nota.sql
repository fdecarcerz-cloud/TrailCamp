-- Deshace supabase/migrations/20261113160000_gastos_nota.sql.
-- Antes: volver a la versión de la app sin nota en los gastos.
-- OJO: se pierden las notas que se hayan escrito.

-- gasto_historial como estaba (sin la nota)
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

revoke execute on function public.gasto_historial() from public, anon, authenticated;

alter table public.expenses drop constraint if exists expenses_notes_largo;
alter table public.expenses drop column if exists notes;
