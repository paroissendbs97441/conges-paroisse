// app/api/demandes/route.ts
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { envoyerMail } from "../../../lib/mailer";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;
const GMAIL_PAROISSE = process.env.GMAIL_USER!;

function fr(s: string): string {
  if (!s) return "—";
  const [a, m, j] = s.split("-");
  if (!a || !m || !j) return s;
  return `${j}-${m}-${a}`;
}

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

    // 1) Mails aux APPROBATEURS (avec bouton d'action), un par approbateur
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

    for (const l of liens) {
      await envoyerMail({
        to: [l.email],
        subject: `Demande de congés à traiter – ${demande.profiles.nom_complet}`,
        html: gabaritApprobateur(demande, l.lien),
      });
    }

    // 2) Mail au CPAE (information / consultation, SANS bouton d'action)
    const { data: cpae } = await sb
      .from("membres_cpae").select("email").eq("actif", true);
    const emailsCpae = (cpae ?? []).map((m) => m.email);
    if (emailsCpae.length > 0) {
      await envoyerMail({
        to: emailsCpae,
        subject: `Demande de congés en cours – ${demande.profiles.nom_complet}`,
        html: gabaritCpae(demande),
      });
    }

    // 3) Mail de confirmation au SALARIÉ
    if (demande.profiles?.email) {
      await envoyerMail({
        to: [demande.profiles.email],
        subject: `Votre demande de congés a bien été enregistrée`,
        html: gabaritSalarie(demande),
      });
    }

    await sb.from("journal_mails").insert({
      demande_id: demande.id, type_event: "creation",
      destinataires: [...liens.map((l) => l.email), ...emailsCpae, demande.profiles?.email].filter(Boolean),
    });

    return NextResponse.json({ ok: true, demande_id: demande.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function bloc(d: any) {
  return `
    <p><b>Salarié·e :</b> ${d.profiles.nom_complet}</p>
    <p><b>Type :</b> ${d.types_conges.libelle}</p>
    <p><b>Du</b> ${fr(d.date_debut)} <b>au</b> ${fr(d.date_fin)} (${d.nb_jours} jour(s))</p>
    <p><b>Reprise du travail le :</b> ${fr(d.date_reprise)}</p>
    <p><b>Motif :</b> ${d.motif ?? "—"}</p>`;
}

function gabaritApprobateur(d: any, lien: string) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px">
    <h2>Demande de congés à traiter</h2>
    ${bloc(d)}
    <hr/>
    <p>Une seule approbation suffit. Cliquez pour traiter :</p>
    <p><a href="${lien}" style="background:#2563eb;color:#fff;padding:10px 18px;
      border-radius:6px;text-decoration:none">Examiner la demande</a></p>
  </div>`;
}

function gabaritCpae(d: any) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px">
    <h2>Demande de congés en cours de validation</h2>
    <p style="color:#555">Ce message vous est adressé pour information (CPAE). Aucune action n'est requise de votre part.</p>
    ${bloc(d)}
    <hr/>
    <p style="color:#888;font-size:13px">Vous recevrez le récapitulatif (PDF) une fois la demande validée ou refusée.</p>
  </div>`;
}

function gabaritSalarie(d: any) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px">
    <h2>Votre demande de congés a bien été enregistrée</h2>
    <div style="background:#fef3c7;color:#92400e;padding:12px;border-radius:6px;margin:10px 0">
      <b>En attente d'approbation.</b><br/>
      Ce mail ne vaut pas acceptation de la demande de congés.
    </div>
    ${bloc(d)}
    <hr/>
    <p style="color:#888;font-size:13px">Vous serez notifié·e par mail dès qu'une décision sera prise.</p>
  </div>`;
}
