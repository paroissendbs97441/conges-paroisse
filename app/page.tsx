// app/page.tsx — Espace demande de congés — fenêtre d'app macOS Liquid Glass
"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { calculerNbJoursCases, calculerDateRepriseCases, validerDemande, SaisieDemi, definirJoursFeries, definirModeConges } from "../lib/dateConges";

const URL_INTRANET = "https://intranet-ndbs.vercel.app";

function frDate(s: string): string {
  if (!s) return "—";
  const [a, m, j] = s.split("-");
  if (!a || !m || !j) return s;
  return `${j}-${m}-${a}`;
}

function libelleRole(role: string): string {
  return ({
    salarie: "Salarié", secretaire: "Secrétaire", benevole: "Bénévole",
    comptable: "Comptable CPAE", cpae: "Membre CPAE", cure: "Curé",
    vicaire: "Vicaire", diacre: "Diacre", admin: "Administrateur", invite: "Invité",
  } as any)[role] ?? role;
}

export default function Accueil() {
  const [user, setUser] = useState<any>(null);
  const [profil, setProfil] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);
  const [demandes, setDemandes] = useState<any[]>([]);
  const [soldes, setSoldes] = useState<any[]>([]);
  const [onglet, setOnglet] = useState<"demandes" | "historique" | "compte">("demandes");
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
  const [mdpForm, setMdpForm] = useState({ mdp: "", mdp2: "" });
  const [msgMdp, setMsgMdp] = useState("");
  const [filtreAnnee, setFiltreAnnee] = useState("");
  const [filtreMois, setFiltreMois] = useState("");
  const [horloge, setHorloge] = useState("");
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    async function initialiser() {
      if (typeof window !== "undefined" && window.location.hash.includes("sso_at")) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const at = params.get("sso_at");
        const rt = params.get("sso_rt");
        if (at && rt) {
          await getSupabase().auth.setSession({ access_token: at, refresh_token: rt });
          window.history.replaceState(null, "", window.location.pathname);
        }
      }

      const { data } = await getSupabase().auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUser(data.user);
      charger(data.user.id);
      getSupabase().from("profiles").select("nom_complet,poste,roles,mode_conges").eq("id", data.user.id).single()
        .then(({ data: p }) => { setProfil(p); definirModeConges(p?.mode_conges ?? "ouvres"); });
      getSupabase().from("soldes_lisibles").select("*").eq("salarie_id", data.user.id)
        .then(({ data: s }) => setSoldes(s ?? []));
      getSupabase().from("types_conges").select("*").then(({ data }) => setTypes(data ?? []));
      getSupabase().from("jours_feries").select("date_ferie").then(({ data }) => {
        definirJoursFeries((data ?? []).map((f: any) => f.date_ferie));
      });
    }
    initialiser();
  }, []);

  useEffect(() => {
    const maj = () => {
      const d = new Date();
      const jours = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
      const mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
      setHorloge(`${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]}  ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    maj();
    const id = setInterval(maj, 10000);
    return () => clearInterval(id);
  }, []);

  async function charger(uid: string) {
    const { data } = await getSupabase()
      .from("demandes").select("*, types_conges(libelle)")
      .eq("salarie_id", uid).order("cree_le", { ascending: false });
    setDemandes(data ?? []);
  }

  function fermer() { window.location.href = URL_INTRANET; }

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

  const ymdAujourdhui = new Date().toISOString().slice(0, 10);
  const estPassee = (d: any) => d.date_fin < ymdAujourdhui;
  const actives = demandes.filter((d) => d.statut !== "annulee" && !estPassee(d));
  const historiqueBrut = demandes.filter((d) => d.statut === "annulee" || estPassee(d));

  const anneesDispo = Array.from(
    new Set(historiqueBrut.map((d) => (d.cree_le || "").slice(0, 4)).filter(Boolean))
  ).sort().reverse();

  const moisNoms = ["01 - Janvier", "02 - Février", "03 - Mars", "04 - Avril", "05 - Mai", "06 - Juin",
    "07 - Juillet", "08 - Août", "09 - Septembre", "10 - Octobre", "11 - Novembre", "12 - Décembre"];

  const historique = historiqueBrut
    .filter((d) => {
      const annee = (d.cree_le || "").slice(0, 4);
      const mois = (d.cree_le || "").slice(5, 7);
      if (filtreAnnee && annee !== filtreAnnee) return false;
      if (filtreMois && mois !== filtreMois) return false;
      return true;
    })
    .sort((a, b) => (b.cree_le || "").localeCompare(a.cree_le || ""));

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

  async function changerMotDePasse() {
    setMsgMdp("");
    if (mdpForm.mdp.length < 6) { setMsgMdp("Le mot de passe doit faire au moins 6 caractères."); return; }
    if (mdpForm.mdp !== mdpForm.mdp2) { setMsgMdp("Les deux mots de passe ne correspondent pas."); return; }
    const { error } = await getSupabase().auth.updateUser({ password: mdpForm.mdp });
    if (error) setMsgMdp("Erreur : " + error.message);
    else { setMsgMdp("Mot de passe modifié ✅"); setMdpForm({ mdp: "", mdp2: "" }); }
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
    en_attente: { t: "En attente", c: "#8a5a08", b: "rgba(214,158,46,.18)", bd: "rgba(214,158,46,.42)" },
    validee: { t: "Validée", c: "#1b6b44", b: "rgba(52,168,108,.16)", bd: "rgba(52,168,108,.4)" },
    refusee: { t: "Refusée", c: "#b3261e", b: "rgba(214,69,62,.14)", bd: "rgba(214,69,62,.4)" },
    annulee: { t: "Annulée", c: "#5a5a62", b: "rgba(120,120,128,.16)", bd: "rgba(120,120,128,.34)" },
  } as any)[s];

  if (!user) return (
    <div style={pageWrap}><div style={wall} />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", paddingTop: 100, color: "#3a3a40", fontSize: 15 }}>Chargement…</div>
    </div>
  );

  const Coche = ({ checked, onChange, label }: any) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: 14, fontSize: 14, cursor: "pointer", color: "#3a3a40" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  const ligneDemandeAffichage = (d: any, avecAnnulation: boolean) => {
    const bg = badge(d.statut);
    return (
      <div key={d.id} style={{ padding: "12px 0", borderBottom: "1px solid rgba(60,60,67,.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <b style={{ color: "#1d1d1f" }}>{d.types_conges?.libelle}</b><br />
            <span style={{ color: "#5a5a62", fontSize: 14 }}>
              Du {frDate(d.date_debut)} au {frDate(d.date_fin)} · {d.nb_jours} j · reprise {frDate(d.date_reprise)}</span>
            {d.statut === "refusee" && d.motif_refus &&
              <div style={{ color: "#b3261e", fontSize: 13 }}>Motif refus : {d.motif_refus}</div>}
            {d.statut === "annulee" && d.motif_annulation &&
              <div style={{ color: "#5a5a62", fontSize: 13 }}>Motif annulation : {d.motif_annulation}</div>}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ background: bg.b, color: bg.c, border: `1px solid ${bg.bd}`, padding: "4px 11px",
              borderRadius: 999, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{bg.t}</span>
            {avecAnnulation && estAnnulable(d) && annulId !== d.id && (
              <div><button style={{ ...lien, color: "#9a5b0e", marginTop: 6 }}
                onClick={() => { setAnnulId(d.id); setMotifAnnul(""); setMsgAnnul(""); }}>
                Annuler</button></div>
            )}
          </div>
        </div>
        {avecAnnulation && annulId === d.id && (
          <div style={{ background: "rgba(214,158,46,.1)", border: "1px solid rgba(214,158,46,.3)", padding: 12, borderRadius: 12, marginTop: 10 }}>
            <label style={lbl}>Motif de l'annulation (obligatoire)</label>
            <textarea style={inp} value={motifAnnul}
              onChange={(e) => setMotifAnnul(e.target.value)} />
            <button style={{ ...btn, background: "linear-gradient(180deg,#c98a2e,#a86f18)" }}
              onClick={() => annuler(d.id)}>Confirmer l'annulation</button>
            <button style={{ ...lien, marginLeft: 10 }}
              onClick={() => { setAnnulId(null); setMsgAnnul(""); }}>Retour</button>
            {msgAnnul && <p style={{ color: "#b3261e", fontSize: 13 }}>{msgAnnul}</p>}
          </div>
        )}
      </div>
    );
  };

  const ongletStyle = (actif: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "inherit",
    background: actif ? "rgba(255,255,255,.9)" : "transparent",
    color: actif ? "#1d1d1f" : "#5a5a62", borderRadius: 8, fontWeight: actif ? 600 : 500,
    boxShadow: actif ? "0 1px 4px rgba(60,70,110,.15)" : "none", transition: "background .15s",
  });

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={pageWrap}>
        <div style={wall} />

        {/* Barre de menu système */}
        <div style={menubar}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
            <img src="/logo.png" alt="" style={{ height: 17, width: 17, objectFit: "contain" }} /> Mes congés
          </span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            <a href={URL_INTRANET} style={menuLien}>⌂ Intranet</a>
            <button style={{ ...menuLien, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5 }}
              onClick={() => getSupabase().auth.signOut().then(() => window.location.href = "/login")}>Déconnexion</button>
            <span style={{ opacity: 0.9 }}>{horloge}</span>
          </span>
        </div>

        {/* Fenêtre d'application macOS */}
        <div style={{ ...fenetreWrap, maxWidth: zoom ? "100%" : 820, padding: zoom ? "12px 12px 50px" : "30px 20px 50px", transition: "max-width .3s ease, padding .3s ease" }}>
          <div style={fenetre}>
            {/* Title bar */}
            <div style={titleBar}>
              <span style={feux}>
                <i title="Fermer" onClick={fermer} style={{ ...feu, background: "#ff5f57", cursor: "pointer" }} />
                <i title="Retour à l'intranet" onClick={fermer} style={{ ...feu, background: "#febc2e", cursor: "pointer" }} />
                <i title="Plein écran" onClick={() => setZoom(!zoom)} style={{ ...feu, background: "#28c840", cursor: "pointer" }} />
              </span>
              <span style={titreFenetre}>Mes demandes de congés</span>
              <img src="/logo.png" alt="" style={{ marginLeft: "auto", height: 26, objectFit: "contain" }} />
            </div>

            {/* Contenu */}
            <div style={corps}>
              <div style={{ marginBottom: 4 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#1d1d1f", letterSpacing: "-.4px" }}>Mes demandes de congés</h1>
                <p style={{ fontSize: 14, color: "#5a5a62", margin: "3px 0 0" }}>Salarié — Paroisse Notre-Dame du Bon Secours</p>
              </div>

              {profil && (
                <div style={infoBox}>
                  Connecté : <b style={{ color: "#1d1d1f" }}>{profil.nom_complet}</b>{(profil.roles && profil.roles.length > 0) ? ` — ${profil.roles.map(libelleRole).join(", ")}` : ""}{(profil.roles && profil.roles.includes("salarie") && profil.poste) ? ` — ${profil.poste}` : ""}
                </div>
              )}

              {/* Segmented control (onglets) */}
              <div style={segmented}>
                <button style={ongletStyle(onglet === "demandes")} onClick={() => setOnglet("demandes")}>Mes demandes</button>
                <button style={ongletStyle(onglet === "historique")} onClick={() => setOnglet("historique")}>Historique</button>
                <button style={ongletStyle(onglet === "compte")} onClick={() => setOnglet("compte")}>Mon compte</button>
              </div>

              {onglet === "demandes" && (
                <>
                  {soldes.length > 0 && (
                    <div style={carte}>
                      <h2 style={h2}>Mes compteurs de congés</h2>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th style={{ ...th, borderRadius: "10px 0 0 10px", textAlign: "left" }}>Type</th><th style={th}>Acquis</th><th style={th}>Pris</th>
                              <th style={th}>En cours</th><th style={th}>Solde théo.</th><th style={{ ...th, borderRadius: "0 10px 10px 0" }}>Solde réel</th>
                            </tr>
                          </thead>
                          <tbody>
                            {soldes.map((s, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(60,60,67,.08)" }}>
                                <td style={td}>{s.type_conge}</td>
                                <td style={tdC}>{s.acquis}</td>
                                <td style={tdC}>{s.pris}</td>
                                <td style={tdC}>{s.en_cours}</td>
                                <td style={{ ...tdC, fontWeight: 700, color: "#1b6b44" }}>{s.solde_theorique}</td>
                                <td style={tdC}>{s.solde_reel}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={carte}>
                    <h2 style={h2}>Nouvelle demande</h2>
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
                      <span style={{ fontSize: 12, color: "#8a8a92" }}>(cochez les deux = journée entière)</span>
                    </div>

                    <label style={lbl}>Date de fin</label>
                    <input style={inp} type="date" value={form.date_fin}
                      onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
                    <div style={{ margin: "0 0 12px" }}>
                      <Coche checked={form.finMatin} label="Matin"
                        onChange={(v: boolean) => setForm({ ...form, finMatin: v })} />
                      <Coche checked={form.finAprem} label="Après-midi"
                        onChange={(v: boolean) => setForm({ ...form, finAprem: v })} />
                      <span style={{ fontSize: 12, color: "#8a8a92" }}>(cochez les deux = journée entière)</span>
                    </div>

                    {erreurValidation && (<div style={errBox}>{erreurValidation}</div>)}
                    {(form.date_debut && form.date_fin && !erreurValidation) && (
                      <div style={infoCalc}>
                        <b>Nombre de jours :</b> {nbJours} &nbsp;·&nbsp;
                        <b>Reprise du travail le :</b> {frDate(dateReprise)}
                        {soldeType && (
                          <div style={{ marginTop: 4, color: depasseSolde ? "#b3261e" : "#5a5a62" }}>
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
                    {msg && <p style={{ fontSize: 14, color: "#3a3a40" }}>{msg}</p>}
                  </div>

                  <div style={carte}>
                    <h2 style={h2}>Demandes en cours et à venir</h2>
                    {actives.length === 0 && <p style={{ color: "#8a8a92" }}>Aucune demande active.</p>}
                    {actives.map((d) => ligneDemandeAffichage(d, true))}
                  </div>

                  <div style={carte}>
                    <h2 style={h2}>Contact d'assistance</h2>
                    <p style={{ color: "#5a5a62", fontSize: 14 }}>Une question, un souci (mot de passe, erreur…) ? Écrivez-nous.</p>
                    <label style={lbl}>Objet</label>
                    <input style={inp} value={assist.objet}
                      onChange={(e) => setAssist({ ...assist, objet: e.target.value })} />
                    <label style={lbl}>Message</label>
                    <textarea style={{ ...inp, minHeight: 90 }} value={assist.message}
                      onChange={(e) => setAssist({ ...assist, message: e.target.value })} />
                    <button style={btn} onClick={envoyerAssistance}>Envoyer le message</button>
                    {msgAssist && <p style={{ fontSize: 14, color: "#3a3a40" }}>{msgAssist}</p>}
                  </div>
                </>
              )}

              {onglet === "historique" && (
                <div style={carte}>
                  <h2 style={h2}>Historique des congés</h2>
                  <p style={{ color: "#8a8a92", fontSize: 13 }}>Congés passés et demandes annulées, triés par date de demande (plus récente d'abord).</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 12px" }}>
                    <select style={{ ...inp, width: "auto", margin: 0 }} value={filtreAnnee}
                      onChange={(e) => setFiltreAnnee(e.target.value)}>
                      <option value="">Toutes les années</option>
                      {anneesDispo.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select style={{ ...inp, width: "auto", margin: 0 }} value={filtreMois}
                      onChange={(e) => setFiltreMois(e.target.value)}>
                      <option value="">Tous les mois</option>
                      {moisNoms.map((label, i) => {
                        const val = String(i + 1).padStart(2, "0");
                        return <option key={val} value={val}>{label}</option>;
                      })}
                    </select>
                    {(filtreAnnee || filtreMois) && (
                      <button style={lien} onClick={() => { setFiltreAnnee(""); setFiltreMois(""); }}>
                        Réinitialiser</button>
                    )}
                  </div>
                  {historique.length === 0 && <p style={{ color: "#8a8a92" }}>Aucun congé pour ce filtre.</p>}
                  {historique.map((d) => ligneDemandeAffichage(d, false))}
                </div>
              )}

              {onglet === "compte" && (
                <div style={carte}>
                  <h2 style={h2}>Changer mon mot de passe</h2>
                  <label style={lbl}>Nouveau mot de passe</label>
                  <input style={inp} type="password" value={mdpForm.mdp}
                    onChange={(e) => setMdpForm({ ...mdpForm, mdp: e.target.value })} />
                  <label style={lbl}>Confirmer le nouveau mot de passe</label>
                  <input style={inp} type="password" value={mdpForm.mdp2}
                    onChange={(e) => setMdpForm({ ...mdpForm, mdp2: e.target.value })} />
                  <button style={btn} onClick={changerMotDePasse}>Modifier le mot de passe</button>
                  {msgMdp && <p style={{ fontSize: 14, color: "#3a3a40" }}>{msgMdp}</p>}
                </div>
              )}
            </div>
          </div>

          <p style={pied}>Alexandre FAMARE © 2026</p>
        </div>
      </div>
    </>
  );
}

const pageWrap: React.CSSProperties = { position: "relative", minHeight: "100vh", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: "#1d1d1f", WebkitFontSmoothing: "antialiased" };
const wall: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 0,
  background: "radial-gradient(circle at 16% 16%, #cfe2cf 0%, rgba(207,226,207,0) 45%), radial-gradient(circle at 84% 14%, #dde7cc 0%, rgba(221,231,204,0) 48%), radial-gradient(circle at 82% 86%, #cfe0d8 0%, rgba(207,224,216,0) 46%), linear-gradient(160deg, #eaf0e7 0%, #e0e9dd 55%, #d7e2d4 100%)",
};
const menubar: React.CSSProperties = {
  position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 18,
  height: 28, padding: "0 16px", fontSize: 12.5, fontWeight: 500, color: "#2a2a30",
  background: "rgba(255,255,255,.5)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
  borderBottom: "1px solid rgba(255,255,255,.55)",
};
const menuLien: React.CSSProperties = { color: "#2a2a30", textDecoration: "none", fontWeight: 500 };
const fenetreWrap: React.CSSProperties = { position: "relative", zIndex: 1, maxWidth: 820, margin: "0 auto", padding: "30px 20px 50px", width: "100%", boxSizing: "border-box" };
const fenetre: React.CSSProperties = {
  borderRadius: 16, overflow: "hidden",
  background: "rgba(255,255,255,.5)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
  border: "1px solid rgba(255,255,255,.6)",
  boxShadow: "0 30px 80px rgba(50,70,50,.26), 0 4px 14px rgba(50,70,50,.14), inset 0 1px 0 rgba(255,255,255,.7)",
};
const titleBar: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 14, height: 46, padding: "0 16px",
  background: "rgba(255,255,255,.4)", borderBottom: "1px solid rgba(60,60,67,.1)",
};
const feux: React.CSSProperties = { display: "flex", gap: 8, flexShrink: 0 };
const feu: React.CSSProperties = { width: 12, height: 12, borderRadius: "50%", display: "inline-block", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.12)" };
const titreFenetre: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: "#3a3a40", whiteSpace: "nowrap" };
const corps: React.CSSProperties = { padding: "20px 22px", background: "rgba(255,255,255,.3)" };
const infoBox: React.CSSProperties = { background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.7)", padding: "9px 13px", borderRadius: 12, marginTop: 12, fontSize: 14, color: "#3a3a40" };
const segmented: React.CSSProperties = { display: "flex", gap: 4, margin: "16px 0", padding: 4, borderRadius: 12, background: "rgba(120,135,160,.16)", border: "1px solid rgba(255,255,255,.5)" };
const carte: React.CSSProperties = {
  background: "rgba(255,255,255,.6)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid rgba(255,255,255,.7)", borderRadius: 16, padding: 18, margin: "14px 0",
  boxShadow: "0 8px 26px rgba(50,70,50,.1), inset 0 1px 0 rgba(255,255,255,.7)",
};
const h2: React.CSSProperties = { fontSize: 16.5, fontWeight: 700, margin: "0 0 10px", color: "#1d1d1f" };
const inp: React.CSSProperties = { display: "block", width: "100%", padding: 10, margin: "4px 0 10px", borderRadius: 10, border: "1px solid rgba(60,60,67,.18)", boxSizing: "border-box", fontSize: 14, fontFamily: "inherit", background: "rgba(255,255,255,.7)", color: "#1d1d1f", outline: "none" };
const lbl: React.CSSProperties = { fontSize: 13, color: "#5a5a62", fontWeight: 500 };
const btn: React.CSSProperties = { padding: "10px 18px", background: "linear-gradient(180deg,#4a8c5e,#3a7a4e)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14.5, fontWeight: 600, fontFamily: "inherit", boxShadow: "0 4px 12px rgba(58,122,78,.3)" };
const lien: React.CSSProperties = { background: "none", border: "none", color: "#2f7a4e", cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: 0 };
const pied: React.CSSProperties = { textAlign: "center", padding: "20px 14px 0", fontSize: 12, color: "#8a8a92" };
const th: React.CSSProperties = { padding: "9px 10px", fontWeight: 700, fontSize: 12, color: "#3a4a4a", background: "rgba(120,150,130,.16)", textAlign: "center" };
const td: React.CSSProperties = { padding: "9px 10px", color: "#2a2a30" };
const tdC: React.CSSProperties = { padding: "9px 10px", color: "#2a2a30", textAlign: "center" };
const errBox: React.CSSProperties = { background: "rgba(214,69,62,.12)", color: "#b3261e", border: "1px solid rgba(214,69,62,.3)", padding: 11, borderRadius: 12, margin: "6px 0", fontSize: 14 };
const infoCalc: React.CSSProperties = { background: "rgba(74,140,94,.12)", border: "1px solid rgba(74,140,94,.3)", padding: 11, borderRadius: 12, margin: "6px 0", fontSize: 14, color: "#2a3a2a" };
