// lib/mailer.ts
// Envoi d'emails via le compte Gmail de la paroisse (SMTP + mot de passe d'application).
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER!,         // ex. paroissebonsecours@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD!, // mot de passe d'application (16 caractères, sans espaces)
  },
});

type Piece = { filename: string; content: Buffer };

export async function envoyerMail(opts: {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Piece[];
}) {
  return transporter.sendMail({
    from: `"Congés Paroisse" <${process.env.GMAIL_USER}>`,
    to: opts.to.join(","),
    cc: opts.cc?.join(","),
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
}
