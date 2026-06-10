// lib/dateConges.ts
// Calcul du nombre de jours ouvrés et de la date de reprise,
// en tenant compte des week-ends, des jours fériés (Réunion) et des demi-journées.

// ── Jours fériés (à compléter chaque année). Format "AAAA-MM-JJ". ──
// Inclut les fériés nationaux + le 20/12 (Abolition de l'esclavage, La Réunion).
export const JOURS_FERIES: string[] = [
  // 2026
  "2026-01-01", // Jour de l'an
  "2026-04-06", // Lundi de Pâques
  "2026-05-01", // Fête du travail
  "2026-05-08", // Victoire 1945
  "2026-05-14", // Ascension
  "2026-05-25", // Lundi de Pentecôte
  "2026-07-14", // Fête nationale
  "2026-08-15", // Assomption
  "2026-11-01", // Toussaint
  "2026-11-11", // Armistice
  "2026-12-20", // Abolition de l'esclavage (La Réunion)
  "2026-12-25", // Noël
  // 2027
  "2027-01-01",
  "2027-03-29", // Lundi de Pâques 2027
  "2027-05-01",
  "2027-05-06", // Ascension 2027
  "2027-05-08",
  "2027-05-17", // Lundi de Pentecôte 2027
  "2027-07-14",
  "2027-08-15",
  "2027-11-01",
  "2027-11-11",
  "2027-12-20",
  "2027-12-25",
];

type Moment = "journee" | "matin" | "apresmidi";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function estWeekend(d: Date): boolean {
  const j = d.getUTCDay();
  return j === 0 || j === 6; // dimanche=0, samedi=6
}
function estFerie(d: Date): boolean {
  return JOURS_FERIES.includes(ymd(d));
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

  // Compter les jours ouvrés pleins entre début et fin inclus
  let count = 0;
  let cur = new Date(dDebut);
  while (cur <= dFin) {
    if (estOuvre(cur)) count += 1;
    cur = ajouterJours(cur, 1);
  }
  if (count === 0) return 0;

  // Même jour : une seule demi-journée possible
  if (ymd(dDebut) === ymd(dFin)) {
    if (momentDebut !== "journee" || momentFin !== "journee") return 0.5;
    return 1;
  }

  // Retirer 0,5 si on commence l'après-midi, 0,5 si on finit le matin
  let total = count;
  if (momentDebut === "apresmidi") total -= 0.5;
  if (momentFin === "matin") total -= 0.5;
  return total;
}

// Date de reprise du travail (premier moment travaillé après le congé).
export function calculerDateReprise(fin: string, momentFin: Moment): string {
  const dFin = new Date(fin + "T00:00:00Z");
  // Si la fin est une demi-journée matin → reprise l'après-midi du même jour
  if (momentFin === "matin") return ymd(dFin);
  // Sinon (journée entière ou demi-journée après-midi) → prochain jour ouvré
  let r = ajouterJours(dFin, 1);
  while (!estOuvre(r)) r = ajouterJours(r, 1);
  return ymd(r);
}
