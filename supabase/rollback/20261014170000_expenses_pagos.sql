-- Deshace supabase/migrations/20261014170000_expenses_pagos.sql.
-- Ojo: borra los pagos registrados. Si no se borraran, volverían a contar como gastos normales.

delete from public.expenses where is_settlement;
alter table public.expenses drop column if exists is_settlement;
