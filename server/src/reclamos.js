// Reclamos persistidos: cada conversación del chat es un reclamo del vecino (borrador hasta presentarlo).
// TODA consulta filtra por user_id de la sesión: un usuario nunca ve ni toca reclamos ajenos.
import { q } from "./db.js";
import { HttpError } from "./auth.js";

export const nro = (r) => `RE-${new Date(r.created_at).getFullYear()}-${String(r.id).padStart(4, "0")}`;
const IA = { xai: "Grok", local: "Qwen", openai: "OpenAI" };

const ESTADO = { borrador: "SIN TERMINAR", recibido: "RECIBIDO", baja: "DADO DE BAJA", en_tramite: "EN TRÁMITE", respondido: "RESPONDIDO", escalado: "ESCALADO AL BCRA", resuelto: "RESUELTO" };

// Días hábiles (lun-vie) desde la presentación.
function diasHabiles(desde) {
  if (!desde) return null;
  let d = new Date(desde), n = 0;
  const hoy = new Date();
  while (d < hoy) {
    d = new Date(d.getTime() + 86400000);
    if (d <= hoy && d.getDay() % 6 !== 0) n++;
  }
  return n;
}

function parseMonto(s) {
  if (typeof s === "number") return s;
  const n = Number(String(s || "").replace(/[^\d,.-]/g, "").replaceAll(".", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// Forma que usan las pantallas (ticket / seguimiento / bandeja).
export function ticket(r) {
  const d = r.datos || {};
  const dias = diasHabiles(r.presentado_at);
  const vencido = (r.estado === "recibido" || r.estado === "en_tramite") && dias != null && dias > 10;
  return {
    id: nro(r),
    dbId: Number(r.id),
    fecha: new Date(r.presentado_at || r.created_at).toISOString().slice(0, 10),
    entidad: d.entidad || "—",
    categoria: d.categoria || "BANCOS",
    tipo: d.tipo || "",
    operacion: d.operacion || "",
    monto: parseMonto(d.monto),
    estado: vencido ? "VENCIDO" : ESTADO[r.estado] || r.estado,
    borrador: r.estado === "borrador",
    activa: Boolean(r.activa),
    diasPlazo: r.estado === "borrador" ? null : dias,
    vencido,
    resumen: d.resumen || String(r.memoria || "").split("\n")[0].replace(/^[-•*]\s*/, "").slice(0, 160),
    fundamento: r.fundamento || "",
    actualizado: r.updated_at,
  };
}

export function mensajeOut(m) {
  return {
    from: m.role === "assistant" ? "ia" : "user",
    kind: m.kind,
    text: m.text,
    adjunto: m.adjunto || null,
    por: m.provider ? IA[m.provider] || "IA" : null,
    at: m.created_at,
  };
}

export async function reclamoDe(userId, id) {
  const r = (await q("SELECT * FROM reclamos WHERE id = $1 AND user_id = $2", [id, userId])).rows[0];
  if (!r) throw new HttpError(404, "reclamo_no_encontrado", "No encontré ese reclamo.");
  return r;
}

export async function activa(userId) {
  return (await q("SELECT * FROM reclamos WHERE user_id = $1 AND activa", [userId])).rows[0] || null;
}

// Devuelve el borrador donde se escribe: el pedido (si es del usuario y sigue abierto) o el activo; si no hay, crea uno.
export async function borradorParaChat(userId, id) {
  if (id) {
    const r = await reclamoDe(userId, Number(id));
    if (r.estado !== "borrador") throw new HttpError(409, "reclamo_cerrado", "Ese reclamo ya fue presentado. Empezá una conversación nueva.");
    if (!r.activa) await activar(userId, r.id);
    return r;
  }
  const a = await activa(userId);
  if (a && a.estado === "borrador") return a;
  if (a) await q("UPDATE reclamos SET activa = false WHERE id = $1", [a.id]);
  return (await q("INSERT INTO reclamos (user_id) VALUES ($1) RETURNING *", [userId])).rows[0];
}

async function activar(userId, id) {
  await q("UPDATE reclamos SET activa = false WHERE user_id = $1 AND activa AND id <> $2", [userId, id]);
  await q("UPDATE reclamos SET activa = true WHERE id = $1 AND user_id = $2", [id, userId]);
}

export async function mensajes(reclamoId) {
  return (await q("SELECT * FROM reclamo_mensajes WHERE reclamo_id = $1 ORDER BY id", [reclamoId])).rows;
}

// GET /api/conversacion[?id=] → conversación activa (o la pedida, que pasa a ser la activa) con su historial.
export async function conversacion(user, id) {
  let r;
  if (id) {
    r = await reclamoDe(user.id, Number(id));
    if (r.estado === "borrador") await activar(user.id, r.id);
  } else r = await activa(user.id);
  if (!r) return { reclamo: null, mensajes: [] };
  const ms = await mensajes(r.id);
  return { reclamo: { ...ticket(r), datos: r.datos, listo: r.listo }, mensajes: ms.map(mensajeOut) };
}

// POST /api/conversacion/nueva → la actual queda guardada (en Mis reclamos) y el chat arranca de cero.
export async function nueva(user) {
  await q("UPDATE reclamos SET activa = false WHERE user_id = $1 AND activa", [user.id]);
  // Los borradores sin ningún mensaje no sirven: se borran.
  await q("DELETE FROM reclamos r WHERE r.user_id = $1 AND r.estado = 'borrador' AND NOT EXISTS (SELECT 1 FROM reclamo_mensajes m WHERE m.reclamo_id = r.id)", [user.id]);
  return { ok: true };
}

// GET /api/reclamos → los del vecino (presentados y borradores con mensajes), más recientes primero.
export async function listar(user) {
  const rows = (
    await q(
      `SELECT r.* FROM reclamos r
        WHERE r.user_id = $1 AND (r.estado <> 'borrador' OR EXISTS (SELECT 1 FROM reclamo_mensajes m WHERE m.reclamo_id = r.id))
        ORDER BY r.updated_at DESC LIMIT 200`,
      [user.id],
    )
  ).rows;
  return { reclamos: rows.map(ticket) };
}

// POST /api/reclamos/presentar {id, datos, fundamento} → el borrador pasa a RECIBIDO (visible en la bandeja de la Oficina).
export async function presentar(user, body) {
  const r = await reclamoDe(user.id, Number(body?.id));
  if (r.estado !== "borrador") return { reclamo: ticket(r) };
  const d = body?.datos || {};
  const limpio = (v, n = 120) => String(v ?? "").slice(0, n);
  const datos = {
    ...r.datos,
    tipo: limpio(d.tipo, 60), entidad: limpio(d.entidad), monto: limpio(d.monto, 40), fecha: limpio(d.fecha, 20),
    operacion: limpio(d.operacion, 60), categoria: limpio(d.categoria, 30) || r.datos.categoria || "BANCOS", resumen: limpio(d.resumen, 200),
  };
  if (!datos.entidad || !datos.tipo) throw new HttpError(400, "datos_incompletos", "Faltan datos del reclamo (entidad y tipo).");
  const u = (
    await q(
      `UPDATE reclamos SET estado = 'recibido', activa = false, datos = $3, fundamento = $4, presentado_at = now(), updated_at = now()
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      [r.id, user.id, datos, limpio(body?.fundamento, 4000)],
    )
  ).rows[0];
  return { reclamo: ticket(u) };
}

// Puntaje de prioridad con las reglas configurables (src/mock/reglasPrioridad.json). No usa IA.
function puntaje(t, c, patron) {
  const reglas = [];
  if (t.tipo === "cobranza-abusiva" || c.urgencia) reglas.push(["urg-embargo", 15]);
  if (c.edad >= 65) reglas.push(["vuln-edad", 10]);
  if (c.ingresoBajo) reglas.push(["vuln-ingreso", 8]);
  if (c.ingresoMensual && t.monto > 0.3 * c.ingresoMensual) reglas.push(["monto-ingreso", 7]);
  if (c.centralDeudores >= 3) reglas.push(["central-deudores", 6]);
  if (patron) reglas.push(["patron", 4]);
  const total = reglas.reduce((a, [, p]) => a + p, 0);
  return { total, reglas: reglas.map(([id]) => id) };
}

const iniciales = (n) => String(n || "").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join("") || "—";

// Panel de la Oficina del Consumidor (rol "entidad" = la oficina).
// - Casos demo: siempre visibles, marcados demo.
// - Reclamos reales: todas las cuentas de Oficina (rol entidad). Si OFICINA_CUITS está definido, sólo esos CUIT
//   (o users.entidad_id = 'oficina-rosario') ven los reales; el resto ve sólo la demo.
// Del vecino nunca se muestra DNI ni email: sólo iniciales, distrito y datos declarados.
export function oficinaHabilitada(user) {
  const cuits = String(process.env.OFICINA_CUITS || "").split(/[\s,;]+/).filter(Boolean);
  return cuits.length === 0 || user.entidad_id === "oficina-rosario" || cuits.includes(user.doc_number);
}

export async function casosEntidad(user) {
  const real = oficinaHabilitada(user);
  const rows = (
    await q(
      `SELECT r.* FROM reclamos r
        WHERE r.estado NOT IN ('borrador', 'baja') AND (r.demo OR $1)
        ORDER BY r.presentado_at DESC LIMIT 500`,
      [real],
    )
  ).rows;
  const desde = Date.now() - 30 * 86400000;
  const cuenta = new Map();
  for (const r of rows) {
    if (new Date(r.presentado_at).getTime() < desde) continue;
    const k = `${r.demo}|${r.datos.entidad}|${r.datos.tipo}`;
    cuenta.set(k, (cuenta.get(k) || 0) + 1);
  }
  const casos = rows.map((r) => {
    const t = ticket(r);
    const c = r.datos.ciudadano || {};
    const patron = (cuenta.get(`${r.demo}|${r.datos.entidad}|${r.datos.tipo}`) || 0) >= 5;
    const p = puntaje(t, c, patron);
    const cerrado = r.estado === "resuelto";
    return {
      ...t,
      id: `CA-${t.id.slice(3)}`,
      reclamo: t.id,
      fecha: r.presentado_at,
      demo: r.demo,
      triage: cerrado ? "verde" : t.vencido || p.total >= 20 ? "rojo" : p.total >= 8 ? "amarillo" : "verde",
      ciudadano: {
        iniciales: iniciales(c.nombre),
        distrito: c.distrito || "Rosario",
        edad: c.edad ?? null,
        ingreso: c.ingreso || "No declarado",
      },
      puntaje: p,
      patron,
    };
  });
  return { casos, vinculada: real };
}

// Casos de ejemplo de Mirta (vecina demo) para "Ver un ejemplo" en Mis reclamos. Sólo lectura.
export async function demoVecino() {
  const rows = (
    await q(
      `SELECT r.* FROM reclamos r JOIN users u ON u.id = r.user_id
        WHERE r.demo AND u.doc_number = 'demo-mirta' ORDER BY r.presentado_at DESC`,
    )
  ).rows;
  return { reclamos: rows.map((r) => ({ ...ticket(r), demo: true })), vecina: "Mirta, 72 años" };
}
