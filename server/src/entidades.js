import { q } from "./db.js";
import { oficinaHabilitada } from "./reclamos.js";

// Normaliza un nombre para comparar: minúsculas, sin tildes ni puntuación, sin palabras genéricas.
const GENERICAS = /\b(banco|bco|de|del|la|las|los|el|y|s\.?a\.?u?|sa|sau|srl|sas|ltda|limitado|limitada|argentina|arg|cooperativo|sucursal|buenos aires)\b/g;
export function normalizar(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9. ]+/g, " ")
    .replace(GENERICAS, " ")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PRIORIDAD = { banco: 0, billetera: 0, seguro: 0, tarjeta: 0, financiera: 1, credito: 2, mutual: 2, cooperativa: 2 };

let cache = { at: 0, filas: [] };
async function filas() {
  if (Date.now() - cache.at < 10 * 60_000 && cache.filas.length) return cache.filas;
  try {
    const r = await q(
      `SELECT id, nombre, tipo, sector, emails, acepta_email, acepta_email_nota, area_contacto, url_formulario, plazo_respuesta, fuente, alias
         FROM entidades_destino WHERE tipo <> 'organismo'`,
    );
    cache = {
      at: Date.now(),
      filas: r.rows.map((f) => ({ ...f, claves: [...new Set([f.nombre, ...f.alias].map(normalizar).filter((x) => x.length >= 3))] })),
    };
  } catch (e) {
    console.error("[entidades]", e.code || e.message);
  }
  return cache.filas;
}

const palabra = (texto, clave) => ` ${texto} `.includes(` ${clave} `);

// Busca la entidad nombrada por el vecino. Devuelve el destino sugerido o null si no hay coincidencia clara.
export async function buscarEntidad(texto) {
  const t = normalizar(texto);
  if (t.length < 2) return null;
  let mejor = null;
  for (const f of await filas()) {
    let puntos = 0;
    for (const c of f.claves) {
      let p = 0;
      if (c === t) p = 1000;
      else if (palabra(t, c)) p = 300 + c.length; // "mi tarjeta del galicia" contiene "galicia"
      else if (t.length >= 4 && palabra(c, t)) p = 100 + t.length; // "macro" dentro de "macro bma"
      puntos = Math.max(puntos, p);
    }
    if (!puntos) continue;
    puntos -= (PRIORIDAD[f.tipo] ?? 3) * 5;
    if (f.emails.length) puntos += 2;
    if (!mejor || puntos > mejor.puntos) mejor = { puntos, f };
  }
  if (!mejor) return null;
  const f = mejor.f;
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    sector: f.sector,
    email: f.acepta_email ? f.emails[0] || null : null,
    emails: f.emails,
    aceptaEmail: f.acepta_email,
    canal: f.area_contacto,
    url: f.url_formulario,
    plazo: f.plazo_respuesta,
    fuente: f.fuente,
  };
}

// Texto corto para el prompt del modelo: qué entidad es y por dónde se reclama. El modelo no envía nada.
export function destinoParaPrompt(d) {
  if (!d) return "";
  const via = d.email
    ? `email de reclamos: ${d.email}`
    : d.url
      ? `no publica un email que acepte reclamos; se reclama por: ${d.canal || "formulario web"} (${d.url})`
      : `canal: ${d.canal || "no publicado"}`;
  return `ENTIDAD IDENTIFICADA EN EL DIRECTORIO: ${d.nombre} (${d.tipo}) — ${via}. Si el vecino pregunta adónde va el reclamo, decíselo como destino sugerido; aclarale que Saldo a Favor no lo envía solo: lo manda él/ella.`;
}

// Directorio para la Oficina (sólo lectura).
export async function directorio(user, params) {
  if (!oficinaHabilitada(user)) return { entidades: [], total: 0 };
  const tipo = String(params.get("tipo") || "");
  const buscar = normalizar(params.get("q") || "");
  const r = await q(
    `SELECT id, nombre, denominacion_legal, cuit, tipo, sector, regulador, emails, acepta_email, acepta_email_nota, area_contacto,
            url_formulario, telefono, plazo_respuesta, fuente, fecha_verificacion, confianza, updated_at
       FROM entidades_destino WHERE ($1 = '' OR tipo = $1) ORDER BY (tipo = 'organismo') DESC, nombre`,
    [tipo],
  );
  const filtradas = buscar ? r.rows.filter((x) => normalizar(`${x.nombre} ${x.denominacion_legal || ""}`).includes(buscar)) : r.rows;
  return { total: r.rows.length, entidades: filtradas.slice(0, 600) };
}
