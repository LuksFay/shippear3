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

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const envolver = (titulo, filas) => `<!doctype html><html lang="es"><body style="margin:0;background:#f4efe4;font-family:Arial,Helvetica,sans-serif;color:#1a1712">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b6355;margin:0 0 16px">Saldo a Favor</p>
<p style="font-size:17px;font-weight:bold;margin:0 0 14px">${esc(titulo)}</p>
${filas.map((f) => `<p style="font-size:14px;line-height:1.5;margin:0 0 10px">${esc(f)}</p>`).join("")}
<p style="font-size:12px;color:#6b6355;margin:20px 0 0"><a href="${config.publicUrl}" style="color:#6b6355">${config.publicUrl.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;

// Abogados: confirmación al estudio y aviso interno. Todo el contenido del usuario va escapado / en texto plano.
export async function sendAbogadoConfirmacion(a) {
  const filas = [
    `Hola, ${a.nombre}.`,
    "Recibimos tus datos. Gracias por sumarte a la red de estudios jurídicos de Saldo a Favor.",
    "Te vamos a escribir con información del piloto en Rosario. Si en algún momento hay un caso que pueda derivarse, primero te lo consultamos: no compartimos casos de forma automática.",
    "Si no fuiste vos, o querés que borremos tus datos, respondé este email.",
  ];
  return getTransport().sendMail({ from: config.smtp.from, to: a.email, subject: "Recibimos tus datos — Saldo a Favor", text: filas.join("\n\n"), html: envolver("Recibimos tus datos", filas) });
}

export async function sendAbogadoAviso(a) {
  const filas = [
    `Nombre: ${a.nombre}`,
    `Estudio: ${a.estudio || "—"}`,
    `Matrícula: ${a.matricula || "—"} ${a.colegio ? `(${a.colegio})` : ""}`,
    `Email: ${a.email}`,
    `Teléfono: ${a.telefono || "—"}`,
    `Ciudad: ${a.ciudad}, ${a.provincia}`,
    `Especialidades: ${a.especialidades.join(", ") || "—"}`,
    `Mensaje: ${a.mensaje || "—"}`,
  ];
  return getTransport().sendMail({ from: config.smtp.from, to: config.notifyEmail, replyTo: a.email, subject: `Nuevo estudio interesado: ${a.estudio || a.nombre}`.slice(0, 150), text: filas.join("\n"), html: envolver("Nuevo estudio jurídico interesado", filas) });
}
