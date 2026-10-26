-- Invitar por celular: cada persona del equipo tiene un link de invitación personal
-- (participants.invite_token) que se manda por WhatsApp. Quien lo abre entra con Google o
-- con su correo, y ese lugar del equipo queda unido a su cuenta (participants.user_id).
-- Así ya no hace falta saber el correo exacto de cada uno: basta con el celular.
-- El acceso al viaje ahora se reconoce por la cuenta unida o, como antes, por el correo.
-- Para volver atrás: supabase/rollback/20261026120000_invitar_por_celular.sql

alter table public.participants
  add column phone text,
  add column user_id uuid references auth.users (id) on delete set null,
  add column invite_token uuid not null default gen_random_uuid();

alter table public.participants
  add constraint participants_phone_largo check (phone is null or length(phone) <= 20);

create unique index participants_invite_token_key on public.participants (invite_token);

-- Una cuenta ocupa a lo más un lugar por viaje
create unique index participants_viaje_cuenta_key on public.participants (trip_id, user_id)
  where user_id is not null;

-- Al agregar a alguien nadie elige el link ni une cuentas ajenas: el link siempre es
-- nuevo y solo se puede unir la propia cuenta (el creador al crear el viaje)
create or replace function public.participante_nuevo_seguro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.invite_token := gen_random_uuid();
  if new.user_id is distinct from (select auth.uid()) then
    new.user_id := null;
  end if;
  return new;
end;
$$;

create trigger participante_nuevo_seguro
  before insert on public.participants
  for each row execute function public.participante_nuevo_seguro();

create or replace function public.puede_ver_viaje(viaje_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips t
    where t.id = viaje_id and t.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.participants p
    where p.trip_id = viaje_id
      and (p.user_id = (select auth.uid())
        or lower(p.email) = lower((select auth.jwt()) ->> 'email'))
  );
$$;

drop policy "Ver mis viajes o donde participo" on public.trips;
create policy "Ver mis viajes o donde participo" on public.trips for select to public
  using (
    auth.uid() = user_id
    or id in (
      select p.trip_id from public.participants p
      where p.user_id = auth.uid()
        or lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- Datos para la pantalla de invitación. Se puede llamar sin sesión (para saludar antes de
-- pedir que entre), pero solo con el link, y muestra lo mínimo.
create or replace function public.ver_invitacion(p_token uuid)
returns table (
  trip_id bigint,
  viaje text,
  destino text,
  inicio text,
  fin text,
  nombre text,
  ocupada boolean,
  es_mia boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.destination, t.start_date, t.end_date, p.name,
    p.user_id is not null,
    p.user_id is not null and p.user_id = (select auth.uid())
  from public.participants p
  join public.trips t on t.id = p.trip_id
  where p.invite_token = p_token;
$$;

-- Une la cuenta de la sesión con el lugar del equipo del link. Devuelve el id del viaje.
create or replace function public.aceptar_invitacion(p_token uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := (select auth.jwt()) ->> 'email';
  v_part public.participants%rowtype;
  v_otro text;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para aceptar la invitación.';
  end if;

  select * into v_part from public.participants where invite_token = p_token;
  if not found then
    raise exception 'Este link de invitación no es válido. Pídele uno nuevo a quien te invitó.';
  end if;

  if v_part.user_id = v_uid then
    return v_part.trip_id;
  end if;
  if v_part.user_id is not null then
    raise exception 'Esta invitación ya la usó otra cuenta. Pídele a quien te invitó que lo revise.';
  end if;

  select name into v_otro from public.participants
  where trip_id = v_part.trip_id and id <> v_part.id
    and (user_id = v_uid or lower(email) = lower(v_email))
  limit 1;
  if found then
    raise exception 'Ya estás en este viaje como "%".', v_otro;
  end if;

  -- El correo pasa a ser el de la cuenta, para que la app lo muestre y lo reconozca
  update public.participants
  set user_id = v_uid,
      email = coalesce(v_email, email)
  where id = v_part.id;

  return v_part.trip_id;
end;
$$;

-- renombrar_participante ahora guarda también el celular. p_telefono null = no tocarlo
-- (así la versión anterior de la app sigue funcionando mientras se publica la nueva).
drop function public.renombrar_participante(bigint, text, text, text);

create or replace function public.renombrar_participante(
  p_id bigint, p_nombre text, p_email text, p_rol text, p_telefono text default null
)
returns void
language plpgsql
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
      phone = case when p_telefono is null then phone else nullif(btrim(p_telefono), '') end,
      role = p_rol
  where id = p_id;

  if v_viejo is distinct from v_nuevo then
    update public.gear set assigned_to = v_nuevo
    where trip_id = v_viaje and assigned_to = v_viejo;

    update public.carpools set driver_name = v_nuevo
    where trip_id = v_viaje and driver_name = v_viejo;

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

revoke execute on function public.renombrar_participante(bigint, text, text, text, text) from public, anon;
grant execute on function public.renombrar_participante(bigint, text, text, text, text) to authenticated;
revoke execute on function public.aceptar_invitacion(uuid) from public, anon;
grant execute on function public.aceptar_invitacion(uuid) to authenticated;
revoke execute on function public.ver_invitacion(uuid) from public;
grant execute on function public.ver_invitacion(uuid) to anon, authenticated;
revoke execute on function public.participante_nuevo_seguro() from public, anon, authenticated;
