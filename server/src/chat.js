import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";
import { q } from "./db.js";
import { getProvider } from "./ai/index.js";
import { HttpError } from "./auth.js";

const load = (f) => JSON.parse(readFileSync(join(config.dataDir, f), "utf8"));
const tipos = load("tiposConflicto.json");
const biblioteca = load("bibliotecaLegal.json");
const TIPO_IDS = tipos.map((t) => t.id);

const SYSTEM = `Sos la mesa de entrada de "Saldo a Favor", un defensor financiero vecinal de Rosario (Argentina).
Hablás como un despachante de confianza: frases cortas, español rioplatense (vos), lenguaje simple para adultos mayores, sin jerga legal, sin emojis.

Tu trabajo en este chat:
1. Escuchar qué le pasó al vecino con un banco, tarjeta o billetera virtual.
2. Clasificar el conflicto en UNO de estos tipos (campo "tipo", usá el id exacto):
${tipos.map((t) => `- ${t.id}: ${t.nombre}`).join("\n")}
3. Extraer del relato y, sobre todo, de la foto o PDF del resumen: entidad, monto (formato argentino, ej. 48.200,00), fecha (DD/MM/AAAA) y número de operación. Si un dato no aparece, dejalo vacío; nunca lo inventes.
4. Pedir lo que falte, de a una cosa por vez. Lo ideal es que suba una foto o PDF del resumen donde se vea el problema.

Reglas innegociables:
- No inventes leyes, artículos ni plazos. No cites normas en el chat: los derechos y la normativa los muestra la app después, desde una biblioteca legal validada.
- No prometas resultados. La escalera es: entidad (10 días hábiles para responder, BCRA) → BCRA → Oficina Municipal del Consumidor. COPREC no existe más: nunca lo menciones.
- Si el caso no es financiero o es grave (amenazas, violencia, estafa con denuncia penal), decí con amabilidad que la Oficina del Consumidor lo atiende en persona.
- No pidas claves, PIN, CVV, tokens ni datos de acceso al banco. Si el vecino los escribe, decile que no los comparta.
- Respondé siempre en el JSON pedido. "reply" es lo que ve el vecino (máximo 3 oraciones).
- "listo" = true solo cuando ya tenés tipo, entidad y monto (idealmente confirmados con el resumen). Cuando está listo, en "reply" decile que revise los datos con el botón de abajo.
- "pedir": "resumen" si necesitás la foto/PDF, "dato" si falta un dato puntual, "confirmar" si está listo, "nada" en otro caso.

Si la conversación recién empieza (sin mensajes del vecino), saludá y preguntale qué le pasó con el banco, la tarjeta o la billetera; puede escribir o mandar un audio.

Contexto (no lo cites, solo para entender los tipos): ${biblioteca.map((n) => n.nombre).join("; ")}.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "pedir", "listo", "datos"],
  properties: {
    reply: { type: "string" },
    pedir: { type: "string", enum: ["resumen", "dato", "confirmar", "nada"] },
    listo: { type: "boolean" },
    datos: {
      type: "object",
      additionalProperties: false,
      required: ["tipo", "entidad", "monto", "fecha", "operacion"],
      properties: {
        tipo: { type: "string", enum: ["", ...TIPO_IDS] },
        entidad: { type: "string" },
        monto: { type: "string" },
        fecha: { type: "string" },
        operacion: { type: "string" },
      },
    },
  },
};

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

async function logUse(userId, kind, provider, ok, usage) {
  await q(
    "INSERT INTO ai_requests (user_id, kind, provider, model, ok, tokens_in, tokens_out) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [userId, kind, provider.name, provider.model, ok, usage?.in ?? null, usage?.out ?? null],
  ).catch(() => {});
}

function buildMessages(history, attachment, provider) {
  const msgs = (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TEXT) }));

  if (attachment && attachment.dataUrl) {
    const dataUrl = String(attachment.dataUrl);
    const approxBytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    if (approxBytes > MAX_FILE_BYTES) throw new HttpError(413, "archivo_grande", "El archivo es muy grande (máx. 8 MB).");
    if (!provider.supportsFiles) throw new HttpError(400, "sin_archivos", "Este modelo todavía no puede leer archivos.");
    const name = String(attachment.name || "resumen").slice(0, 120);
    let part;
    if (IMG_RE.test(dataUrl)) part = { type: "image_url", image_url: { url: dataUrl } };
    else if (PDF_RE.test(dataUrl)) part = { type: "file", file: { filename: name.endsWith(".pdf") ? name : `${name}.pdf`, file_data: dataUrl } };
    else throw new HttpError(400, "archivo_invalido", "Subí una foto (JPG, PNG) o un PDF.");
    const text = "Te adjunto el resumen. Leelo y extraé los datos.";
    const last = msgs[msgs.length - 1];
    if (last && last.role === "user") {
      msgs[msgs.length - 1] = { role: "user", content: [{ type: "text", text: last.content || text }, part] };
    } else {
      msgs.push({ role: "user", content: [{ type: "text", text }, part] });
    }
  }
  return msgs;
}

export async function chat(user, body) {
  await checkQuota(user.id);
  const provider = getProvider();
  const messages = buildMessages(body?.messages, body?.attachment, provider);
  try {
    const { json, usage } = await provider.chatJson({ system: SYSTEM, messages, schema: SCHEMA });
    await logUse(user.id, "chat", provider, true, usage);
    providerOk();
    const datos = json.datos || {};
    if (!TIPO_IDS.includes(datos.tipo)) datos.tipo = "";
    const listo = Boolean(json.listo && datos.tipo && datos.entidad && datos.monto);
    return { reply: String(json.reply || "").slice(0, 1200), pedir: json.pedir || "nada", listo, datos };
  } catch (e) {
    await logUse(user.id, "chat", provider, false, null);
    if (e instanceof HttpError) throw e;
    console.error("[chat]", e.status || "", e.code || "", e.message);
    throw providerError(e, "chat");
  }
}

export async function transcribe(user, body) {
  await checkQuota(user.id);
  const provider = getProvider();
  const m = /^data:(audio\/[a-z0-9.+-]+)(;[^,]*)?;base64,(.*)$/i.exec(String(body?.dataUrl || ""));
  if (!m) throw new HttpError(400, "audio_invalido", "No pude leer el audio.");
  const buffer = Buffer.from(m[3], "base64");
  if (buffer.length > MAX_FILE_BYTES) throw new HttpError(413, "audio_largo", "El audio es muy largo.");
  const ext = m[1].includes("mp4") ? "mp4" : m[1].includes("ogg") ? "ogg" : m[1].includes("mpeg") ? "mp3" : "webm";
  try {
    const text = await provider.transcribe({ buffer, mime: m[1], filename: `audio.${ext}` });
    await logUse(user.id, "transcribe", provider, true, null);
    providerOk();
    return { text };
  } catch (e) {
    await logUse(user.id, "transcribe", provider, false, null);
    console.error("[transcribe]", e.status || "", e.code || "", e.message);
    throw providerError(e, "transcribe");
  }
}
