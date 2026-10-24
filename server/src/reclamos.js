// Reclamos persistidos: cada conversación del chat es un reclamo del vecino (borrador hasta presentarlo).
// TODA consulta filtra por user_id de la sesión: un usuario nunca ve ni toca reclamos ajenos.
import { pool, q } from "./db.js";
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
    editado: Boolean(r.editado_at),
    editadoAt: r.editado_at || null,
    fechaHecho: d.fecha || "",
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
        WHERE r.user_id = $1 AND r.estado <> 'baja' AND (r.estado <> 'borrador' OR EXISTS (SELECT 1 FROM reclamo_mensajes m WHERE m.reclamo_id = r.id))
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

// ─── Baja y edición (sólo el dueño; todo queda auditado en reclamo_versiones) ───

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const texto = (v, n) => String(v ?? "").replace(CONTROL, "").trim().slice(0, n);
// Campos que el vecino puede completar o corregir, con su validación.
const EDITABLES = {
  entidad: (v) => { const t = texto(v, 120); if (t.length < 2) throw new HttpError(400, "dato_invalido", "Poné el nombre del banco, tarjeta o billetera."); return t; },
  monto: (v) => { const t = texto(v, 40); if (t && !/^\$?\s*[\d.,]+$/.test(t)) throw new HttpError(400, "dato_invalido", "El monto tiene que ser un número (por ejemplo 12.500)."); return t; },
  fecha: (v) => { const t = texto(v, 40); if (t && !/^[\p{L}\d\s/.,-]+$/u.test(t)) throw new HttpError(400, "dato_invalido", "Revisá la fecha."); return t; },
  operacion: (v) => { const t = texto(v, 60); if (t && !/^[\p{L}\d\s#/._-]+$/u.test(t)) throw new HttpError(400, "dato_invalido", "El número de operación tiene caracteres raros."); return t; },
  resumen: (v) => texto(v, 400),
};
const ETIQUETA = { entidad: "Entidad", monto: "Monto", fecha: "Fecha", operacion: "N° de operación", resumen: "Resumen", estado: "Estado" };

async function versionar(c, r, user, accion, cambios) {
  const snapshot = { estado: r.estado, datos: r.datos, fundamento: r.fundamento };
  await c.query(
    `INSERT INTO reclamo_versiones (reclamo_id, version, accion, snapshot, cambios, user_id, user_role)
     VALUES ($1, (SELECT COALESCE(MAX(version), 0) + 1 FROM reclamo_versiones WHERE reclamo_id = $1), $2, $3, $4, $5, $6)`,
    [r.id, accion, snapshot, JSON.stringify(cambios), user.id, user.role],
  );
}

async function enTransaccion(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// POST /api/reclamos/baja {id, motivo?} → baja lógica: desaparece de Mis reclamos y de la bandeja; la fila queda.
export async function baja(user, body) {
  const id = Number(body?.id);
  if (!Number.isInteger(id)) throw new HttpError(400, "dato_invalido", "Falta el reclamo.");
  const motivo = texto(body?.motivo, 300);
  return enTransaccion(async (c) => {
    const r = (await c.query("SELECT * FROM reclamos WHERE id = $1 AND user_id = $2 AND NOT demo FOR UPDATE", [id, user.id])).rows[0];
    if (!r) throw new HttpError(404, "reclamo_no_encontrado", "No encontré ese reclamo.");
    if (r.estado === "baja") return { ok: true };
    await versionar(c, r, user, "baja", [{ campo: "estado", antes: r.estado, despues: "baja" }]);
    await c.query(
      "UPDATE reclamos SET estado_previo = estado, estado = 'baja', activa = false, baja_at = now(), baja_motivo = $3, updated_at = now() WHERE id = $1 AND user_id = $2",
      [id, user.id, motivo || null],
    );
    return { ok: true };
  });
}

// POST /api/reclamos/editar {id, datos:{entidad,monto,fecha,operacion,resumen}} → guarda la versión anterior y actualiza.
export async function editar(user, body) {
  const id = Number(body?.id);
  if (!Number.isInteger(id)) throw new HttpError(400, "dato_invalido", "Falta el reclamo.");
  const nuevos = body?.datos && typeof body.datos === "object" ? body.datos : {};
  return enTransaccion(async (c) => {
    const r = (await c.query("SELECT * FROM reclamos WHERE id = $1 AND user_id = $2 AND NOT demo FOR UPDATE", [id, user.id])).rows[0];
    if (!r) throw new HttpError(404, "reclamo_no_encontrado", "No encontré ese reclamo.");
    if (r.estado === "baja") throw new HttpError(409, "reclamo_de_baja", "Ese reclamo está dado de baja.");
    const datos = { ...(r.datos || {}) };
    const cambios = [];
    for (const [campo, validar] of Object.entries(EDITABLES)) {
      if (!(campo in nuevos)) continue;
      const v = validar(nuevos[campo]);
      const antes = String(datos[campo] ?? "");
      if (v !== antes) {
        cambios.push({ campo, antes, despues: v });
        datos[campo] = v;
      }
    }
    if (!cambios.length) return { reclamo: ticket(r), cambios: 0 };
    await versionar(c, r, user, "edicion", cambios);
    const u = (
      await c.query("UPDATE reclamos SET datos = $3, editado_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *", [id, user.id, datos])
    ).rows[0];
    return { reclamo: ticket(u), cambios: cambios.length };
  });
}

// GET /api/reclamos/historial?id= → versiones. Dueño (vecino) o la Oficina para reclamos visibles en su bandeja.
export async function historial(user, idParam) {
  const id = Number(idParam);
  if (!Number.isInteger(id)) throw new HttpError(400, "dato_invalido", "Falta el reclamo.");
  const r =
    user.role === "entidad"
      ? (await q("SELECT * FROM reclamos WHERE id = $1 AND estado NOT IN ('borrador', 'baja') AND (demo OR $2)", [id, oficinaHabilitada(user)])).rows[0]
      : (await q("SELECT * FROM reclamos WHERE id = $1 AND user_id = $2", [id, user.id])).rows[0];
  if (!r) throw new HttpError(404, "reclamo_no_encontrado", "No encontré ese reclamo.");
  const vs = (await q("SELECT version, accion, cambios, user_role, created_at FROM reclamo_versiones WHERE reclamo_id = $1 ORDER BY version DESC", [id])).rows;
  return {
    versiones: vs.map((v) => ({
      version: v.version,
      accion: v.accion,
      por: v.user_role === "entidad" ? "Oficina" : "Vecino/a",
      at: v.created_at,
      cambios: (v.cambios || []).map((x) => ({ campo: ETIQUETA[x.campo] || x.campo, antes: String(x.antes ?? ""), despues: String(x.despues ?? "") })),
    })),
  };
}
