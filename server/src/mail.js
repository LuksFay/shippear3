import nodemailer from "nodemailer";
import { config } from "./config.js";

let transport = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      requireTLS: config.smtp.port !== 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      tls: { rejectUnauthorized: config.smtp.rejectUnauthorized },
    });
  }
  return transport;
}

export async function sendLoginCode({ to, code, minutes }) {
  const text = [
    "Hola.",
    "",
    `Tu código para entrar a Saldo a Favor es: ${code}`,
    "",
    `Vence en ${minutes} minutos y sirve una sola vez.`,
    "Si no lo pediste vos, ignorá este mensaje.",
    "",
    "Saldo a Favor — mesa de entrada digital",
    config.publicUrl,
  ].join("\n");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4efe4;font-family:Arial,Helvetica,sans-serif;color:#1a1712">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b6355;margin:0 0 16px">Saldo a Favor — mesa de entrada digital</p>
<p style="font-size:16px;margin:0 0 12px">Hola. Tu código para entrar es:</p>
<p style="font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:.3em;margin:0 0 16px;color:#c2361b">${code}</p>
<p style="font-size:14px;margin:0 0 8px">Vence en ${minutes} minutos y sirve una sola vez.</p>
<p style="font-size:14px;margin:0 0 24px">Si no lo pediste vos, ignorá este mensaje.</p>
<p style="font-size:12px;color:#6b6355;margin:0"><a href="${config.publicUrl}" style="color:#6b6355">${config.publicUrl.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
  return getTransport().sendMail({
    from: config.smtp.from,
    to,
    subject: `Tu código de ingreso: ${code}`,
    text,
    html,
  });
}
