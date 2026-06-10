-- ============================================================
-- Espace de demande de congés - Paroisse Notre-Dame du Bon Secours
-- Schéma Supabase / PostgreSQL — VERSION À JOUR
-- (inclut moments matin/aprem, date de reprise, types alignés sur le modèle Word)
-- ============================================================

-- 1. PROFILS SALARIÉS (liés à auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom_complet text not null,
  email text not null,
  solde_conges numeric(5,1) default 25.0,
  cree_le timestamptz default now()
);

-- 2. APPROBATEURS
create table if not exists public.approbateurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  email text not null unique,
  actif boolean default true
);

-- 3. MEMBRES CPAE
create table if not exists public.membres_cpae (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  email text not null unique,
  actif boolean default true
);

-- 4. TYPES DE CONGÉS (alignés sur le modèle Word)
create table if not exists public.types_conges (
  id serial primary key,
  libelle text not null,
  code text not null unique
);

insert into public.types_conges (libelle, code) values
  ('Congés payés', 'CP'),
  ('Congé sans solde', 'CSS'),
  ('RTT / Repos compensateur', 'RTT'),
  ('Congé pour événement familial', 'EVT'),
  ('Autre', 'AUTRE')
on conflict (code) do nothing;

-- 5. DEMANDES
do $$ begin
  create type statut_demande as enum ('en_attente', 'validee', 'refusee');
exception when duplicate_object then null; end $$;

create table if not exists public.demandes (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid not null references public.profiles(id),
  type_conge_id int not null references public.types_conges(id),
  date_debut date not null,
  moment_debut text not null default 'journee',   -- journee | apresmidi
  date_fin date not null,
  moment_fin text not null default 'journee',      -- journee | matin
  nb_jours numeric(4,1) not null,
  date_reprise date,
  motif text,
  statut statut_demande not null default 'en_attente',
  cree_le timestamptz default now(),
  resolu_par uuid references public.approbateurs(id),
  resolu_le timestamptz,
  motif_refus text
);

-- 6. JETONS D'ACTION (liens magiques approbateurs)
create table if not exists public.jetons_action (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes(id) on delete cascade,
  approbateur_id uuid not null references public.approbateurs(id),
  token text not null unique,
  utilise boolean default false,
  cree_le timestamptz default now(),
  unique (demande_id, approbateur_id)
);

-- 7. JOURNAL DES MAILS
create table if not exists public.journal_mails (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references public.demandes(id),
  type_event text not null,
  destinataires text[],
  envoye_le timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.demandes enable row level security;

drop policy if exists "profil_self" on public.profiles;
create policy "profil_self" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "demandes_self_select" on public.demandes;
create policy "demandes_self_select" on public.demandes
  for select using (auth.uid() = salarie_id);

drop policy if exists "demandes_self_insert" on public.demandes;
create policy "demandes_self_insert" on public.demandes
  for insert with check (auth.uid() = salarie_id);
