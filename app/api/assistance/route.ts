// app/api/assistance/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { envoyerMail } from "../../../lib/mailer";

const GMAIL_PAROISSE = process.env.GMAIL_USER!;

export async function POST(req: Request) {
  try {
    const sb = getSupabaseAdmin();
    const { salarie_id, objet, message, nom, email } = await req.json();

    if (!objet?.trim() || !message?.trim()) {
      return NextResponse.json({ ok: false, error: "Objet et message obligatoires" }, { status: 400 });
    }

    let nomExp = nom?.trim() || "—";
    let emailExp = email?.trim() || "—";
    if (salarie_id) {
      const { data: profil } = await sb
        .from("profiles").select("nom_complet,email").eq("id", salarie_id).single();
      if (profil) { nomExp = profil.nom_complet; emailExp = profil.email; }
    } else {
      if (!nom?.trim() || !email?.trim()) {
        return NextResponse.json({ ok: false, error: "Nom et email obligatoires" }, { status: 400 });
      }
    }

    const { data: cpae } = await sb
      .from("membres_cpae").select("email").eq("actif", true);
    const destinataires = [GMAIL_PAROISSE, ...(cpae ?? []).map((m) => m.email)];

    await envoyerMail({
      to: destinataires,
      subject: `[Assistance] ${objet} — ${nomExp}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px">
          <h2>Demande d'assistance</h2>
          <p><b>De :</b> ${nomExp} (${emailExp})</p>
          <p><b>Objet :</b> ${objet}</p>
          <hr/>
          <p style="white-space:pre-wrap">${message}</p>
        </div>`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
