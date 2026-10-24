import { config } from "./config.js";
import { q } from "./db.js";
import { getProvider } from "./ai/index.js";
import { getStt } from "./ai/stt.js";
import { HttpError } from "./auth.js";
import { SYSTEM, SCHEMA, TIPO_IDS } from "./prompt.js";
import { readPdf } from "./pdf.js";
import { borradorParaChat, mensajes, nro } from "./reclamos.js";

const MAX_HISTORY = 24;
const MAX_TEXT = 2000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const IMG_RE = /^data:(image\/(png|jpe?g|webp|gif));base64,/i;
const PDF_RE = /^data:application\/pdf;base64,/i;

// Último estado del proveedor, para /api/health (sin datos sensibles).
export const aiStatus = { ok: null, error: null, at: null };

// Traduce errores del proveedor a errores claros y distinguibles para la UI.
function providerError(e, kind) {
  aiStatus.ok = false;
  aiStatus.at = new Date().toISOString();
  const sinCredito = e.type === "insufficient_quota" || e.code === "insufficient_quota" || e.code === "credit_balance_exhausted";
  if (sinCredito) {
    aiStatus.error = "ia_sin_credito";
    return new HttpError(503, "ia_sin_credito", "El asistente está fuera de servicio por un momento (el proveedor de IA no tiene crédito). Ya lo estamos resolviendo; probá más tarde.");
  }
  if (e.offline) {
    aiStatus.error = "ia_offline";
    return new HttpError(503, "ia_offline", "El asistente está desconectado en este momento. Probá de nuevo en unos minutos.");
  }
  if (e.status === 429) {
    aiStatus.error = "ia_ocupada";
    return new HttpError(503, "ia_ocupada", "El asistente está muy ocupado. Esperá unos segundos y probá de nuevo.");
  }
  if (e.status === 401 || e.status === 403) {
    aiStatus.error = "ia_config";
    return new HttpError(503, "ia_config", "El asistente no está configurado correctamente. Ya lo estamos resolviendo.");
  }
  if (e.name === "TimeoutError" || e.name === "AbortError") {
    aiStatus.error = "ia_timeout";
    return new HttpError(504, "ia_timeout", "El asistente tardó demasiado. Probá de nuevo.");
  }
  aiStatus.error = "ia_no_disponible";
  return new HttpError(502, "ia_no_disponible", kind === "transcribe" ? "No pude entender el audio. Probá escribirlo." : "La IA no respondió. Probá de nuevo en un momento.");
}

function providerOk() {
  aiStatus.ok = true;
  aiStatus.error = null;
  aiStatus.at = new Date().toISOString();
}

async function checkQuota(userId) {
  const r = (
    await q(
      `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS h,
              count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS d
         FROM ai_requests WHERE user_id = $1`,
      [userId],
    )
  ).rows[0];
  if (r.h >= config.ai.chatPerHour || r.d >= config.ai.chatPerDay)
    throw new HttpError(429, "limite_ia", "Llegaste al límite de mensajes por ahora. Probá más tarde.");
}

async function logUse(userId, kind, provider, ok, usage, used) {
  await q(
    "INSERT INTO ai_requests (user_id, kind, provider, model, ok, tokens_in, tokens_out) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [userId, kind, used?.provider || provider.name, used?.model || provider.model, ok, usage?.in ?? null, usage?.out ?? null],
  ).catch(() => {});
}

