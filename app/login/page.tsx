// app/login/page.tsx
"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<"login" | "oubli" | "assist">("login");
  const [msgOubli, setMsgOubli] = useState("");
  const [assist, setAssist] = useState({ nom: "", email: "", objet: "", message: "" });
  const [msgAssist, setMsgAssist] = useState("");

  async function seConnecter() {
    setMsg("");
    const { error } = await getSupabase().auth.signInWithPassword({ email, password: mdp });
    if (error) setMsg("Identifiants incorrects.");
    else window.location.href = "/";
  }

  async function envoyerReinit() {
    setMsgOubli("");
    if (!email.trim()) { setMsgOubli("Saisissez votre email d'abord."); return; }
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${BASE_URL}/nouveau-mot-de-passe`,
    });
    if (error) setMsgOubli("Erreur : " + error.message);
    else setMsgOubli("Si cet email existe, un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos spams.");
  }

  async function envoyerAssist() {
    setMsgAssist("");
    if (!assist.nom.trim() || !assist.email.trim() || !assist.objet.trim() || !assist.message.trim()) {
      setMsgAssist("Merci de remplir tous les champs."); return;
    }
    const res = await fetch("/api/assistance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: assist.nom, email: assist.email, objet: assist.objet, message: assist.message }),
    });
    const j = await res.json();
    if (j.ok) { setMsgAssist("Message envoyé ✅"); setAssist({ nom: "", email: "", objet: "", message: "" }); }
    else setMsgAssist("Erreur : " + j.error);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: 16 }}>
        <img src="/logo.png" alt="Logo paroisse" style={{ height: 70 }} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={card}>
          <h1 style={{ fontSize: 20, lineHeight: 1.3 }}>
            Intranet Espace Congés<br />Paroisse Notre Dame du Bon Secours
          </h1>

          {mode === "login" && (
            <>
              <p style={{ color: "#666" }}>Connectez-vous avec votre email et mot de passe.</p>
              <input style={input} placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} />
              <input style={input} type="password" placeholder="Mot de passe" value={mdp}
                onChange={(e) => setMdp(e.target.value)} />
              <button style={btn} onClick={seConnecter}>Se connecter</button>
              {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
              <p style={{ marginTop: 12 }}>
                <button style={lien} onClick={() => { setMode("oubli"); setMsgOubli(""); }}>
                  Mot de passe oublié ?</button>
              </p>
              <p style={{ marginTop: 4 }}>
                <button style={lien} onClick={() => { setMode("assist"); setMsgAssist(""); }}>
                  Besoin d'aide ? Contacter l'assistance</button>
              </p>
            </>
          )}

          {mode === "oubli" && (
            <>
              <p style={{ color: "#666" }}>Saisissez votre email pour recevoir un lien de réinitialisation.</p>
              <input style={input} placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} />
              <button style={btn} onClick={envoyerReinit}>Envoyer le lien</button>
              {msgOubli && <p style={{ color: "#16a34a", fontSize: 14 }}>{msgOubli}</p>}
              <p style={{ marginTop: 12 }}>
                <button style={lien} onClick={() => { setMode("login"); setMsg(""); }}>
                  ← Retour à la connexion</button>
              </p>
            </>
          )}

          {mode === "assist" && (
            <>
              <p style={{ color: "#666" }}>Décrivez votre problème, l'assistance vous répondra.</p>
              <input style={input} placeholder="Votre nom" value={assist.nom}
                onChange={(e) => setAssist({ ...assist, nom: e.target.value })} />
              <input style={input} placeholder="Votre email" value={assist.email}
                onChange={(e) => setAssist({ ...assist, email: e.target.value })} />
              <input style={input} placeholder="Objet" value={assist.objet}
                onChange={(e) => setAssist({ ...assist, objet: e.target.value })} />
              <textarea style={{ ...input, minHeight: 90 }} placeholder="Votre message" value={assist.message}
                onChange={(e) => setAssist({ ...assist, message: e.target.value })} />
              <button style={btn} onClick={envoyerAssist}>Envoyer le message</button>
              {msgAssist && <p style={{ fontSize: 14, color: msgAssist.startsWith("Erreur") ? "#dc2626" : "#16a34a" }}>{msgAssist}</p>}
              <p style={{ marginTop: 12 }}>
                <button style={lien} onClick={() => { setMode("login"); setMsgAssist(""); }}>
                  ← Retour à la connexion</button>
              </p>
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
const lien: React.CSSProperties = { background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 14, padding: 0 };
const pied: React.CSSProperties = { textAlign: "center", padding: 14, fontSize: 12, color: "#999" };
