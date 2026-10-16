# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Product

TrailCamp organizes camping trips and getaways: a home screen with the user's trips, a packing list (gear), carpool to organize cars, and Tricount-style shared expenses.

Deployed on Vercel from GitHub: pushing to `main` goes to production, so run `npm run build` before pushing and never push without the user's OK.

- The Vercel project is `trail-camp` (https://trail-camp.vercel.app). The folder is linked (`.vercel/`) and the CLI is used via `npx vercel` (network, so the sandbox must be disabled).
- Check deploys with `npx vercel ls trail-camp` and logs with `npx vercel inspect <url> --logs`.
- The Supabase env vars live in Vercel for Production and Preview.
- `vercel link` and `vercel env pull` rewrite `.env.local`, so check the Supabase keys survive afterwards.

## Commands

- `npm run dev`: dev server at http://localhost:3000
- `npm run build`: production build. It also runs the TypeScript type check, so run it to catch type errors. Type drift between components and the shared interfaces has broken production builds before.
- `npm run lint`: ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript)

There is no test framework configured.

## Stack

Next.js 16 (App Router) + React 19, Tailwind CSS v4 (via `@tailwindcss/postcss`), and Supabase (`@supabase/supabase-js`) as the only backend. There are no API routes, server actions or server components that touch data. Everything runs client-side against Supabase with the anon key.

Env vars (in `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The client lives in `lib/supabase.ts`.

## Database (Supabase)

Project ref: `eysvljnbutnehnknczzq`. The CLI is used through `npx` and is already logged in. It is not linked, so pass `--linked --project-ref eysvljnbutnehnknczzq`. The sandbox blocks network, so these commands need the sandbox disabled.

- Query or apply SQL: `npx supabase db query --linked --project-ref eysvljnbutnehnknczzq "<sql>"` (or `-f file.sql`)
- Security lint: `npx supabase db advisors --linked --project-ref eysvljnbutnehnknczzq --type security`
- `supabase/estructura_actual.sql`: full snapshot of the public schema. Regenerate it after every DB change.
- Auth emails go out through custom SMTP: a dedicated Gmail account with an app password, set in the dashboard. The Spanish templates are in `supabase/plantillas-correo/` and are pasted into the dashboard by hand. Auth error messages are translated in `lib/authErrors.ts`.
- `supabase/migrations/`: changes applied to production, each with a matching undo script in `supabase/rollback/`. They were applied via `db query -f` wrapped in `begin/commit`, not via `db push`, so there is no remote migration history table.

## Architecture

- "Who am I" inside a trip is `myName` in `page.tsx`: the participant whose email matches the session email. It drives "Yo lo llevo", "Me subo" and hiding the invite button for yourself.

TrailCamp is a single-page trip/expedition coordinator. The UI text and code comments are in Spanish, so keep new UI strings in Spanish.

- `app/page.tsx` is a `"use client"` page that owns all state and is also the **source of truth for the shared data types** (`Trip`, `Participant`, `GearItem`, `Carpool`, `Expense`). Components import these types from `@/app/page`. Enum-like string unions (e.g. `GearItem["category"]`, participant `role`/`status`) must match the values stored in the Supabase tables.
- Data flow: `page.tsx` handles auth state (`supabase.auth.onAuthStateChange`), loads `trips`, then for the selected trip loads `participants`, `gear`, `carpools` and `expenses` in parallel (filtered by `trip_id`). It passes the arrays down to the tab components.
- `components/*Section.tsx` (Participants, Gear, Carpool, Expenses) each do their own insert/update/delete calls directly against Supabase, then call the `onRefresh` prop so the page refetches. There is no local optimistic state or global store.
- `components/AuthModal.tsx` handles email/password sign-in and sign-up.
- **Access control is enforced by Supabase RLS policies, not by the app.** `trips` queries have no user filter and rely on RLS. Creating a trip sets `user_id` and automatically inserts the creator as an `Organizador` participant. `trips` policies allow the owner, or anyone whose email is in that trip's `participants`. The other four tables use the security-definer helper `public.puede_ver_viaje(trip_id)`.
- Participants are referenced **by name, not ID**: `Expense.paid_by`, `Expense.split_between`, `GearItem.assigned_to`, `Carpool.driver_name` and `Carpool.passengers` store participant names. Each person rides in at most one car, and drivers are never passengers; CarpoolSection enforces this. Because of that, names are unique per trip (unique index on `(trip_id, lower(btrim(name)))`). Always rename or delete participants through the RPCs `renombrar_participante`, which propagates the new name to gear, carpool drivers and passengers, and expenses, and `borrar_participante`, which refuses if the person appears in expenses or drives a car, and frees their gear and seats. Never update or delete the rows directly. Only the trip creator may update or delete participants (`es_creador_viaje`); anyone in the trip can add them. Settlements are `expenses` rows with `is_settlement = true` (`paid_by` = payer, `split_between = [payee]`). They count in balances but not in the total spent. Trip notes live in `trips.description` and are saved through `guardar_notas_viaje`, which lets any participant edit them even though only the creator can update `trips`.
- The live DB has drifted from the TS interfaces in `app/page.tsx`. Ids are `bigint`, not strings. Tables also keep legacy columns: `trips.title`/`date` are kept in sync with `name`/`start_date` by triggers, and `carpools` has unused `driver`/`total_seats`. `carpools.car` is the optional vehicle label. In `gear`, the app uses `name`/`priority` (Imprescindible/Importante/Opcional)/`status`. Legacy `item` is nullable and the app no longer writes it. Check `supabase/estructura_actual.sql` before trusting the interfaces.
- `ExpensesSection` computes per-person balances and a greedy minimal-transfers settlement client-side (amounts are rounded, and balances within ±1 are ignored).