// Lee el adjunto del turno actual: partes para el modelo (texto/imagenes) + metadatos y texto extraído para guardar.
async function readAttachment(attachment, provider) {
  const dataUrl = String(attachment.dataUrl);
  const approxBytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (approxBytes > MAX_FILE_BYTES) throw new HttpError(413, "archivo_grande", "El archivo es muy grande (máx. 8 MB).");
  if (!provider.supportsFiles) throw new HttpError(400, "sin_archivos", "Este modelo todavía no puede leer archivos.");
  const name = String(attachment.name || "adjunto").replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 80) || "adjunto";
  // Miniatura chica (la arma el navegador) sólo para volver a mostrar la burbuja; nunca el archivo completo.
  const prev = String(attachment.preview || "");
  const preview = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(prev) && prev.length < 160_000 ? prev : null;
  if (IMG_RE.test(dataUrl)) {
    return {
      meta: { name, tipo: "foto", bytes: approxBytes, preview },
      contexto: "",
      parts: [{ type: "text", text: `[Adjunto: foto "${name}". Leela y extraé los datos.]` }, { type: "image_url", image_url: { url: dataUrl } }],
    };
  }
  if (PDF_RE.test(dataUrl)) {
    // El PDF se lee en el servidor: texto si lo tiene; si es un escaneo, las primeras páginas como imágenes.
    let pdf;
    try {
      pdf = await readPdf(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
    } catch (e) {
      console.error("[pdf]", e.message);
      throw new HttpError(400, "pdf_invalido", "No pude abrir el PDF. Probá con una foto o captura del resumen.");
    }
    const meta = { name, tipo: "pdf", bytes: approxBytes, pages: pdf.pages };
    if (pdf.text) {
      return {
        meta,
        contexto: pdf.text.slice(0, 12_000),
        parts: [{ type: "text", text: `[Adjunto: PDF "${name}" (${pdf.pages} pág.). Texto:\n"""\n${pdf.text}\n"""]` }],
      };
    }
    if (pdf.images.length) {
      return {
        meta,
        contexto: "",
        parts: [
          { type: "text", text: `[Adjunto: PDF escaneado "${name}" (${pdf.pages} pág.; van las primeras ${pdf.images.length} como imagen). Leelo y extraé los datos.]` },
          ...pdf.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      };
    }
    throw new HttpError(400, "pdf_vacio", "El PDF parece vacío. Probá con una foto o captura del resumen.");
  }
  throw new HttpError(400, "archivo_invalido", "Subí una foto (JPG, PNG) o un PDF.");
}

// Texto de un mensaje guardado para el modelo. Los adjuntos viejos van como lo que se extrajo de ellos.
function asContent(m, recortar) {
  let t = m.text || "";
  if (m.kind === "audio") t = `(audio transcripto) ${t}`;
  if (m.adjunto) {
    const ctx = String(m.contexto || "").slice(0, recortar ? 1500 : 12_000);
    const tipo = m.adjunto.tipo === "pdf" ? `PDF "${m.adjunto.name}"${m.adjunto.pages ? ` (${m.adjunto.pages} pág.)` : ""}` : `foto "${m.adjunto.name}"`;
    t = `${t ? t + "\n" : ""}[Adjunto anterior: ${tipo}. ${ctx ? `Contenido extraído: ${ctx}` : "Sin contenido extraído."}]`;
  }
  return t.slice(0, recortar ? 2500 : 14_000);
}

const BUDGET = 16_000; // caracteres de historial (aprox. 4-5 mil tokens); lo más viejo queda en la memoria.

function buildContext(rows, current) {
  const out = [];
  let used = 0;
  let omitidos = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = rows[i];
    const c = asContent(m, rows.length - i > 6);
    if (used + c.length > BUDGET && out.length >= 2) {
      omitidos = i + 1;
      break;
    }
    used += c.length;
    out.unshift({ role: m.role, content: c });
  }
  if (out.length && out[0].role === "assistant") out.shift(); // que arranque con el vecino
  if (current) out.push(current);
  return { messages: out, omitidos };
}

function systemFor(reclamo, omitidos) {
  const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" });
  const d = reclamo.datos || {};
  const datos = ["tipo", "entidad", "monto", "fecha", "operacion"].map((k) => `${k}: ${d[k] || "—"}`).join(" · ");
  return `${SYSTEM}

Fecha de hoy: ${hoy}. Si el vecino da una fecha sin año, asumí el año en curso o el anterior según corresponda; no inventes años.

MEMORIA DEL CASO (de los turnos anteriores; actualizala en "memoria"):
${reclamo.memoria || "(todavía vacía: es el primer mensaje del vecino)"}

DATOS YA EXTRAÍDOS: ${datos}${omitidos ? `\n(Hay ${omitidos} mensajes anteriores que no van completos: lo importante está en la memoria.)` : ""}`;
}

const SIN_VALOR = (v) => !v || /^(-|—|n\/?a|desconocido|no informado)$/i.test(String(v).trim());

