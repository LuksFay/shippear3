import { HttpError, hmac } from "./auth.js";
import { q } from "./db.js";
import { sendAbogadoAviso, sendAbogadoConfirmacion } from "./mail.js";
import { oficinaHabilitada } from "./reclamos.js";

export const ESPECIALIDADES = { bancario: "Bancario", tarjetas: "Tarjetas", billeteras: "Billeteras virtuales", consumidor: "Consumidor general" };
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,180}\.[a-z]{2,24}$/i;

// Texto plano: sin caracteres de control, espacios colapsados y largo máximo.
function texto(v, max, { requerido = false, campo = "", multilinea = false } = {}) {
  let s = String(v ?? "").replace(multilinea ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, " ");
  s = multilinea ? s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() : s.replace(/\s+/g, " ").trim();
  if (requerido && !s) throw new HttpError(400, "dato_faltante", `Falta completar: ${campo}.`);
  if (s.length > max) throw new HttpError(400, "dato_invalido", `${campo} es demasiado largo (máx. ${max}).`);
  return s || null;
}

// Límite por IP en memoria (además del de la base): 3 envíos por hora.
const hits = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.every((t) => now - t > 3_600_000)) hits.delete(k);
}, 600_000).unref();

export async function registrarAbogado(body, ip) {
  // Honeypot: un bot que completa el campo oculto recibe "ok" y no se guarda nada.
  if (String(body?.sitio_web ?? "").trim()) return { ok: true };

  const ipHash = hmac(`abogados:${ip}`);
  const now = Date.now();
  const arr = (hits.get(ipHash) || []).filter((t) => now - t < 3_600_000);
  const enBase = (await q("SELECT count(*)::int AS n FROM abogados_interesados WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'", [ipHash])).rows[0].n;
  if (arr.length >= 3 || enBase >= 3) throw new HttpError(429, "demasiados_intentos", "Ya recibimos varios envíos desde tu conexión. Probá en un rato.");

  if (body?.consentimiento !== true)
    throw new HttpError(400, "falta_consentimiento", "Para registrarte tenés que aceptar recibir información y posibles casos derivados.");

  const a = {
    nombre: texto(body.nombre, 120, { requerido: true, campo: "Nombre y apellido" }),
    estudio: texto(body.estudio, 160, { campo: "Estudio" }),
    matricula: texto(body.matricula, 40, { campo: "Matrícula" }),
    colegio: texto(body.colegio, 120, { campo: "Colegio" }),
    email: texto(body.email, 254, { requerido: true, campo: "Email" })?.toLowerCase(),
    telefono: texto(body.telefono, 40, { campo: "Teléfono" }),
    ciudad: texto(body.ciudad, 80, { requerido: true, campo: "Ciudad" }),
    provincia: texto(body.provincia, 80, { requerido: true, campo: "Provincia" }),
    mensaje: texto(body.mensaje, 1000, { campo: "Mensaje", multilinea: true }),
    especialidades: [...new Set((Array.isArray(body.especialidades) ? body.especialidades : []).map(String))].filter((e) => e in ESPECIALIDADES),
  };
  if (!EMAIL_RE.test(a.email)) throw new HttpError(400, "email_invalido", "Revisá el email.");
  if (a.telefono && !/^[0-9+()\-.\s]{6,40}$/.test(a.telefono)) throw new HttpError(400, "dato_invalido", "Revisá el teléfono (sólo números, espacios y + - ( )).");
  if (!a.especialidades.length) throw new HttpError(400, "dato_faltante", "Elegí al menos una especialidad.");

  arr.push(now);
  hits.set(ipHash, arr);
  await q(
    `INSERT INTO abogados_interesados (nombre, estudio, matricula, colegio, email, telefono, ciudad, provincia, especialidades, mensaje, consentimiento_at, ip_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11)`,
    [a.nombre, a.estudio, a.matricula, a.colegio, a.email, a.telefono, a.ciudad, a.provincia, a.especialidades, a.mensaje, ipHash],
  );
  const etiquetas = { ...a, especialidades: a.especialidades.map((e) => ESPECIALIDADES[e]) };
  // El registro ya quedó guardado: los mails salen en segundo plano; si fallan se loguea y no se pierde el alta.
  Promise.allSettled([sendAbogadoConfirmacion(etiquetas), sendAbogadoAviso(etiquetas)]).then((rs) =>
    rs.forEach((r) => r.status === "rejected" && console.error("[mail abogados]", r.reason?.code || "", r.reason?.message)),
  );
  return { ok: true };
}

// Lista de sólo lectura para la Oficina (sin IP ni datos técnicos).
export async function listarAbogados(user) {
  if (!oficinaHabilitada(user)) return { estudios: [] };
  const r = await q(
    `SELECT id, nombre, estudio, matricula, colegio, email, telefono, ciudad, provincia, especialidades, mensaje, consentimiento_at
       FROM abogados_interesados ORDER BY created_at DESC LIMIT 500`,
  );
  return {
    estudios: r.rows.map((x) => ({ ...x, id: Number(x.id), especialidades: x.especialidades.map((e) => ESPECIALIDADES[e] || e) })),
  };
}
