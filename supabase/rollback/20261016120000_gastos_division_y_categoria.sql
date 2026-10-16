-- Deshace supabase/migrations/20261016120000_gastos_division_y_categoria.sql.
-- Ojo: los gastos divididos por partes o montos vuelven a dividirse en partes iguales.

alter table public.expenses
  drop constraint if exists expenses_split_mode_valido,
  drop constraint if exists expenses_split_values_alineado,
  drop constraint if exists expenses_category_valida;

alter table public.expenses
  drop column if exists split_mode,
  drop column if exists split_values,
  drop column if exists category;
