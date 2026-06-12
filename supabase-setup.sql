-- ============================================================
-- ATLETAS · Setup de Supabase
-- Pegá TODO esto en: Supabase → tu proyecto → SQL Editor → Run
-- ============================================================
-- Modelo: cada tabla guarda documentos JSON { id, data, updated_at }.
-- La app sincroniza estos documentos en tiempo real (igual que los
-- otros CRM de TNR). Récords y métricas se calculan en el navegador.
-- ============================================================

-- ---------- USUARIOS (atletas) ----------
create table if not exists public.atl_usuarios (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ---------- SESIONES (entrenamientos con ejercicios y series anidados) ----------
create table if not exists public.atl_sesiones (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ---------- EJERCICIOS personalizados (el catálogo base vive en data.js) ----------
create table if not exists public.atl_ejercicios (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ---------- Índices ----------
create index if not exists atl_usuarios_updated_idx  on public.atl_usuarios  (updated_at desc);
create index if not exists atl_sesiones_updated_idx  on public.atl_sesiones  (updated_at desc);
create index if not exists atl_ejercicios_updated_idx on public.atl_ejercicios (updated_at desc);
-- Búsqueda por usuario dentro del JSON de las sesiones
create index if not exists atl_sesiones_usuario_idx on public.atl_sesiones ((data->>'usuarioId'));

-- ============================================================
-- Realtime: que la app reciba cambios en vivo entre celulares
-- ============================================================
alter publication supabase_realtime add table public.atl_usuarios;
alter publication supabase_realtime add table public.atl_sesiones;
alter publication supabase_realtime add table public.atl_ejercicios;

-- ============================================================
-- Row Level Security
-- ------------------------------------------------------------
-- App privada de 2 atletas, sin login. Usamos la anon key y
-- permitimos lectura/escritura pública. Si más adelante querés
-- login real, reemplazá estas políticas por reglas por usuario.
-- ============================================================
alter table public.atl_usuarios   enable row level security;
alter table public.atl_sesiones   enable row level security;
alter table public.atl_ejercicios enable row level security;

-- USUARIOS
drop policy if exists atl_usuarios_all on public.atl_usuarios;
create policy atl_usuarios_all on public.atl_usuarios
  for all using (true) with check (true);

-- SESIONES
drop policy if exists atl_sesiones_all on public.atl_sesiones;
create policy atl_sesiones_all on public.atl_sesiones
  for all using (true) with check (true);

-- EJERCICIOS
drop policy if exists atl_ejercicios_all on public.atl_ejercicios;
create policy atl_ejercicios_all on public.atl_ejercicios
  for all using (true) with check (true);

-- ============================================================
-- Listo. Ahora copiá la URL y la anon key del proyecto
-- (Project Settings → API) y pegalas en config.js
-- ============================================================
