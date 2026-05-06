-- Ejecutar en Supabase SQL Editor antes de activar la sincronizacion.
-- Esta version usa anon key y politicas abiertas para una app privada.
-- Para datos sensibles conviene agregar Supabase Auth y politicas por usuario.

create table if not exists public.sso_inspecciones (
    id bigint primary key,
    empresa_id text not null default '',
    empresa_nombre text not null default '',
    fecha date,
    obra text not null default '',
    payload jsonb not null,
    updated_at timestamptz not null default now()
);

create table if not exists public.sso_documentos (
    id bigint primary key,
    empresa_id text not null default '',
    empresa_nombre text not null default '',
    fecha date,
    obra text not null default '',
    tipo text not null default 'documento',
    payload jsonb not null,
    updated_at timestamptz not null default now()
);

create index if not exists sso_inspecciones_empresa_id_idx on public.sso_inspecciones (empresa_id);
create index if not exists sso_inspecciones_updated_at_idx on public.sso_inspecciones (updated_at desc);
create index if not exists sso_documentos_empresa_id_idx on public.sso_documentos (empresa_id);
create index if not exists sso_documentos_updated_at_idx on public.sso_documentos (updated_at desc);

alter table public.sso_inspecciones enable row level security;
alter table public.sso_documentos enable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on public.sso_inspecciones to anon;
grant select, insert, update, delete on public.sso_documentos to anon;

drop policy if exists "sso_inspecciones_select_anon" on public.sso_inspecciones;
drop policy if exists "sso_inspecciones_insert_anon" on public.sso_inspecciones;
drop policy if exists "sso_inspecciones_update_anon" on public.sso_inspecciones;
drop policy if exists "sso_inspecciones_delete_anon" on public.sso_inspecciones;

create policy "sso_inspecciones_select_anon"
on public.sso_inspecciones for select to anon
using (true);

create policy "sso_inspecciones_insert_anon"
on public.sso_inspecciones for insert to anon
with check (true);

create policy "sso_inspecciones_update_anon"
on public.sso_inspecciones for update to anon
using (true)
with check (true);

create policy "sso_inspecciones_delete_anon"
on public.sso_inspecciones for delete to anon
using (true);

drop policy if exists "sso_documentos_select_anon" on public.sso_documentos;
drop policy if exists "sso_documentos_insert_anon" on public.sso_documentos;
drop policy if exists "sso_documentos_update_anon" on public.sso_documentos;
drop policy if exists "sso_documentos_delete_anon" on public.sso_documentos;

create policy "sso_documentos_select_anon"
on public.sso_documentos for select to anon
using (true);

create policy "sso_documentos_insert_anon"
on public.sso_documentos for insert to anon
with check (true);

create policy "sso_documentos_update_anon"
on public.sso_documentos for update to anon
using (true)
with check (true);

create policy "sso_documentos_delete_anon"
on public.sso_documentos for delete to anon
using (true);
