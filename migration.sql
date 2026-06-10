-- ============================================================
-- MIGRATION pour une base DÉJÀ créée avec l'ancien schéma.
-- À exécuter une seule fois dans Supabase → SQL Editor.
-- ============================================================

-- 1. Ajouter les nouvelles colonnes à la table demandes
alter table public.demandes
  add column if not exists moment_debut text not null default 'journee',
  add column if not exists moment_fin   text not null default 'journee',
  add column if not exists date_reprise date;

-- 2. Aligner les types de congés sur le modèle Word
--    (remplacer "Maladie" par "RTT / Repos compensateur", ajuster les libellés)
update public.types_conges set libelle = 'RTT / Repos compensateur', code = 'RTT'
  where code = 'MAL';
update public.types_conges set libelle = 'Congé pour événement familial'
  where code = 'EVT';

-- Si la ligne MAL n'existait pas et qu'il manque RTT, on l'ajoute :
insert into public.types_conges (libelle, code)
  select 'RTT / Repos compensateur', 'RTT'
  where not exists (select 1 from public.types_conges where code = 'RTT');
