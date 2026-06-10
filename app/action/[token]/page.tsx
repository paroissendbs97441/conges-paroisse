// app/action/[token]/page.tsx
"use client";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function ActionPage() {
  const { token } = useParams<{ token: string }>();
  const [motifRefus, setMotifRefus] = useState("");
  const [etat, setEtat] = useState<"choix" | "refus" | "fini">("choix");
  const [resultat, setResultat] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function agir(decision: "validee" | "refusee") {
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
    if (j.deja_traitee) setResultat("Cette demande a déjà été traitée par un autre approbateur.");
    else if (j.ok && decision === "validee") setResultat("Demande validée ✅. Les destinataires ont été notifiés par mail.");
    else if (j.ok) setResultat("Demande refusée. Les destinataires ont été notifiés par mail.");
    else setResultat("Erreur : " + (j.error ?? "inconnue"));
  }

  return (
    <div style={card}>
      <h1 style={{ fontSize: 21 }}>Traitement d'une demande de congés</h1>

      {etat === "choix" && (
        <>
          <p style={{ color: "#555" }}>Une seule approbation suffit. Choisissez :</p>
          <button style={{ ...btn, background: "#16a34a" }} disabled={enCours}
            onClick={() => agir("validee")}>Valider la demande</button>
          <button style={{ ...btn, background: "#dc2626" }} disabled={enCours}
            onClick={() => setEtat("refus")}>Refuser la demande</button>
        </>
      )}

      {etat === "refus" && (
        <>
          <p>Indiquez le motif du refus :</p>
          <textarea style={inp} value={motifRefus}
            onChange={(e) => setMotifRefus(e.target.value)} />
          <button style={{ ...btn, background: "#dc2626" }} disabled={enCours}
            onClick={() => agir("refusee")}>Confirmer le refus</button>
          <button style={lien} onClick={() => setEtat("choix")}>Retour</button>
        </>
      )}

      {etat === "fini" && <p style={{ fontSize: 16 }}>{resultat}</p>}
      {etat !== "fini" && resultat && <p style={{ color: "#dc2626" }}>{resultat}</p>}
    </div>
  );
}

const card: React.CSSProperties = { maxWidth: 460, margin: "60px auto", background: "#fff", padding: 28, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.1)" };
const btn: React.CSSProperties = { display: "block", width: "100%", padding: 12, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 15, margin: "10px 0" };
const inp: React.CSSProperties = { display: "block", width: "100%", padding: 9, margin: "8px 0", borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box", minHeight: 80 };
const lien: React.CSSProperties = { background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 14 };
