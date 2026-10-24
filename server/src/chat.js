import { config } from "./config.js";
import { q } from "./db.js";
import { getProvider } from "./ai/index.js";
import { HttpError } from "./auth.js";
import { SYSTEM, SCHEMA, TIPO_IDS } from "./prompt.js";
import { readPdf } from "./pdf.js";

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

async function buildMessages(history, attachment, provider) {
  const msgs = (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TEXT) }));

  if (attachment && attachment.dataUrl) {
    const dataUrl = String(attachment.dataUrl);
    const approxBytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    if (approxBytes > MAX_FILE_BYTES) throw new HttpError(413, "archivo_grande", "El archivo es muy grande (máx. 8 MB).");
    if (!provider.supportsFiles) throw new HttpError(400, "sin_archivos", "Este modelo todavía no puede leer archivos.");
    let parts;
    if (IMG_RE.test(dataUrl)) {
      parts = [{ type: "text", text: "Te adjunto el resumen. Leelo y extraé los datos." }, { type: "image_url", image_url: { url: dataUrl } }];
    } else if (PDF_RE.test(dataUrl)) {
      // El PDF se lee en el servidor: texto si lo tiene; si es un escaneo, las primeras páginas como imágenes.
      let pdf;
      try {
        pdf = await readPdf(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
      } catch (e) {
        console.error("[pdf]", e.message);
        throw new HttpError(400, "pdf_invalido", "No pude abrir el PDF. Probá con una foto o captura del resumen.");
      }
      if (pdf.text) {
        parts = [{ type: "text", text: `Te adjunto el resumen en PDF (${pdf.pages} pág.). Este es su texto; leelo y extraé los datos:\n"""\n${pdf.text}\n"""` }];
      } else if (pdf.images.length) {
        parts = [
          { type: "text", text: `Te adjunto el resumen en PDF escaneado (${pdf.pages} pág.; van las primeras ${pdf.images.length} como imagen). Leelo y extraé los datos.` },
          ...pdf.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ];
      } else throw new HttpError(400, "pdf_vacio", "El PDF parece vacío. Probá con una foto o captura del resumen.");
    } else throw new HttpError(400, "archivo_invalido", "Subí una foto (JPG, PNG) o un PDF.");
    const last = msgs[msgs.length - 1];
    if (last && last.role === "user") {
      msgs[msgs.length - 1] = { role: "user", content: [{ type: "text", text: last.content }, ...parts] };
    } else {
      msgs.push({ role: "user", content: parts });
    }
  }
  return msgs;
}

export async function chat(user, body) {
  await checkQuota(user.id);
  const provider = getProvider();
  const messages = await buildMessages(body?.messages, body?.attachment, provider);
  try {
    const r = await provider.chatJson({ system: SYSTEM, messages, schema: SCHEMA });
    const { json, usage } = r;
    await logUse(user.id, "chat", provider, true, usage, r);
    providerOk();
    const datos = json.datos || {};
    if (!TIPO_IDS.includes(datos.tipo)) datos.tipo = "";
    const listo = Boolean(json.listo && datos.tipo && datos.entidad && datos.monto);
    const used = r.provider || provider.name;
    console.log(`[chat] respondió ${used} (${r.model || provider.model})`);
    const ia = { xai: "Grok", local: "Qwen", openai: "OpenAI" }[used] || "IA";
    return { reply: String(json.reply || "").slice(0, 1200), pedir: json.pedir || "nada", listo, datos, provider: used, ia };
  } catch (e) {
    await logUse(user.id, "chat", provider, false, null);
    if (e instanceof HttpError) throw e;
    console.error("[chat]", e.status || "", e.code || "", e.message);
    throw providerError(e, "chat");
  }
}

export async function transcribe(user, body) {
  const provider = getProvider();
  if (provider.audio === false)
    throw new HttpError(501, "audio_no_disponible", "Por ahora no puedo escuchar audios. Escribime lo que pasó.");
  await checkQuota(user.id);
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
    if (e.noAudio) throw new HttpError(501, "audio_no_disponible", "Por ahora no puedo escuchar audios. Escribime lo que pasó.");
    console.error("[transcribe]", e.status || "", e.code || "", e.message);
    throw providerError(e, "transcribe");
  }
}
