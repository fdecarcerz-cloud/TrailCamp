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
- Auth emails go out through custom SMTP: a dedicated Gmail account with an app password, set in the dashboard. The Spanish templates are in `supabase/plantillas-correo/` and are pasted into the dashboard by hand. Auth error messages are translated in `lib/authErrors.ts`. Google sign-in is also enabled: the OAuth client lives in the user's Google Cloud project, and `/privacidad` is the privacy policy Google requires. The button is Google Identity Services (`components/GoogleSignInButton.tsx`) and calls `signInWithIdToken` with a nonce, so the consent screen says "Trailcamp" instead of the Supabase domain. It needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and local tests must run on port 3000, which is an authorized JS origin.
- `supabase/migrations/`: changes applied to production, each with a matching undo script in `supabase/rollback/`. They were applied via `db query -f` wrapped in `begin/commit`, not via `db push`, so there is no remote migration history table.

## Architecture

TrailCamp is a camping-trip coordinator. The UI text and code comments are in Spanish, so keep new UI strings in Spanish.

- **Routes:**
  - `/` is Inicio (`components/home/HomeScreen.tsx`). It shows the next trip, cross-trip to-dos, upcoming and past trips, and a short "Tus estadísticas" for the current trip (or the last one done) with a link to `/estadisticas`. The math is in `lib/home.ts`, loaded by `components/home/useHomeSummary.ts`.
  - `/estadisticas` (`components/home/StatsScreen.tsx`, linked from the ⋯ menu) shows the all-time stats: trips, nights, your share in total, by category and per trip, and your most frequent companion.
  - `/viaje/[id]` is one trip (`components/trip/TripScreen.tsx`, keyed by id). It holds the tabs, the notes, the creator-only edit/delete buttons, and the realtime subscription.
  - `/privacidad` is the privacy policy.
  - `/invitacion/[token]` is a personal invite link (`components/invite/InviteScreen.tsx`).
- **Invitations:** people are added with a name and, optionally, a phone (normalized to `+56…` by `lib/phone.ts`) and/or email. Each participant row has a unique `invite_token`. The invite message is sent by WhatsApp straight to that phone. Opening the link calls `ver_invitacion` (also callable without a session) and then `aceptar_invitacion`, which sets `participants.user_id` to the session's account and its email. An insert trigger always generates a fresh token and only allows `user_id = auth.uid()`. If the user has to confirm their email first, `lib/invite.ts` keeps the token in localStorage and `AppProvider` brings them back to the link after login. There is no SMS login: people sign in with Google or email.
- **`components/app/AppProvider.tsx`** (mounted in `app/layout.tsx`, read with `useApp()`):
  - Owns the session, `displayName`, the `trips` list and `fetchTrips`.
  - Renders the shared modals: auth, new password, trip form, profile and install prompt.
  - Subscribes to `participants` inserts for the user's email, so new invitations show up live.
  - `displayName` comes from `user_metadata.nombre` (set in "Mi cuenta"), falling back to the Google name and then the email prefix. New trips add the creator as Organizador under that name.
- `components/app/AppHeader.tsx` holds the logo, or "← Inicio" inside a trip, plus the ⋯ account menu.
- **Data types** live in `lib/types.ts`. Enum-like unions (participant `role`/`status`, gear `priority`/`status`) must match the values stored in the DB.
- **Who am I inside a trip** is `myName`: the participant linked to the session's account (`user_id`) or whose email matches the session email (`isMe` in `lib/home.ts`). It drives "Yo lo llevo", "Me subo" and hiding the invite button for yourself.
- **Section components:** `components/*Section.tsx` write to Supabase directly and then call `onRefresh`. There is no optimistic state.
- **Realtime:** `TripScreen` subscribes to `postgres_changes` for its trip. It refetches with a 400 ms debounce, and also when the tab becomes visible again. DELETE events only carry the id, so they are matched against the loaded rows. Every trip table is in the `supabase_realtime` publication.
- **Access control is enforced by Supabase RLS policies, not by the app.** `trips` queries have no user filter and rely on RLS. Creating a trip sets `user_id` and automatically inserts the creator as an `Organizador` participant. `trips` policies allow the owner, or anyone who is in that trip's `participants` by `user_id` or by email. The other four tables use the security-definer helper `public.puede_ver_viaje(trip_id)`.
- Participants are referenced **by name, not ID**: `Expense.paid_by`, `Expense.split_between`, `GearItem.assigned_to`, `Carpool.driver_name` and `Carpool.passengers` store participant names. Each person rides in at most one car, and drivers are never passengers; CarpoolSection enforces this. Because of that, names are unique per trip (unique index on `(trip_id, lower(btrim(name)))`). Always rename or delete participants through the RPCs `renombrar_participante`, which propagates the new name to gear, carpool drivers and passengers, and expenses, and `borrar_participante`, which refuses if the person appears in expenses or drives a car, and frees their gear and seats. Never update or delete the rows directly. Only the trip creator may update or delete participants (`es_creador_viaje`); anyone in the trip can add them. Settlements are `expenses` rows with `is_settlement = true` (`paid_by` = payer, `split_between = [payee]`). They count in balances but not in the total spent. Trip notes live in `trips.description` and are saved through `guardar_notas_viaje`, which lets any participant edit them even though only the creator can update `trips`.
- The live DB has drifted from the TS interfaces in `lib/types.ts`. Ids are `bigint`, not strings. Tables also keep legacy columns: `trips.title`/`date` are kept in sync with `name`/`start_date` by triggers, and `carpools` has unused `driver`/`total_seats`. `carpools.car` is the optional vehicle label. In `gear`, the app uses `name`/`priority` (Imprescindible/Importante/Opcional)/`status`. Legacy `item` is nullable and the app no longer writes it. Check `supabase/estructura_actual.sql` before trusting the interfaces.
- Expenses work like Tricount. All the math is in `lib/expenses.ts`:
  - `sharesOf` handles the split modes: `split_mode` is `igual`, `partes` or `montos`, and `split_values` holds one number per person, aligned by position with `split_between`. A DB check enforces equal length, so `renombrar_participante` can keep using `array_replace`.
  - `summarize` and `computeTransfers` build the balances and the greedy settlement.
  - `guessCategory` assigns the category automatically from the description.
  - Partial payments are plain settlement rows with any amount. The UI is split into `components/expenses/` (the form and the charts, which are hidden behind a toggle).
