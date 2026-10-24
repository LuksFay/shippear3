#!/usr/bin/env node
// Convierte el CSV del directorio de canales de reclamo (exportado de la planilla) en SQL idempotente
// (INSERT … ON CONFLICT DO UPDATE) para la tabla entidades_destino. Los datos NO viven en el repo:
//   node server/scripts/entidades-sql.mjs directorio.csv > entidades.sql
//   psql … < entidades.sql
// Columnas esperadas: id, nombre_comercial, denominacion_legal, cuit, tipo, regulador, canal_principal,
// email_reclamos, url_formulario, telefono, acepta_email, plazo_respuesta, fuente_url, fecha_verificacion, confianza
import { readFileSync } from "node:fs";

function parseCsv(txt) {
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas.filter((f) => f.some((x) => x.trim()));
  return resto.map((f) => Object.fromEntries(cab.map((k, i) => [k.trim(), (f[i] ?? "").trim()])));
}

const NP = (v) => !v || /^(no publicad[oa]\b.*|-|n\/a|s\/d)$/i.test(v.trim());
const limpio = (v) => (NP(v) ? null : v.replace(/[\u0000-\u001F\u007F]/g, " ").trim());

function tipo(t, nombre) {
  t = t.toLowerCase();
  if (t.includes("organismo")) return "organismo";
  if (t.includes("aseguradora")) return "seguro";
  if (t.includes("billetera")) return "billetera";
  if (/tarjeta/i.test(nombre) || t.includes("tarjeta")) return "tarjeta";
  if (t.startsWith("banco")) return "banco";
  if (t.startsWith("mutual")) return "mutual";
  if (t.startsWith("cooperativa")) return "cooperativa";
  if (t.startsWith("financiera")) return "financiera";
  return "credito"; // proveedor no financiero de crédito
}

// Clasificación manual de sector (la planilla no la trae). A validar por la Oficina.
const PUBLICOS = [/^banco nacion$/i, /^banco provincia\b/i, /ciudad de buenos aires/i, /provincia de cordoba/i, /^banco de la pampa$/i,
  /^banco del chubut$/i, /tierra del fuego/i, /provincia del neuqu/i, /^banco rioja$/i, /inversion y comercio exterior/i,
  /municipal de rosario/i, /^banco de corrientes$/i, /^nacion seguros$/i, /oriental del uruguay/i];
const MIXTOS = [/^banco hipotecario$/i];
function sector(t, nombre) {
  if (t === "organismo") return "publico";
  if (MIXTOS.some((r) => r.test(nombre))) return "mixto";
  if (PUBLICOS.some((r) => r.test(nombre))) return "publico";
  return "privado";
}

// Alias conocidos para que el chat reconozca cómo la nombra la gente.
const ALIAS = {
  "banco nacion": ["bna", "nacion", "banco de la nacion argentina"],
  "banco provincia": ["bapro", "provincia", "cuenta dni", "banco provincia de buenos aires"],
  "banco de la ciudad de buenos aires": ["banco ciudad", "ciudad"],
  "banco de la provincia de cordoba": ["bancor"],
  "bbva": ["frances", "banco frances", "bbva frances"],
  "santander": ["santander rio", "rio"],
  "banco galicia": ["galicia"],
  "banco macro": ["macro"],
  "banco municipal de rosario": ["municipal", "banco municipal"],
  "mercado pago": ["mercadopago", "mp", "mercado libre"],
  "uala": ["uala", "ualá"],
  "naranja x": ["naranja", "tarjeta naranja"],
  "banco credicoop cooperativo limitado": ["credicoop"],
  "industrial and commercial bank of china": ["icbc"],
  "nuevo banco de entre rios": ["banco entre rios", "bersa"],
  "nuevo banco de santa fe": ["banco santa fe", "nbsf"],
  "banco santa fe": ["nuevo banco de santa fe", "nbsf"],
};

// Teléfonos con forma de celular (posible número personal) no se cargan.
const celular = (t) => /((^|\+)\s*54[\s-]?9|(^|[\s(-])15[\s-]?\d{3,4}[\s-]?\d{4}|^\s*9[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{4}\s*$|\d{2,4}[\s-]15[\s-]?\d{3,4}[\s-]?\d{4})/.test(t);
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const sql = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `ARRAY[${a.map(sql).join(",")}]::text[]`;

const filas = parseCsv(readFileSync(process.argv[2], "utf8"));
const stats = { filas: filas.length, conEmail: 0, aceptaEmail: 0, telDescartados: 0, porTipo: {}, porSector: {} };
const vistos = new Set();
const out = ["BEGIN;"];
for (const r of filas) {
  if (!r.id || vistos.has(r.id)) continue;
  vistos.add(r.id);
  const nombre = limpio(r.nombre_comercial) || r.id;
  const t = tipo(r.tipo || "", nombre);
  const emails = [...new Set((r.email_reclamos.match(EMAIL) || []).map((e) => e.toLowerCase()))];
  const acepta = /^s[ií]\b/i.test(r.acepta_email || "");
  let tel = limpio(r.telefono);
  if (tel && celular(tel)) { tel = null; stats.telDescartados++; }
  const clave = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s*\(.*\)\s*/g, "").trim();
  const alias = ALIAS[clave] || [];
  const sec = sector(t, nombre.replace(/\s*\(.*\)\s*/g, ""));
  stats.porTipo[t] = (stats.porTipo[t] || 0) + 1;
  stats.porSector[sec] = (stats.porSector[sec] || 0) + 1;
  if (emails.length) stats.conEmail++;
  if (acepta && emails.length) stats.aceptaEmail++;
  const fecha = /^\d{4}-\d{2}-\d{2}/.test(r.fecha_verificacion || "") ? r.fecha_verificacion.slice(0, 10) : null;
  out.push(
    `INSERT INTO entidades_destino (id, nombre, denominacion_legal, cuit, tipo, sector, regulador, emails, acepta_email, acepta_email_nota, area_contacto, url_formulario, telefono, plazo_respuesta, fuente, fecha_verificacion, confianza, alias, updated_at) VALUES (` +
      [sql(r.id), sql(nombre), sql(limpio(r.denominacion_legal)), sql(limpio(r.cuit)), sql(t), sql(sec), sql(limpio(r.regulador)), arr(emails),
        acepta && emails.length ? "true" : "false", sql(r.acepta_email || null), sql(limpio(r.canal_principal)), sql(limpio(r.url_formulario)), sql(tel),
        sql(limpio(r.plazo_respuesta)), sql(limpio(r.fuente_url)), sql(fecha), sql(limpio(r.confianza)), arr(alias), "now()"].join(", ") +
      `) ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, denominacion_legal = EXCLUDED.denominacion_legal, cuit = EXCLUDED.cuit, tipo = EXCLUDED.tipo, sector = EXCLUDED.sector, regulador = EXCLUDED.regulador, emails = EXCLUDED.emails, acepta_email = EXCLUDED.acepta_email, acepta_email_nota = EXCLUDED.acepta_email_nota, area_contacto = EXCLUDED.area_contacto, url_formulario = EXCLUDED.url_formulario, telefono = EXCLUDED.telefono, plazo_respuesta = EXCLUDED.plazo_respuesta, fuente = EXCLUDED.fuente, fecha_verificacion = EXCLUDED.fecha_verificacion, confianza = EXCLUDED.confianza, alias = EXCLUDED.alias, updated_at = now();`,
  );
}
out.push("COMMIT;");
console.log(out.join("\n"));
console.error(JSON.stringify(stats));
