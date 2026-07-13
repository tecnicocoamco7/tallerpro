-- 1) Perfiles (rol y datos de cada usuario de la empresa)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre text,
  rol text not null default 'tecnico' check (rol in ('admin','tecnico')),
  activo boolean not null default true
);

alter table profiles enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin');
$$;

create policy "autenticados leen perfiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "solo admins editan perfiles" on profiles
  for update using (public.is_admin());

-- 2) Crea el perfil automáticamente al dar de alta un usuario en Authentication
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, nombre, rol, activo)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', new.email), 'tecnico', true);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Datos de la app (clientes, equipos, ordenes de trabajo, etc.)
create table if not exists tallerpro_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table tallerpro_state enable row level security;

create policy "solo autenticados acceden al estado" on tallerpro_state
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
