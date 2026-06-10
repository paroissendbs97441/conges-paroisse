// app/api/action/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { envoyerMail } from "@/lib/mailer";
import { genererPdfDemande } from "@/lib/pdf";

export async function POST(req: Request) {
  try {
    const sb = getSupabaseAdmin();
    const { token, decision, motif_refus } = await req.json();

    const { data: jeton } = await sb
      .from("jetons_action")
      .select("*, demandes(*, profiles(nom_complet,email), types_conges(libelle))")
      .eq("token", token).single();

    if (!jeton) return NextResponse.json({ ok: false, error: "Lien invalide" }, { status: 404 });

    const demande = jeton.demandes;
    if (demande.statut !== "en_attente") {
      return NextResponse.json({ ok: true, deja_traitee: true, statut: demande.statut });
    }
    if (decision === "refusee" && !motif_refus?.trim()) {
      return NextResponse.json({ ok: false, error: "Motif de refus obligatoire" }, { status: 400 });
    }

    const { data: maj } = await sb
      .from("demandes")
      .update({
        statut: decision,
        resolu_par: jeton.approbateur_id,
        resolu_le: new Date().toISOString(),
        motif_refus: decision === "refusee" ? motif_refus : null,
      })
      .eq("id", demande.id).eq("statut", "en_attente")
      .select("*, profiles(nom_complet,email), types_conges(libelle)")
      .single();

    if (!maj) return NextResponse.json({ ok: true, deja_traitee: true });

    await sb.from("jetons_action").update({ utilise: true }).eq("token", token);

    const { data: approbateur } = await sb
      .from("approbateurs").select("nom,email").eq("id", jeton.approbateur_id).single();

    const pdf = await genererPdfDemande(maj, approbateur);

    const { data: approbateurs } = await sb
      .from("approbateurs").select("email").eq("actif", true);
    const { data: cpae } = await sb
      .from("membres_cpae").select("email").eq("actif", true);

    const destinataires = [
      maj.profiles.email,
      ...(approbateurs ?? []).map((a) => a.email),
      ...(cpae ?? []).map((m) => m.email),
    ];

    const valide = decision === "validee";
    await envoyerMail({
      to: destinataires,
      subject: valide
        ? `Congés VALIDÉS – ${maj.profiles.nom_complet}`
        : `Congés REFUSÉS – ${maj.profiles.nom_complet}`,
      html: gabaritResolution(maj, approbateur, valide),
      attachments: [{ filename: `demande-conges-${maj.id.slice(0, 8)}.pdf`, content: pdf }],
    });

    await sb.from("journal_mails").insert({
      demande_id: maj.id, type_event: valide ? "validation" : "refus", destinataires,
    });

    return NextResponse.json({ ok: true, statut: decision });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function gabaritResolution(d: any, app: any, valide: boolean) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:${valide ? "#16a34a" : "#dc2626"}">
      Demande ${valide ? "validée" : "refusée"}</h2>
    <p><b>Salarié·e :</b> ${d.profiles.nom_complet}</p>
    <p><b>Type :</b> ${d.types_conges.libelle}</p>
    <p><b>Du</b> ${d.date_debut} <b>au</b> ${d.date_fin} (${d.nb_jours} jour(s))</p>
    ${!valide ? `<p><b>Motif du refus :</b> ${d.motif_refus}</p>` : ""}
    <p><b>${valide ? "Validé" : "Refusé"} par :</b> ${app?.nom}</p>
    <p>Le détail complet figure dans le PDF joint.</p>
  </div>`;
}
