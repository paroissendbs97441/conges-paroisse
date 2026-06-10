// lib/dateConges.ts
// Calcul du nombre de jours ouvrés et de la date de reprise,
// en tenant compte des week-ends, des jours fériés (Réunion) et des demi-journées.

// ── Jours fériés de secours (la base Supabase les remplace au démarrage). ──
export const JOURS_FERIES: string[] = [
  "2026-01-01", "2026-04-06", "2026-05-01", "2026-05-08", "2026-05-14",
  "2026-05-25", "2026-07-14", "2026-08-15", "2026-11-01", "2026-11-11",
  "2026-12-20", "2026-12-25",
  "2027-01-01", "2027-03-29", "2027-05-01", "2027-05-06", "2027-05-08",
  "2027-05-17", "2027-07-14", "2027-08-15", "2027-11-01", "2027-11-11",
  "2027-12-20", "2027-12-25",
];

type Moment = "journee" | "matin" | "apresmidi";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function estWeekend(d: Date): boolean {
  const j = d.getUTCDay();
  return j === 0 || j === 6;
}

// Liste effectivement utilisée par les calculs.
// Par défaut = la liste en dur (secours), mais la page la remplace
// au démarrage avec les jours fériés chargés depuis Supabase.
let FERIES_ACTIFS: string[] = [...JOURS_FERIES];

// Permet à l'app de fournir les jours fériés issus de la base.
export function definirJoursFeries(dates: string[]) {
  if (dates && dates.length > 0) FERIES_ACTIFS = dates;
}

function estFerie(d: Date): boolean {
  return FERIES_ACTIFS.includes(ymd(d));
}
function estOuvre(d: Date): boolean {
  return !estWeekend(d) && !estFerie(d);
}
function ajouterJours(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// Nombre de jours ouvrés de congé, demi-journées comprises.
export function calculerNbJours(
  debut: string, momentDebut: Moment,
  fin: string, momentFin: Moment
): number {
  const dDebut = new Date(debut + "T00:00:00Z");
  const dFin = new Date(fin + "T00:00:00Z");
  if (dFin < dDebut) return 0;

  let count = 0;
  let cur = new Date(dDebut);
  while (cur <= dFin) {
    if (estOuvre(cur)) count += 1;
    cur = ajouterJours(cur, 1);
  }
  if (count === 0) return 0;

  if (ymd(dDebut) === ymd(dFin)) {
    if (momentDebut !== "journee" || momentFin !== "journee") return 0.5;
    return 1;
  }

  let total = count;
  if (momentDebut === "apresmidi") total -= 0.5;
  if (momentFin === "matin") total -= 0.5;
  return total;
}

// Date de reprise du travail (premier moment travaillé après le congé).
export function calculerDateReprise(fin: string, momentFin: Moment): string {
  const dFin = new Date(fin + "T00:00:00Z");
  if (momentFin === "matin") return ymd(dFin);
  let r = ajouterJours(dFin, 1);
  while (!estOuvre(r)) r = ajouterJours(r, 1);
  return ymd(r);
}

// ============================================================
// V2 — Calcul basé sur les cases à cocher Matin / Après-midi
// ============================================================

function momentDepuisCases(matin: boolean, aprem: boolean): Moment | null {
  if (matin && aprem) return "journee";
  if (matin && !aprem) return "matin";
  if (!matin && aprem) return "apresmidi";
  return null;
}

export type SaisieDemi = {
  debutMatin: boolean; debutAprem: boolean;
  finMatin: boolean; finAprem: boolean;
};

export function validerDemande(
  debut: string, fin: string, s: SaisieDemi
): string | null {
  if (!debut || !fin) return "Merci de renseigner les deux dates.";
  const dDebut = new Date(debut + "T00:00:00Z");
  const dFin = new Date(fin + "T00:00:00Z");
  if (dFin < dDebut) return "La date de fin ne peut pas être antérieure à la date de début.";
  if (!s.debutMatin && !s.debutAprem) return "Cochez au moins matin ou après-midi pour le début.";
  if (!s.finMatin && !s.finAprem) return "Cochez au moins matin ou après-midi pour la fin.";
  if (ymd(dDebut) === ymd(dFin)) {
    const matin = s.debutMatin && s.finMatin;
    const aprem = s.debutAprem && s.finAprem;
    if (!matin && !aprem && !(s.debutMatin && s.finAprem)) {
      return "La sélection matin/après-midi est incohérente pour une même journée.";
    }
  }
  return null;
}

export function calculerNbJoursCases(
  debut: string, fin: string, s: SaisieDemi
): number {
  const dDebut = new Date(debut + "T00:00:00Z");
  const dFin = new Date(fin + "T00:00:00Z");
  if (dFin < dDebut) return 0;

  if (ymd(dDebut) === ymd(dFin)) {
    if (!estOuvre(dDebut)) return 0;
    const matin = s.debutMatin && s.finMatin;
    const aprem = s.debutAprem && s.finAprem;
    let jour = 0;
    if (matin) jour += 0.5;
    if (aprem) jour += 0.5;
    if (s.debutMatin && s.finAprem) jour = 1;
    return jour;
  }

  const mDebut = momentDepuisCases(s.debutMatin, s.debutAprem);
  const mFin = momentDepuisCases(s.finMatin, s.finAprem);
  if (!mDebut || !mFin) return 0;
  const momentDebut: Moment = (s.debutMatin ? "journee" : "apresmidi");
  const momentFin: Moment = (s.finAprem ? "journee" : "matin");
  return calculerNbJours(debut, momentDebut, fin, momentFin);
}

export function calculerDateRepriseCases(fin: string, s: SaisieDemi): string {
  const momentFin: Moment = (s.finAprem ? "journee" : "matin");
  return calculerDateReprise(fin, momentFin);
}
