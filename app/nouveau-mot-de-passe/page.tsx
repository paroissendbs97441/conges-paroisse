// app/nouveau-mot-de-passe/page.tsx
"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";

export default function NouveauMotDePasse() {
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  async function valider() {
    setMsg("");
    if (mdp.length < 6) { setMsg("Le mot de passe doit faire au moins 6 caractères."); return; }
    if (mdp !== mdp2) { setMsg("Les deux mots de passe ne correspondent pas."); return; }
    const { error } = await getSupabase().auth.updateUser({ password: mdp });
    if (error) {
      setMsg("Erreur : " + error.message + " (le lien est peut-être expiré, refaites une demande).");
    } else {
      setOk(true);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: 16 }}>
        <img src="/logo.png" alt="Logo paroisse" style={{ height: 70 }} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={card}>
          <h1 style={{ fontSize: 20 }}>Nouveau mot de passe</h1>
          {!ok ? (
            <>
              <p style={{ color: "#666" }}>Choisissez votre nouveau mot de passe.</p>
              <input style={input} type="password" placeholder="Nouveau mot de passe" value={mdp}
                onChange={(e) => setMdp(e.target.value)} />
              <input style={input} type="password" placeholder="Confirmez le mot de passe" value={mdp2}
                onChange={(e) => setMdp2(e.target.value)} />
              <button style={btn} onClick={valider}>Enregistrer</button>
              {msg && <p style={{ color: "#dc2626", fontSize: 14 }}>{msg}</p>}
            </>
          ) : (
            <>
              <p style={{ color: "#16a34a" }}>✅ Mot de passe modifié avec succès.</p>
              <button style={btn} onClick={() => window.location.href = "/login"}>
                Aller à la connexion</button>
            </>
          )}
        </div>
      </div>

      <footer style={pied}>Alexandre FAMARE © 2026</footer>
    </div>
  );
}

const card: React.CSSProperties = { maxWidth: 400, margin: "40px auto", background: "#fff", padding: 28, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.1)" };
const input: React.CSSProperties = { display: "block", width: "100%", padding: 10, margin: "8px 0", borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" };
const btn: React.CSSProperties = { width: "100%", padding: 11, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 15, marginTop: 6 };
const pied: React.CSSProperties = { textAlign: "center", padding: 14, fontSize: 12, color: "#999" };
