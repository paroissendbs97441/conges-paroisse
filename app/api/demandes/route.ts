// app/api/demandes/route.ts
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { envoyerMail } from "@/lib/mailer";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

export async function POST(req: Request) {
  try {
    const sb = getSupabaseAdmin();
    const { salarie_id, type_conge_id, date_debut, moment_debut, date_fin,
      moment_fin, nb_jours, date_reprise, motif } = await req.json();

    const { data: demande, error: errD } = await sb
      .from("demandes")
      .insert({ salarie_id, type_conge_id, date_debut, moment_debut, date_fin,
        moment_fin, nb_jours, date_reprise, motif })
      .select("*, profiles(nom_complet,email), types_conges(libelle)")
      .single();
    if (errD) throw errD;

    const { data: approbateurs } = await sb
      .from("approbateurs").select("*").eq("actif", true);

    const liens: { email: string; lien: string }[] = [];
    for (const a of approbateurs ?? []) {
      const token = randomBytes(32).toString("hex");
      await sb.from("jetons_action").insert({
        demande_id: demande.id, approbateur_id: a.id, token,
      });
      liens.push({ email: a.email, lien: `${BASE_URL}/action/${token}` });
    }

    const { data: cpae } = await sb
      .from("membres_cpae").select("email").eq("actif", true);
    const emailsCpae = (cpae ?? []).map((m) => m.email);

    for (const l of liens) {
      await envoyerMail({
        to: [l.email],
        cc: emailsCpae,
        subject: `Demande de congés – ${demande.profiles.nom_complet}`,
        html: gabaritDemande(demande, l.lien),
      });
    }

    await sb.from("journal_mails").insert({
      demande_id: demande.id, type_event: "creation",
      destinataires: [...liens.map((l) => l.email), ...emailsCpae],
    });

    return NextResponse.json({ ok: true, demande_id: demande.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function gabaritDemande(d: any, lien: string) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px">
    <h2>Nouvelle demande de congés</h2>
    <p><b>Salarié·e :</b> ${d.profiles.nom_complet}</p>
    <p><b>Type :</b> ${d.types_conges.libelle}</p>
    <p><b>Du</b> ${d.date_debut} <b>au</b> ${d.date_fin} (${d.nb_jours} jour(s))</p>
    <p><b>Motif :</b> ${d.motif ?? "—"}</p>
    <hr/>
    <p>Une seule approbation suffit. Cliquez pour traiter :</p>
    <p><a href="${lien}" style="background:#2563eb;color:#fff;padding:10px 18px;
      border-radius:6px;text-decoration:none">Examiner la demande</a></p>
  </div>`;
}
