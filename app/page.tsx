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
  const [form, setForm] = useState({
    type_conge_id: "", date_debut: "", date_fin: "", motif: "",
    debutMatin: true, debutAprem: true, finMatin: true, finAprem: true,
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUser(data.user);
      charger(data.user.id);
      getSupabase().from("profiles").select("nom_complet,poste").eq("id", data.user.id).single()
        .then(({ data: p }) => setProfil(p));
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

  async function envoyer() {
    setMsg("");
    if (!form.type_conge_id) { setMsg("Merci de choisir un type de congé."); return; }
    const err = validerDemande(form.date_debut, form.date_fin, saisie);
    if (err) { setMsg(err); return; }
    if (nbJours <= 0) { setMsg("La durée calculée est nulle, vérifiez votre saisie."); return; }

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
      setForm({ type_conge_id: "", date_debut: "", date_fin: "", motif: "",
        debutMatin: true, debutAprem: true, finMatin: true, finAprem: true });
    } else setMsg("Erreur : " + j.error);
  }

  const badge = (s: string) => ({
    en_attente: { t: "En attente", c: "#b45309", b: "#fef3c7" },
    validee: { t: "Validée", c: "#15803d", b: "#dcfce7" },
    refusee: { t: "Refusée", c: "#b91c1c", b: "#fee2e2" },
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
            <div style={{ background: "#fee2e2", color: "#b91c1c", padding: 10, borderRadius: 6, margin: "6px 0", fontSize: 14 }}>
              {erreurValidation}
            </div>
          )}
          {(form.date_debut && form.date_fin && !erreurValidation) && (
            <div style={{ background: "#eff6ff", padding: 10, borderRadius: 6, margin: "6px 0", fontSize: 14 }}>
              <b>Nombre de jours :</b> {nbJours} &nbsp;·&nbsp;
              <b>Reprise du travail le :</b> {frDate(dateReprise)}
            </div>
          )}

          <label style={lbl}>Motif (facultatif)</label>
          <textarea style={inp} value={form.motif}
            onChange={(e) => setForm({ ...form, motif: e.target.value })} />
          <button style={{ ...btn, opacity: erreurValidation ? 0.5 : 1 }}
            disabled={!!erreurValidation} onClick={envoyer}>Envoyer la demande</button>
          {msg && <p>{msg}</p>}
        </div>

        <div style={carte}>
          <h2 style={{ fontSize: 17 }}>Historique</h2>
          {demandes.length === 0 && <p style={{ color: "#777" }}>Aucune demande pour l'instant.</p>}
          {demandes.map((d) => {
            const bg = badge(d.statut);
            return (
              <div key={d.id} style={ligneDemande}>
                <div>
                  <b>{d.types_conges?.libelle}</b><br />
                  <span style={{ color: "#555", fontSize: 14 }}>
                    Du {frDate(d.date_debut)} au {frDate(d.date_fin)} · {d.nb_jours} j · reprise {frDate(d.date_reprise)}</span>
                  {d.statut === "refusee" && d.motif_refus &&
                    <div style={{ color: "#b91c1c", fontSize: 13 }}>Motif refus : {d.motif_refus}</div>}
                </div>
                <span style={{ background: bg.b, color: bg.c, padding: "4px 10px",
                  borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{bg.t}</span>
              </div>
            );
          })}
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
