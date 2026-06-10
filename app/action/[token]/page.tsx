"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function ActionPage() {
  const { token } = useParams();
  const [motifRefus, setMotifRefus] = useState("");
  const [etat, setEtat] = useState("choix");
  const [resultat, setResultat] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function agir(decision) {
    if (decision === "refusee" && !motifRefus.trim()) {
      setResultat("Merci d'indiquer un motif de refus.");
      return;
    }
    setEnCours(true);
    const res = await fetch("/api/action", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, decision, motif_refus: motifRefus }),
    });
    const j = await res.json();
    setEnCours(false);
    setEtat("fini");
    if (j.deja_traitee) {
      const fr = (s) => {
        if (!s) return "";
        const d = new Date(s);
        const p = (n) => String(n).padStart(2, "0");
        return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
      };
      const statutTxt = j.statut === "validee" ? "Validé"
        : j.statut === "refusee" ? "Refusé"
        : j.statut === "annulee" ? "Annulé" : j.statut;
      let m = "Cette demande a déjà été traitée";
      if (j.resolu_le) m += ` le ${fr(j.resolu_le)}`;
      if (j.valideur) m += ` par ${j.valideur}`;
      m += `. Statut actuel : ${statutTxt}.`;
      if (j.statut === "refusee" && j.motif_refus) m += ` Motif du refus : ${j.motif_refus}`;
      setResultat(m);
    }
    else if (j.ok && decision === "validee") setResultat("Demande validée ✅. Les destinataires ont été notifiés par mail.");
    else if (j.ok) setResultat("Demande refusée. Les destinataires ont été notifiés par mail.");
    else setResultat("Erreur : " + (j.error ?? "inconnue"));
  }

  const stBtn = { display: "block", width: "100%", padding: 12, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 15, margin: "10px 0" };

  return (
    <div style={{ maxWidth: 460, margin: "60px auto", background: "#fff", padding: 28, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
      <h1 style={{ fontSize: 21 }}>Traitement d'une demande de congés</h1>
      {etat === "choix" && (
        <>
          <p style={{ color: "#555" }}>Une seule approbation suffit. Choisissez :</p>
          <button style={{ ...stBtn, background: "#16a34a" }} disabled={enCours} onClick={() => agir("validee")}>Valider la demande</button>
          <button style={{ ...stBtn, background: "#dc2626" }} disabled={enCours} onClick={() => setEtat("refus")}>Refuser la demande</button>
        </>
      )}
      {etat === "refus" && (
        <>
          <p>Indiquez le motif du refus :</p>
          <textarea style={{ display: "block", width: "100%", padding: 9, margin: "8px 0", borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box", minHeight: 80 }} value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} />
          <button style={{ ...stBtn, background: "#dc2626" }} disabled={enCours} onClick={() => agir("refusee")}>Confirmer le refus</button>
          <button style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 14 }} onClick={() => setEtat("choix")}>Retour</button>
        </>
      )}
      {etat === "fini" && <p style={{ fontSize: 16 }}>{resultat}</p>}
      {etat !== "fini" && resultat && <p style={{ color: "#dc2626" }}>{resultat}</p>}
    </div>
  );
}
