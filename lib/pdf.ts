// lib/pdf.ts
// Génère le PDF récapitulatif reproduisant le modèle Word de la paroisse.
// Cases cochées automatiquement, signatures remplacées par nom + date.
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

const BLEU = "#1f3864";
const GRIS = "#d9d9d9";
const NOIR = "#000000";

// Libellés des types de congé tels qu'affichés dans le modèle (section 2)
const NATURE = [
  { code: "CP",    label: "Congés payés (art. L3141-1 et s. du Code du travail)" },
  { code: "CSS",   label: "Congé sans solde" },
  { code: "RTT",   label: "RTT / Repos compensateur" },
  { code: "EVT",   label: "Congé pour événement familial (art. L3142-1 et s.)" },
  { code: "AUTRE", label: "Autre :" },
];

function fr(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}
function frDateHeure(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Indian/Reunion" });
}

export async function genererPdfDemande(d: any, approbateur: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const valide = d.statut === "validee";
    const M = 50;                 // marge gauche
    const W = 595.28 - M * 2;     // largeur utile (A4 = 595.28pt)
    const codeType = d.types_conges?.code;

    // ── En-tête : logo + nom paroisse ──
    try {
      const logo = path.join(process.cwd(), "lib", "logo.png");
      if (fs.existsSync(logo)) doc.image(logo, M + W - 110, 38, { fit: [110, 70] });
    } catch {}
    doc.fillColor(NOIR).font("Helvetica-Bold").fontSize(14)
       .text("Paroisse Notre-Dame du Bon Secours", M, 50);
    doc.font("Helvetica").fontSize(9)
       .text("7 Rue Sainte-Vivienne - 97441 Sainte Suzanne", M, 70);

    doc.moveTo(M, 95).lineTo(M + W, 95).strokeColor(BLEU).lineWidth(1.5).stroke();
    doc.fillColor(BLEU).font("Helvetica-Bold").fontSize(20)
       .text("DEMANDE DE CONGÉS", M, 105, { width: W, align: "center" });
    doc.fillColor("#444").font("Helvetica-Oblique").fontSize(9)
       .text("(à remettre au responsable hiérarchique au moins 1 mois avant le départ)",
             M, 130, { width: W, align: "center" });
    doc.moveTo(M, 148).lineTo(M + W, 148).strokeColor(BLEU).lineWidth(1.5).stroke();

    let y = 165;

    // Dessine une case à cocher vectorielle (carré + coche si cochée)
    const caseACocher = (x: number, cy: number, cochee: boolean, taille = 9) => {
      doc.lineWidth(0.8).strokeColor(NOIR).rect(x, cy, taille, taille).stroke();
      if (cochee) {
        doc.lineWidth(1.3).strokeColor(NOIR)
           .moveTo(x + 1.5, cy + taille / 2)
           .lineTo(x + taille / 2.7, cy + taille - 1.5)
           .lineTo(x + taille - 1, cy + 1.5)
           .stroke();
      }
    };

    const titre = (t: string) => {
      doc.fillColor(NOIR).font("Helvetica-Bold").fontSize(12).text(t, M, y);
      y += 20;
    };
    // Petite ligne de tableau gris à 2 colonnes
    const rowInfo = (label: string, val: string, h = 24) => {
      doc.rect(M, y, 180, h).fillAndStroke(GRIS, "#bbbbbb");
      doc.rect(M + 180, y, W - 180, h).fillAndStroke("#ffffff", "#bbbbbb");
      doc.fillColor(NOIR).font("Helvetica-Bold").fontSize(10)
         .text(label, M + 6, y + 7, { width: 168 });
      doc.font("Helvetica").fontSize(10)
         .text(val, M + 186, y + 7, { width: W - 192 });
      y += h;
    };

    // ── 1. Identité ──
    titre("1. Identité du / de la salarié(e)");
    rowInfo("Nom et prénom", d.profiles.nom_complet);
    rowInfo("Date de la demande de congés", frDateHeure(d.cree_le));
    y += 16;

    // ── 2. Nature du congé (cases cochées) ──
    titre("2. Nature du congé sollicité");
    for (const n of NATURE) {
      const coche = n.code === codeType;
      caseACocher(M + 4, y + 1, coche);
      let txt = n.label;
      if (n.code === "AUTRE" && coche && d.motif) txt += " " + d.motif;
      doc.fillColor(NOIR).font("Helvetica").fontSize(10).text(txt, M + 20, y, { width: W - 24 });
      y += 18;
    }
    y += 10;

    // ── 3. Période demandée ──
    titre("3. Période demandée");
    const momentTxt = (m: string) =>
      m === "matin" ? " (matin)" : m === "apresmidi" ? " (après-midi)" : "";
    rowInfo("Date de début", fr(d.date_debut) + momentTxt(d.moment_debut));
    rowInfo("Date de reprise du travail", fr(d.date_reprise));
    rowInfo("Nombre de jours ouvrables", String(d.nb_jours));
    y += 16;

    // ── 4. Décision (ex-Signatures) ──
    titre("4. Décision");
    const colW = W / 2;
    const boxTop = y;
    const boxH = 95;
    // En-têtes des deux colonnes
    doc.rect(M, y, colW, 22).fillAndStroke(GRIS, "#bbbbbb");
    doc.rect(M + colW, y, colW, 22).fillAndStroke(GRIS, "#bbbbbb");
    doc.fillColor(NOIR).font("Helvetica-Bold").fontSize(10)
       .text("Le / La salarié(e)", M + 6, y + 6, { width: colW - 12 });
    doc.text("L'employeur (ou son représentant)", M + colW + 6, y + 6, { width: colW - 12 });
    // Corps des deux colonnes
    doc.rect(M, y + 22, colW, boxH).stroke("#bbbbbb");
    doc.rect(M + colW, y + 22, colW, boxH).stroke("#bbbbbb");

    // Côté salarié : nom + date de soumission (pas de signature)
    doc.font("Helvetica").fontSize(9).fillColor(NOIR)
       .text(`Fait à Sainte-Suzanne, le ${frDateHeure(d.cree_le)}`, M + 6, y + 30, { width: colW - 12 });
    doc.text(`Nom et prénom : ${d.profiles.nom_complet}`, M + 6, y + 50, { width: colW - 12 });

    // Côté employeur : décision cochée + nom approbateur + date de décision
    const xE = M + colW + 6;
    doc.font("Helvetica").fontSize(10).fillColor(NOIR).text("Décision :", xE, y + 30);
    caseACocher(xE + 52, y + 31, valide);
    doc.text("Accordé", xE + 66, y + 30);
    caseACocher(xE + 120, y + 31, !valide);
    doc.text("Refusé", xE + 134, y + 30);
    if (!valide) {
      doc.fontSize(9).text(`Motif du refus : ${d.motif_refus ?? ""}`, xE, y + 48, { width: colW - 12 });
    }
    const yBas = valide ? y + 55 : y + 78;
    doc.fontSize(9)
       .text(`Décision rendue le ${d.resolu_le ? frDateHeure(d.resolu_le) : "—"}`, xE, yBas, { width: colW - 12 });
    doc.text(`Nom et prénom : ${approbateur?.nom ?? ""}`, xE, yBas + 14, { width: colW - 12 });

    y = boxTop + 22 + boxH + 20;

    // ── Rappel des règles ──
    doc.moveTo(M, y).lineTo(M + W, y).strokeColor("#bbbbbb").lineWidth(0.5).stroke();
    y += 8;
    doc.fillColor(NOIR).font("Helvetica-Bold").fontSize(9).text("Rappel des règles applicables (Code du travail)", M, y);
    y += 14;
    const regles = [
      "Acquisition : 2,5 jours ouvrables par mois de travail effectif, soit 30 jours ouvrables (5 semaines) par an (art. L3141-3).",
      "Période de prise : entre le 1er mai et le 31 octobre, sauf accord ou usage différent (art. L3141-13).",
      "Congé principal : au moins 12 jours ouvrables continus et au maximum 24 jours ouvrables (art. L3141-17 et s.).",
      "L'ordre des départs est fixé par l'employeur après avis du CSE le cas échéant (art. L3141-15 et s.).",
      "La demande doit être déposée dans un délai raisonnable ; la réponse de l'employeur doit être notifiée avant le départ.",
    ];
    doc.font("Helvetica").fontSize(8).fillColor("#333");
    for (const r of regles) {
      doc.text("• " + r, M, y, { width: W });
      y = doc.y + 3;
    }

    doc.end();
  });
}
