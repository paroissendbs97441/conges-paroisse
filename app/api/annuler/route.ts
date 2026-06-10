// app/api/annuler/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { envoyerMail } from "../../../lib/mailer";

function fr(s: string): string {
  if (!s) return "—";
  const [a, m, j] = s.split("-");
  if (!a || !m || !j) return s;
  return `${j}-${m}-${a}`;
}
function frDateHeure(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseAdmin();
    const { demande_id, salarie_id, motif_annulation } = await req.json();

    if (!motif_annulation?.trim()) {
      return NextResponse.json({ ok: false, error: "Motif d'annulation obligatoire" }, { status: 400 });
    }

    const { data: d } = await sb
      .from("demandes")
      .select("*, profiles(nom_complet,email), types_conges(libelle)")
      .eq("id", demande_id).single();

    if (!d) return NextResponse.json({ ok: false, error: "Demande introuvable" }, { status: 404 });
    if (d.salarie_id !== salarie_id) {
      return NextResponse.json({ ok: false, error: "Action non autorisée" }, { status: 403 });
    }
    if (d.statut !== "en_attente" && d.statut !== "validee") {
      return NextResponse.json({ ok: false, error: "Cette demande ne peut pas être annulée." }, { status: 400 });
    }

    const debut = new Date(d.date_debut + "T00:00:00");
    const limite = new Date(debut.getTime() - 24 * 60 * 60 * 1000);
    if (new Date() > limite) {
      return NextResponse.json({ ok: false, error: "Annulation impossible : il reste moins de 24h avant le début du congé." }, { status: 400 });
    }

    const maintenant = new Date();
    const { error: errMaj } = await sb.from("demandes").update({
      statut: "annulee",
      motif_annulation,
      annulee_le: maintenant.toISOString(),
    }).eq("id", demande_id);
    if (errMaj) throw errMaj;

    const { data: approbateurs } = await sb.from("approbateurs").select("email").eq("actif", true);
    const { data: cpae } = await sb.from("membres_cpae").select("email").eq("actif", true);
    const destinataires = [
      ...(approbateurs ?? []).map((a) => a.email),
      ...(cpae ?? []).map((m) => m.email),
      d.profiles?.email,
    ].filter(Boolean);

    if (destinataires.length > 0) {
      await envoyerMail({
        to: destinataires,
        subject: `Congé ANNULÉ – ${d.profiles.nom_complet}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px">
            <h2 style="color:#b45309">Annulation d'un congé</h2>
            <p>Le congé de la période <b>du ${fr(d.date_debut)} au ${fr(d.date_fin)}</b>
               pour le salarié <b>${d.profiles.nom_complet}</b> a été annulé le
               <b>${frDateHeure(maintenant)}</b>.</p>
            <p><b>Type :</b> ${d.types_conges.libelle} (${d.nb_jours} jour(s))</p>
            <p><b>Motif de l'annulation :</b> ${motif_annulation}</p>
            <p style="color:#555">Annulation effectuée par le salarié.</p>
          </div>`,
      });
    }

    await sb.from("journal_mails").insert({
      demande_id, type_event: "annulation", destinataires,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
