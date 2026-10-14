-- Permite registrar "X ya le pagó a Y" en Gastos.
-- Un pago se guarda como un gasto especial: paid_by = quien paga, split_between = [quien recibe],
-- is_settlement = true. Así el cálculo de balances existente lo descuenta sin cambios, y la app
-- lo excluye del total gastado y lo muestra aparte en "Pagos realizados".
-- Para volver atrás: supabase/rollback/20261014170000_expenses_pagos.sql

alter table public.expenses add column if not exists is_settlement boolean not null default false;
