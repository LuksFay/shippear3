import { createHmac, randomBytes, randomInt, timingSafeEqual, createHash } from "node:crypto";
import { config } from "./config.js";
import { q } from "./db.js";
import { sendLoginCode } from "./mail.js";

const DNI_RE = /^\d{7,8}$/;
const CUIT_RE = /^\d{11}$/;

// Tipos de usuario: el rol se elige en el login y define el documento.
//   vecino  (ciudadano) → DNI, 7 u 8 dígitos
//   entidad             → CUIT/CUIL, 11 dígitos con dígito verificador válido
export function normalizeRole(r) {
  const v = String(r ?? "").toLowerCase();
  if (v === "vecino" || v === "ciudadano") return "vecino";
  if (v === "entidad") return "entidad";
  return null;
}

export function cuitValido(c) {
  if (!CUIT_RE.test(c)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((acc, k, i) => acc + k * Number(c[i]), 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false;
  return dv === Number(c[10]);
}

function validarDoc(role, doc) {
  if (role === "vecino") {
    if (!DNI_RE.test(doc)) throw new HttpError(400, "dni_invalido", "El DNI tiene que tener 7 u 8 números.");
  } else if (!CUIT_RE.test(doc)) {
    throw new HttpError(400, "cuit_invalido", "El CUIT/CUIL tiene que tener 11 números.");
  } else if (!cuitValido(doc)) {
    throw new HttpError(400, "cuit_invalido", "El CUIT/CUIL no es válido. Revisá los números.");
  }
}

function leerRol(r) {
  const role = normalizeRole(r);
  if (!role) throw new HttpError(400, "rol_invalido", "Elegí si entrás como ciudadano o como entidad.");
  return role;
}
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function normalizeDoc(v) {
  return String(v ?? "").replace(/[.\s-]/g, "");
}

export function hmac(value) {
  return createHmac("sha256", config.sessionSecret).update(value).digest("hex");
}
const sha256 = (v) => createHash("sha256").update(v).digest("hex");

function safeEqualHex(a, b) {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function maskEmail(email) {
  const [u, d] = email.split("@");
  const head = u.slice(0, Math.min(2, u.length));
  return `${head}${"*".repeat(Math.max(1, u.length - head.length))}@${d}`;
}

// Límites simples en memoria para verificaciones por IP (el resto se cuenta en la DB).
const verifyHits = new Map();
function hitIp(ip, limit, windowMs) {
  const now = Date.now();
  const arr = (verifyHits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  verifyHits.set(ip, arr);
  return arr.length <= limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of verifyHits) if (v.every((t) => now - t > 3_600_000)) verifyHits.delete(k);
}, 600_000).unref();

export async function requestCode({ role, doc, email, ip }) {
  role = leerRol(role);
  doc = normalizeDoc(doc);
  validarDoc(role, doc);
  email = String(email ?? "").trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, "email_invalido", "Revisá el email.");

  const ipCount = await q(
    "SELECT count(*)::int AS n FROM login_tokens WHERE request_ip = $1 AND created_at > now() - interval '1 hour'",
    [ip],
  );
  if (ipCount.rows[0].n >= 10) throw new HttpError(429, "demasiados_intentos", "Demasiados pedidos. Probá en un rato.");

  let user = (await q("SELECT id, email FROM users WHERE doc_number = $1 AND role = $2", [doc, role])).rows[0];
  if (!user) {
    if (!email) throw new HttpError(400, "falta_email", "Es tu primera vez: escribí tu email para mandarte el código.", { needEmail: true });
    user = (
      await q(
        `INSERT INTO users (doc_number, role, email) VALUES ($1, $2, $3)
         ON CONFLICT (doc_number, role) DO UPDATE SET doc_number = EXCLUDED.doc_number RETURNING id, email`,
        [doc, role, email],
      )
    ).rows[0];
  }

  const recent = await q(
    `SELECT count(*) FILTER (WHERE created_at > now() - interval '15 minutes')::int AS q15,
            count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS d1,
            max(created_at) AS last
       FROM login_tokens WHERE user_id = $1`,
    [user.id],
  );
  const r = recent.rows[0];
  if (r.last && Date.now() - new Date(r.last).getTime() < 45_000)
    throw new HttpError(429, "espera", "Ya te mandamos un código. Esperá un minuto para pedir otro.");
  if (r.q15 >= 3 || r.d1 >= 10) throw new HttpError(429, "demasiados_intentos", "Pediste muchos códigos. Probá más tarde.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await q("UPDATE login_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [user.id]);
  await q(
    `INSERT INTO login_tokens (user_id, token_hash, expires_at, request_ip)
     VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
    [user.id, hmac(`${user.id}:${code}`), config.tokenMinutes, ip],
  );
  try {
    await sendLoginCode({ to: user.email, code, minutes: config.tokenMinutes });
  } catch (e) {
    console.error("[mail]", e.code || "", e.message);
    throw new HttpError(502, "mail_fallo", "No pudimos mandar el email. Probá de nuevo en un minuto.");
  }
  return { ok: true, email: maskEmail(user.email), minutes: config.tokenMinutes };
}

export async function verifyCode({ role, doc, code, ip, userAgent }) {
  role = leerRol(role);
  doc = normalizeDoc(doc);
  code = String(code ?? "").replace(/\D/g, "");
  validarDoc(role, doc);
  if (code.length !== 6) throw new HttpError(400, "datos_invalidos", "El código tiene 6 números.");
  if (!hitIp(ip, 30, 15 * 60_000)) throw new HttpError(429, "demasiados_intentos", "Demasiados intentos. Probá en un rato.");

  const user = (await q("SELECT id, doc_number, email, role FROM users WHERE doc_number = $1 AND role = $2", [doc, role])).rows[0];
  const tok = user
    ? (await q(
        `SELECT id, token_hash, attempts FROM login_tokens
          WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
          ORDER BY created_at DESC LIMIT 1`,
        [user.id],
      )).rows[0]
    : null;
  if (!tok) throw new HttpError(401, "codigo_vencido", "El código venció o no existe. Pedí uno nuevo.");
  if (tok.attempts >= 5) {
    await q("UPDATE login_tokens SET used_at = now() WHERE id = $1", [tok.id]);
    throw new HttpError(401, "codigo_bloqueado", "Muchos intentos con ese código. Pedí uno nuevo.");
  }
  if (!safeEqualHex(tok.token_hash, hmac(`${user.id}:${code}`))) {
    await q("UPDATE login_tokens SET attempts = attempts + 1 WHERE id = $1", [tok.id]);
    throw new HttpError(401, "codigo_incorrecto", "El código no coincide. Revisalo e intentá de nuevo.");
  }
  await q("UPDATE login_tokens SET used_at = now() WHERE id = $1", [tok.id]);
  await q("UPDATE users SET last_login_at = now(), email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1", [user.id]);

  const raw = randomBytes(32).toString("base64url");
  await q(
    `INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + make_interval(days => $3), $4, $5)`,
    [user.id, sha256(raw), config.sessionDays, ip, String(userAgent || "").slice(0, 300)],
  );
  return { cookie: raw, user: publicUser(user) };
}

export function publicUser(u) {
  return {
    doc: u.doc_number,
    docType: u.role === "entidad" ? (/^(20|23|24|27)/.test(u.doc_number) ? "CUIL" : "CUIT") : "DNI",
    email: maskEmail(u.email),
    role: u.role,
  };
}

export function readCookie(req) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === config.cookieName) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function sessionCookie(value, maxAgeSec) {
  return [
    `${config.cookieName}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    config.cookieSecure ? "Secure" : "",
    `Max-Age=${maxAgeSec}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export async function currentUser(req) {
  const raw = readCookie(req);
  if (!raw) return null;
  const row = (
    await q(
      `SELECT s.id AS sid, u.id, u.doc_number, u.email, u.role, u.entidad_id FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sha256(raw)],
    )
  ).rows[0];
  if (!row) return null;
  q("UPDATE sessions SET last_seen_at = now() WHERE id = $1", [row.sid]).catch(() => {});
  return row;
}

export async function logout(req) {
  const raw = readCookie(req);
  if (raw) await q("DELETE FROM sessions WHERE token_hash = $1", [sha256(raw)]);
}
