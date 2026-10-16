-- Gastos estilo Tricount:
-- * split_mode: 'igual' (partes iguales), 'partes' (ej. 2 y 1) o 'montos' (montos exactos).
-- * split_values: un número por persona, en el mismo orden que split_between (partes o montos).
--   NULL = partes iguales. Va alineado por posición para que renombrar_participante
--   (array_replace sobre split_between) no tenga que tocarlo.
-- * category: Comida, Transporte, Alojamiento, Actividades u Otros. La app la deduce de la
--   descripción; NULL en gastos antiguos (la app la calcula al mostrarlos).
-- Para volver atrás: supabase/rollback/20261016120000_gastos_division_y_categoria.sql

alter table public.expenses
  add column if not exists split_mode text not null default 'igual',
  add column if not exists split_values numeric[],
  add column if not exists category text;

alter table public.expenses
  add constraint expenses_split_mode_valido
    check (split_mode in ('igual', 'partes', 'montos')),
  add constraint expenses_split_values_alineado
    check (split_values is null or cardinality(split_values) = cardinality(split_between)),
  add constraint expenses_category_valida
    check (category is null or category in ('Comida', 'Transporte', 'Alojamiento', 'Actividades', 'Otros'));
