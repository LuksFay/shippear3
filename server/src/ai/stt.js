// Voz a texto (STT), separado de la cadena de chat. Orden por defecto: xAI → whisper local.
//   xai     → POST https://api.x.ai/v1/stt (grok-voice-transcribe-2.0), con la misma XAI_API_KEY.
//             Acepta webm/opus (Chrome/Android), mp4/m4a/aac (Safari/iOS), ogg, mp3, wav.
//   whisper → servidor compatible OpenAI /v1/audio/transcriptions (faster-whisper en Broly vía
//             túnel): AI_WHISPER_URL=http://172.19.0.1:11436
//   openai  → OpenAI /audio/transcriptions (si hay OPENAI_API_KEY).
// Si un proveedor rechaza el formato (400/415/422) se reintenta una vez con el audio convertido
// a ogg/opus 16 kHz mono por ffmpeg (en el contenedor). La transcripción luego va al chat
// normal (Grok, con Qwen de respaldo).
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";

function offline(name, e) {
  const err = new Error(`${name} sin conexión: ${e?.cause?.code || e?.message}`);
  err.offline = true;
  return err;
}

async function postForm(name, url, form, { headers = {}, timeoutMs }) {
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: form, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      const err = new Error(`${name} tardó demasiado`);
      err.timeout = true;
      throw err;
    }
    throw offline(name, e);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : data?.error?.message || data?.detail || data?.message || "error";
    const err = new Error(`${name} stt ${res.status}: ${String(msg).slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return String(data.text || "").trim();
}

export function createXaiStt({ apiKey, model = "grok-voice-transcribe-2.0", timeoutMs = 30_000 }) {
  return {
    name: "xai",
    model,
    async transcribe({ buffer, mime, filename }) {
      const form = new FormData();
      form.append("model", model);
      form.append("language", "es");
      form.append("format", "true"); // números y montos escritos ("8500" en vez de "ocho mil quinientos")
      form.append("file", new Blob([buffer], { type: mime }), filename); // el archivo va último
      return postForm("xai", "https://api.x.ai/v1/stt", form, { headers: { Authorization: `Bearer ${apiKey}` }, timeoutMs });
    },
  };
}

export function createWhisperStt({ name = "whisper", baseUrl, model = "small", apiKey, timeoutMs = 90_000 }) {
  const root = baseUrl.replace(/\/$/, "").replace(/\/v1$/, "");
  return {
    name,
    model,
    async transcribe({ buffer, mime, filename }) {
      const form = new FormData();
      form.append("model", model);
      form.append("language", "es");
      form.append("response_format", "json");
      form.append("file", new Blob([buffer], { type: mime }), filename);
      return postForm(name, `${root}/v1/audio/transcriptions`, form, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, timeoutMs });
    },
    async ping() {
      try {
        const res = await fetch(`${root}/health`, { signal: AbortSignal.timeout(4000) });
        return { ok: res.ok, error: res.ok ? null : "stt_error" };
      } catch {
        return { ok: false, error: "ia_offline" };
      }
    },
  };
}

// ffmpeg: cualquier audio del navegador → ogg/opus 16 kHz mono. Usa archivos temporales (no pipes):
// el mp4/m4a de Safari puede traer el índice (moov) al final y por stdin no se puede leer.
export async function toOggOpus(buffer, timeoutMs = 20_000) {
  const dir = await mkdtemp(join(tmpdir(), "stt-"));
  const inp = join(dir, "in"), out = join(dir, "out.ogg");
  try {
    await writeFile(inp, buffer);
    await new Promise((resolve, reject) => {
      const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", inp, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "24k", out]);
      let err = "";
      const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
      p.stderr.on("data", (d) => (err += d));
      p.on("error", (e) => { clearTimeout(t); reject(e); });
      p.on("close", (code) => { clearTimeout(t); code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(0, 200)}`)); });
    });
    const buf = await readFile(out);
    if (buf.length < 500) throw new Error("ffmpeg: salida vacía");
    return buf;
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const FORMATO_RECHAZADO = new Set([400, 415, 422]);

export function createSttChain(list) {
  async function transcribe(args) {
    let lastErr = null;
    let converted = null;
    for (const [i, p] of list.entries()) {
      const t0 = Date.now();
      try {
        let text;
        try {
          text = await p.transcribe(converted || args);
        } catch (e) {
          if (converted || !FORMATO_RECHAZADO.has(e.status)) throw e;
          console.warn(`[stt] ${p.name} rechazó ${args.mime} (${e.status}); convierto con ffmpeg y reintento`);
          converted = { buffer: await toOggOpus(args.buffer), mime: "audio/ogg", filename: "audio.ogg" };
          text = await p.transcribe(converted);
        }
        console.log(`[stt] transcribió ${p.name} (${p.model}) en ${Date.now() - t0} ms${i > 0 ? " — respaldo" : ""}`);
        return { text, provider: p.name, model: p.model, ms: Date.now() - t0 };
      } catch (e) {
        lastErr = e;
        console.warn(`[stt] ${p.name} falló: ${String(e.message).slice(0, 200)}${i < list.length - 1 ? " → paso al siguiente" : ""}`);
      }
    }
    const err = new Error(`ningún STT respondió: ${lastErr?.message || "sin proveedores"}`);
    err.sttDown = true;
    throw err;
  }

  async function ping() {
    const providers = await Promise.all(
      list.map(async (p) => ({ name: p.name, model: p.model, ...(p.ping ? await p.ping() : { ok: null, error: null }) })),
    );
    return { audio: list.length > 0, providers };
  }

  return { names: list.map((p) => p.name), available: list.length > 0, transcribe, ping };
}

export function buildStt(names) {
  const make = {
    xai: () => (config.ai.xaiKey ? createXaiStt({ apiKey: config.ai.xaiKey, model: config.ai.xaiSttModel, timeoutMs: config.ai.sttTimeoutMs }) : null),
    whisper: () => (config.ai.whisperUrl ? createWhisperStt({ baseUrl: config.ai.whisperUrl, model: config.ai.whisperModel, timeoutMs: config.ai.whisperTimeoutMs }) : null),
    openai: () =>
      config.ai.openaiKey
        ? createWhisperStt({ name: "openai", baseUrl: "https://api.openai.com", model: config.ai.transcribeModel, apiKey: config.ai.openaiKey, timeoutMs: config.ai.sttTimeoutMs })
        : null,
  };
  const list = names
    .map((n) => {
      if (!make[n]) throw new Error(`AI_STT desconocido: ${n}`);
      return make[n]();
    })
    .filter(Boolean);
  return createSttChain(list);
}

let cached = null;
export function getStt() {
  if (!cached) cached = buildStt(config.ai.stt.split(",").map((x) => x.trim()).filter(Boolean));
  return cached;
}
