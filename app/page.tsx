// app/page.tsx
"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { calculerNbJoursCases, calculerDateRepriseCases, validerDemande, SaisieDemi } from "../lib/dateConges";

function frDate(s: string): string {
  if (!s) return "—";
  const [a, m, j] = s.split("-");
  if (!a || !m || !j) return s;
  return `${j}-${m}-${a}`;
}

export default function Accueil() {
  const [user, setUser] = useState<any>(null);
  const [profil, setProfil] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);
  const [demandes, setDemandes] = useState<any[]>([]);
  const [soldes, setSoldes] = useState<any[]>([]);
  const [form, setForm] = useState({
    type_conge_id: "", date_debut: "", date_fin: "", motif: "",
    debutMatin: true, debutAprem: true, finMatin: true, finAprem: true,
  });
  const [msg, setMsg] = useState("");
  const [assist, setAssist] = useState({ objet: "", message: "" });
  const [msgAssist, setMsgAssist] = useState("");
  const [annulId, setAnnulId] = useState<string | null>(null);
  const [motifAnnul, setMotifAnnul] = useState("");
  const [msgAnnul, setMsgAnnul] = useState("");

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUser(data.user);
      charger(data.user.id);
      getSupabase().from("profiles").select("nom_complet,poste").eq("id", data.user.id).single()
        .then(({ data: p }) => setProfil(p));
      getSupabase().from("soldes_lisibles").select("*").eq("salarie_id", data.user.id)
        .then(({ data: s }) => setSoldes(s ?? []));
    });
    getSupabase().from("types_conges").select("*").then(({ data }) => setTypes(data ?? []));
  }, []);

  async function charger(uid: string) {
    const { data } = await getSupabase()
      .from("demandes").select("*, types_conges(libelle)")
      .eq("salarie_id", uid).order("cree_le", { ascending: false });
    setDemandes(data ?? []);
  }

  const saisie: SaisieDemi = {
    debutMatin: form.debutMatin, debutAprem: form.debutAprem,
    finMatin: form.finMatin, finAprem: form.finAprem,
  };
  const erreurValidation = (form.date_debut && form.date_fin)
    ? validerDemande(form.date_debut, form.date_fin, saisie) : null;
  const nbJours = (form.date_debut && form.date_fin && !erreurValidation)
    ? calculerNbJoursCases(form.date_debut, form.date_fin, saisie) : 0;
  const dateReprise = (form.date_fin && !erreurValidation)
    ? calculerDateRepriseCases(form.date_fin, saisie) : "";

  const codeChoisi = types.find((t) => String(t.id) === form.type_conge_id)?.code;
  const soldeType = codeChoisi ? soldes.find((s) => s.code_type === codeChoisi) : null;
  const depasseSolde = soldeType && nbJours > Number(soldeType.solde_theorique);

  async function envoyer() {
    setMsg("");
    if (!form.type_conge_id) { setMsg("Merci de choisir un type de congé."); return; }
    const err = validerDemande(form.date_debut, form.date_fin, saisie);
    if (err) { setMsg(err); return; }
    if (nbJours <= 0) { setMsg("La durée calculée est nulle, vérifiez votre saisie."); return; }
    if (depasseSolde) {
      setMsg(`Solde insuffisant : vous demandez ${nbJours} jour(s) mais votre solde théorique de "${soldeType.type_conge}" est de ${soldeType.solde_theorique} jour(s).`);
      return;
    }

    const res = await fetch("/api/demandes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salarie_id: user.id, type_conge_id: Number(form.type_conge_id),
        date_debut: form.date_debut,
        moment_debut: form.debutMatin ? "journee" : "apresmidi",
        date_fin: form.date_fin,
        moment_fin: form.finAprem ? "journee" : "matin",
        nb_jours: nbJours, date_reprise: dateReprise, motif: form.motif,
      }),
    });
    const j = await res.json();
    if (j.ok) {
      setMsg("Demande envoyée ✅");
      charger(user.id);
      getSupabase().from("soldes_lisibles").select("*").eq("salarie_id", user.id)
        .then(({ data: s }) => setSoldes(s ?? []));
      setForm({ type_conge_id: "", date_debut: "", date_fin: "", motif: "",
        debutMatin: true, debutAprem: true, finMatin: true, finAprem: true });
    } else setMsg("Erreur : " + j.error);
  }

  async function envoyerAssistance() {
    setMsgAssist("");
    if (!assist.objet.trim() || !assist.message.trim()) {
      setMsgAssist("Merci de remplir l'objet et le message."); return;
    }
    const res = await fetch("/api/assistance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salarie_id: user.id, objet: assist.objet, message: assist.message }),
    });
    const j = await res.json();
    if (j.ok) { setMsgAssist("Message envoyé ✅"); setAssist({ objet: "", message: "" }); }
    else setMsgAssist("Erreur : " + j.error);
  }

  async function annuler(demande_id: string) {
    setMsgAnnul("");
    if (!motifAnnul.trim()) { setMsgAnnul("Merci d'indiquer un motif d'annulation."); return; }
    const res = await fetch("/api/annuler", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demande_id, salarie_id: user.id, motif_annulation: motifAnnul }),
    });
    const j = await res.json();
    if (j.ok) {
      setAnnulId(null); setMotifAnnul("");
      charger(user.id);
      getSupabase().from("soldes_lisibles").select("*").eq("salarie_id", user.id)
        .then(({ data: s }) => setSoldes(s ?? []));
    } else setMsgAnnul("Erreur : " + j.error);
  }

  function estAnnulable(d: any): boolean {
    if (d.statut !== "en_attente" && d.statut !== "validee") return false;
    const debut = new Date(d.date_debut + "T00:00:00");
    const limite = new Date(debut.getTime() - 24 * 60 * 60 * 1000);
    return new Date() <= limite;
  }

  const badge = (s: string) => ({
    en_attente: { t: "En attente", c: "#b45309", b: "#fef3c7" },
    validee: { t: "Validée", c: "#15803d", b: "#dcfce7" },
    refusee: { t: "Refusée", c: "#b91c1c", b: "#fee2e2" },
    annulee: { t: "Annulée", c: "#6b7280", b: "#f3f4f6" },
  } as any)[s];

  if (!user) return <p style={{ padding: 40 }}>Chargement…</p>;

  const Coche = ({ checked, onChange, label }: any) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 14, fontSize: 14, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 16, width: "100%", boxSizing: "border-box", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 20, lineHeight: 1.3 }}>
              Mes demandes de congés<br />
              <span style={{ fontSize: 15, color: "#555" }}>Salarié Paroisse Notre Dame du Bon Secours</span>
            </h1>
            {profil && (
              <div style={{ background: "#eff6ff", padding: "8px 12px", borderRadius: 6, marginTop: 6, fontSize: 14 }}>
                Connecté : <b>{profil.nom_complet}</b>{profil.poste ? ` — ${profil.poste}` : ""}
              </div>
            )}
          </div>
          <img src="/logo.png" alt="Logo paroisse" style={{ height: 70 }} />
        </div>

        <div style={{ textAlign: "right", margin: "8px 0" }}>
          <button style={lien} onClick={() => getSupabase().auth.signOut().then(() => window.location.href = "/login")}>
            Déconnexion</button>
        </div>

        {soldes.length > 0 && (
          <div style={carte}>
            <h2 style={{ fontSize: 17 }}>Mes compteurs de congés</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#eff3f8", textAlign: "left" }}>
                    <th style={th}>Type</th><th style={th}>Acquis</th><th style={th}>Pris</th>
                    <th style={th}>En cours</th><th style={th}>Solde théorique</th><th style={th}>Solde réel</th>
                  </tr>
                </thead>
                <tbody>
                  {soldes.map((s, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={td}>{s.type_conge}</td>
                      <td style={td}>{s.acquis}</td>
                      <td style={td}>{s.pris}</td>
                      <td style={td}>{s.en_cours}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{s.solde_theorique}</td>
                      <td style={td}>{s.solde_reel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={carte}>
          <h2 style={{ fontSize: 17 }}>Nouvelle demande</h2>
          <select style={inp} value={form.type_conge_id}
            onChange={(e) => setForm({ ...form, type_conge_id: e.target.value })}>
            <option value="">— Type de congé —</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
          </select>

          <label style={lbl}>Date de début</label>
          <input style={inp} type="date" value={form.date_debut}
            onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
          <div style={{ margin: "0 0 12px" }}>
            <Coche checked={form.debutMatin} label="Matin"
              onChange={(v: boolean) => setForm({ ...form, debutMatin: v })} />
            <Coche checked={form.debutAprem} label="Après-midi"
              onChange={(v: boolean) => setForm({ ...form, debutAprem: v })} />
            <span style={{ fontSize: 12, color: "#888" }}>(cochez les deux = journée entière)</span>
          </div>

          <label style={lbl}>Date de fin</label>
          <input style={inp} type="date" value={form.date_fin}
            onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
          <div style={{ margin: "0 0 12px" }}>
            <Coche checked={form.finMatin} label="Matin"
              onChange={(v: boolean) => setForm({ ...form, finMatin: v })} />
            <Coche checked={form.finAprem} label="Après-midi"
              onChange={(v: boolean) => setForm({ ...form, finAprem: v })} />
            <span style={{ fontSize: 12, color: "#888" }}>(cochez les deux = journée entière)</span>
          </div>

          {erreurValidation && (
            <div style={errBox}>{erreurValidation}</div>
          )}
          {(form.date_debut && form.date_fin && !erreurValidation) && (
            <div style={{ background: "#eff6ff", padding: 10, borderRadius: 6, margin: "6px 0", fontSize: 14 }}>
              <b>Nombre de jours :</b> {nbJours} &nbsp;·&nbsp;
              <b>Reprise du travail le :</b> {frDate(dateReprise)}
              {soldeType && (
                <div style={{ marginTop: 4, color: depasseSolde ? "#b91c1c" : "#555" }}>
                  Solde théorique {soldeType.type_conge} : {soldeType.solde_theorique} j
                </div>
              )}
            </div>
          )}
          {depasseSolde && (
            <div style={errBox}>
              Solde insuffisant : {nbJours} j demandés &gt; {soldeType.solde_theorique} j disponibles.
            </div>
          )}

          <label style={lbl}>Motif (facultatif)</label>
          <textarea style={inp} value={form.motif}
            onChange={(e) => setForm({ ...form, motif: e.target.value })} />
          <button style={{ ...btn, opacity: (erreurValidation || depasseSolde) ? 0.5 : 1 }}
            disabled={!!erreurValidation || !!depasseSolde} onClick={envoyer}>Envoyer la demande</button>
          {msg && <p>{msg}</p>}
        </div>

        <div style={carte}>
          <h2 style={{ fontSize: 17 }}>Historique</h2>
          {demandes.length === 0 && <p style={{ color: "#777" }}>Aucune demande pour l'instant.</p>}
          {demandes.map((d) => {
            const bg = badge(d.statut);
            return (
              <div key={d.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <b>{d.types_conges?.libelle}</b><br />
                    <span style={{ color: "#555", fontSize: 14 }}>
                      Du {frDate(d.date_debut)} au {frDate(d.date_fin)} · {d.nb_jours} j · reprise {frDate(d.date_reprise)}</span>
                    {d.statut === "refusee" && d.motif_refus &&
                      <div style={{ color: "#b91c1c", fontSize: 13 }}>Motif refus : {d.motif_refus}</div>}
                    {d.statut === "annulee" && d.motif_annulation &&
                      <div style={{ color: "#6b7280", fontSize: 13 }}>Motif annulation : {d.motif_annulation}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ background: bg.b, color: bg.c, padding: "4px 10px",
                      borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{bg.t}</span>
                    {estAnnulable(d) && annulId !== d.id && (
                      <div><button style={{ ...lien, color: "#b45309", marginTop: 6 }}
                        onClick={() => { setAnnulId(d.id); setMotifAnnul(""); setMsgAnnul(""); }}>
                        Annuler</button></div>
                    )}
                  </div>
                </div>
                {annulId === d.id && (
                  <div style={{ background: "#fff7ed", padding: 10, borderRadius: 6, marginTop: 8 }}>
                    <label style={lbl}>Motif de l'annulation (obligatoire)</label>
                    <textarea style={inp} value={motifAnnul}
                      onChange={(e) => setMotifAnnul(e.target.value)} />
                    <button style={{ ...btn, background: "#b45309" }}
                      onClick={() => annuler(d.id)}>Confirmer l'annulation</button>
                    <button style={{ ...lien, marginLeft: 10 }}
                      onClick={() => { setAnnulId(null); setMsgAnnul(""); }}>Retour</button>
                    {msgAnnul && <p style={{ color: "#b91c1c", fontSize: 13 }}>{msgAnnul}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={carte}>
          <h2 style={{ fontSize: 17 }}>Contact d'assistance</h2>
          <p style={{ color: "#666", fontSize: 14 }}>Une question, un souci (mot de passe, erreur…) ? Écrivez-nous.</p>
          <label style={lbl}>Objet</label>
          <input style={inp} value={assist.objet}
            onChange={(e) => setAssist({ ...assist, objet: e.target.value })} />
          <label style={lbl}>Message</label>
          <textarea style={{ ...inp, minHeight: 90 }} value={assist.message}
            onChange={(e) => setAssist({ ...assist, message: e.target.value })} />
          <button style={btn} onClick={envoyerAssistance}>Envoyer le message</button>
          {msgAssist && <p>{msgAssist}</p>}
        </div>
      </div>

      <footer style={pied}>Alexandre FAMARE © 2026</footer>
    </div>
  );
}

const carte: React.CSSProperties = { background: "#fff", padding: 20, borderRadius: 12, margin: "16px 0", boxShadow: "0 1px 4px rgba(0,0,0,.08)" };
const inp: React.CSSProperties = { display: "block", width: "100%", padding: 9, margin: "4px 0 6px", borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 13, color: "#555" };
const btn: React.CSSProperties = { padding: "10px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 15 };
const lien: React.CSSProperties = { background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 14 };
const ligneDemande: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" };
const pied: React.CSSProperties = { textAlign: "center", padding: 14, fontSize: 12, color: "#999" };
const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "6px 8px" };
const errBox: React.CSSProperties = { background: "#fee2e2", color: "#b91c1c", padding: 10, borderRadius: 6, margin: "6px 0", fontSize: 14 };