export async function chat(user, body) {
  const provider = getProvider();
  const text = String(body?.text ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, MAX_TEXT);
  const att = body?.attachment?.dataUrl ? body.attachment : null;
  const reintentar = Boolean(body?.reintentar);
  // Sin mensaje del vecino no se llama a la IA (el saludo es fijo, lo muestra la app).
  if (!text && !att && !reintentar) throw new HttpError(400, "mensaje_vacio", "Escribí, grabá un audio o subí el resumen.");
  await checkQuota(user.id);
  const reclamo = await borradorParaChat(user.id, body?.reclamoId);
  const read = att ? await readAttachment(att, provider) : null;

  let current = null;
  let userMsgId = null;
  const previos = await mensajes(reclamo.id);
  if (reintentar) {
    const last = previos[previos.length - 1];
    if (!last || last.role !== "user") throw new HttpError(409, "nada_que_reintentar", "No hay nada pendiente de respuesta.");
  } else {
    const audio = body?.audio && Number(body.audio.seg) > 0 ? { seg: Math.min(600, Math.round(Number(body.audio.seg))) } : null;
    const kind = read ? "archivo" : audio ? "audio" : "texto";
    const adjunto = read ? read.meta : audio;
    userMsgId = (
      await q("INSERT INTO reclamo_mensajes (reclamo_id, role, kind, text, adjunto, contexto) VALUES ($1,'user',$2,$3,$4,$5) RETURNING id", [
        reclamo.id, kind, text, adjunto, read?.contexto || null,
      ])
    ).rows[0].id;
    const t = kind === "audio" ? `(audio transcripto) ${text}` : text;
    current = read ? { role: "user", content: [...(t ? [{ type: "text", text: t }] : []), ...read.parts] } : { role: "user", content: t };
  }
  const { messages, omitidos } = buildContext(previos, current);

  try {
    const r = await provider.chatJson({ system: systemFor(reclamo, omitidos), messages, schema: SCHEMA });
    const { json, usage } = r;
    await logUse(user.id, "chat", provider, true, usage, r);
    providerOk();
    const used = r.provider || provider.name;
    const model = r.model || provider.model;
    console.log(`[chat] respondió ${used} (${model}) · reclamo ${reclamo.id} · ${messages.length} msjs en contexto${omitidos ? `, ${omitidos} resumidos` : ""}`);
    // Datos: lo nuevo pisa a lo viejo sólo si trae un valor real.
    const nuevos = json.datos || {};
    const datos = { ...reclamo.datos };
    for (const k of ["tipo", "entidad", "monto", "fecha", "operacion"]) if (!SIN_VALOR(nuevos[k])) datos[k] = String(nuevos[k]).slice(0, 120);
    if (datos.tipo && !TIPO_IDS.includes(datos.tipo)) delete datos.tipo;
    const listo = Boolean(json.listo && datos.tipo && datos.entidad && datos.monto);
    const memoria = String(json.memoria || "").trim().slice(0, 2500) || reclamo.memoria;
    const reply = String(json.reply || "").slice(0, 1200);
    const nota = String(json.nota_adjunto || "").trim().slice(0, 1500);
    if (read && userMsgId && nota) {
      await q("UPDATE reclamo_mensajes SET contexto = CASE WHEN coalesce(contexto,'') = '' THEN $2 ELSE $2 || E'\\n---\\n' || contexto END WHERE id = $1", [userMsgId, nota]);
    }
    await q("INSERT INTO reclamo_mensajes (reclamo_id, role, kind, text, provider, model) VALUES ($1,'assistant','texto',$2,$3,$4)", [reclamo.id, reply, used, model]);
    await q("UPDATE reclamos SET datos = $2, memoria = $3, listo = $4, updated_at = now() WHERE id = $1", [reclamo.id, datos, memoria, listo]);
    const ia = { xai: "Grok", local: "Qwen", openai: "OpenAI" }[used] || "IA";
    return {
      reply, pedir: json.pedir || "nada", listo,
      datos: { tipo: datos.tipo || "", entidad: datos.entidad || "", monto: datos.monto || "", fecha: datos.fecha || "", operacion: datos.operacion || "" },
      provider: used, ia, reclamo: { dbId: Number(reclamo.id), id: nro(reclamo) },
    };
  } catch (e) {
    await logUse(user.id, "chat", provider, false, null);
    // Un adjunto que no se pudo leer no queda guardado (sin el archivo no se puede reintentar): se vuelve a subir.
    if (read && userMsgId) await q("DELETE FROM reclamo_mensajes WHERE id = $1", [userMsgId]).catch(() => {});
    if (e instanceof HttpError) throw e;
    console.error("[chat]", e.status || "", e.code || "", e.message);
    const err = providerError(e, "chat");
    err.extra = { ...(err.extra || {}), reclamo: { dbId: Number(reclamo.id), id: nro(reclamo) }, reintentable: !read };
    throw err;
  }
}

export async function transcribe(user, body) {
  const stt = getStt();
  if (!stt.available)
    throw new HttpError(503, "audio_no_disponible", "No pude escuchar el audio. Probá de nuevo o escribilo.");
  await checkQuota(user.id);
  const m = /^data:(audio\/[a-z0-9.+-]+)(;[^,]*)?;base64,(.*)$/i.exec(String(body?.dataUrl || ""));
  if (!m) throw new HttpError(400, "audio_invalido", "No pude leer el audio.");
  const buffer = Buffer.from(m[3], "base64");
  if (buffer.length < 500) throw new HttpError(400, "audio_vacio", "El audio quedó vacío. Mantené apretado un poco más y hablá cerca del micrófono.");
  if (buffer.length > MAX_FILE_BYTES) throw new HttpError(413, "audio_largo", "El audio es muy largo.");
  const mime = m[1].toLowerCase();
  const ext = /mp4|m4a|aac/.test(mime) ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : mime.includes("wav") ? "wav" : "webm";
  try {
    const r = await stt.transcribe({ buffer, mime, filename: `audio.${ext}` });
    await logUse(user.id, "transcribe", { name: r.provider, model: r.model }, true, null);
    return { text: r.text, stt: r.provider, ms: r.ms };
  } catch (e) {
    await logUse(user.id, "transcribe", { name: stt.names.join(","), model: null }, false, null);
    console.error("[transcribe]", e.message);
    throw new HttpError(503, "audio_no_disponible", "No pude escuchar el audio en este momento. Probá de nuevo o escribilo.");
  }
}
