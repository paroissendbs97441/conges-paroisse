// app/page.tsx
"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { calculerNbJours, calculerDateReprise } from "@/lib/dateConges";

type Moment = "journee" | "matin" | "apresmidi";

export default function Accueil() {
  const [user, setUser] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);
  const [demandes, setDemandes] = useState<any[]>([]);
  const [form, setForm] = useState({
    type_conge_id: "", date_debut: "", moment_debut: "journee" as Moment,
    date_fin: "", moment_fin: "journee" as Moment, motif: "",
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUser(data.user);
      charger(data.user.id);
    });
    getSupabase().from("types_conges").select("*").then(({ data }) => setTypes(data ?? []));
  }, []);

  async function charger(uid: string) {
    const { data } = await getSupabase()
      .from("demandes").select("*, types_conges(libelle)")
      .eq("salarie_id", uid).order("cree_le", { ascending: false });
    setDemandes(data ?? []);
  }

  // Calculs en direct
  const nbJours = (form.date_debut && form.date_fin)
    ? calculerNbJours(form.date_debut, form.moment_debut, form.date_fin, form.moment_fin) : 0;
  const dateReprise = (form.date_fin)
    ? calculerDateReprise(form.date_fin, form.moment_fin) : "";

  async function envoyer() {
    setMsg("");
    if (!form.type_conge_id || !form.date_debut || !form.date_fin) {
      setMsg("Merci de remplir le type et les dates."); return;
    }
    if (nbJours <= 0) { setMsg("Les dates ne sont pas valides."); return; }
    const res = await fetch("/api/demandes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salarie_id: user.id,
        type_conge_id: Number(form.type_conge_id),
        date_debut: form.date_debut, moment_debut: form.moment_debut,
        date_fin: form.date_fin, moment_fin: form.moment_fin,
        nb_jours: nbJours, date_reprise: dateReprise, motif: form.motif,
      }),
    });
    const j = await res.json();
    if (j.ok) {
      setMsg("Demande envoyée ✅");
      charger(user.id);
      setForm({ type_conge_id: "", date_debut: "", moment_debut: "journee",
        date_fin: "", moment_fin: "journee", motif: "" });
    } else setMsg("Erreur : " + j.error);
  }

  const badge = (s: string) => ({
    en_attente: { t: "En attente", c: "#b45309", b: "#fef3c7" },
    validee: { t: "Validée", c: "#15803d", b: "#dcfce7" },
    refusee: { t: "Refusée", c: "#b91c1c", b: "#fee2e2" },
  } as any)[s];

  if (!user) return <p style={{ padding: 40 }}>Chargement…</p>;

  return (
    <div style={{ maxWidth: 760, margin: "30px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22 }}>Mes demandes de congés</h1>
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
        <div style={ligne2}>
          <input style={inp} type="date" value={form.date_debut}
            onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
          <select style={inp} value={form.moment_debut}
            onChange={(e) => setForm({ ...form, moment_debut: e.target.value as Moment })}>
            <option value="journee">Journée entière</option>
            <option value="apresmidi">Après-midi seulement</option>
          </select>
        </div>

        <label style={lbl}>Date de fin</label>
        <div style={ligne2}>
          <input style={inp} type="date" value={form.date_fin}
            onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
          <select style={inp} value={form.moment_fin}
            onChange={(e) => setForm({ ...form, moment_fin: e.target.value as Moment })}>
            <option value="journee">Journée entière</option>
            <option value="matin">Matin seulement</option>
          </select>
        </div>

        {(form.date_debut && form.date_fin) && (
          <div style={{ background: "#eff6ff", padding: 10, borderRadius: 6, margin: "6px 0", fontSize: 14 }}>
            <b>Nombre de jours :</b> {nbJours} &nbsp;·&nbsp;
            <b>Reprise du travail le :</b> {dateReprise}
          </div>
        )}

        <label style={lbl}>Motif (facultatif)</label>
        <textarea style={inp} value={form.motif}
          onChange={(e) => setForm({ ...form, motif: e.target.value })} />
        <button style={btn} onClick={envoyer}>Envoyer la demande</button>
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
                  Du {d.date_debut} au {d.date_fin} · {d.nb_jours} j · reprise {d.date_reprise ?? "—"}</span>
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
  );
}

const carte: React.CSSProperties = { background: "#fff", padding: 20, borderRadius: 12, margin: "16px 0", boxShadow: "0 1px 4px rgba(0,0,0,.08)" };
const inp: React.CSSProperties = { display: "block", width: "100%", padding: 9, margin: "4px 0 10px", borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" };
const ligne2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const lbl: React.CSSProperties = { fontSize: 13, color: "#555" };
const btn: React.CSSProperties = { padding: "10px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 15 };
const lien: React.CSSProperties = { background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 14 };
const ligneDemande: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" };
