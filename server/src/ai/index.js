// Abstracción de proveedores de IA. AI_PROVIDER acepta una cadena separada por comas:
// se usa el primero y, si falla (sin crédito, 402/429, 5xx, timeout, key inválida, sin conexión),
// se pasa automáticamente al siguiente EN ESA MISMA consulta.
//   xai          → xAI Grok (compatible OpenAI, https://api.x.ai/v1), XAI_API_KEY
//   local        → Ollama nativo en Broly vía túnel: AI_LOCAL_BASE_URL=http://<host>:11435  AI_LOCAL_MODEL=<modelo>
//   openai       → OpenAI, OPENAI_API_KEY
//   local-openai → cualquier servidor compatible OpenAI (LM Studio, vLLM): AI_LOCAL_BASE_URL=http://<host>/v1
// Producción: AI_PROVIDER=xai,local
import { config } from "../config.js";
import { createOpenAICompatible } from "./openaiCompatible.js";
import { createOllama } from "./ollama.js";

const providers = {
  xai: () =>
    config.ai.xaiKey
      ? createOpenAICompatible({
          name: "xai",
          baseUrl: "https://api.x.ai/v1",
          apiKey: config.ai.xaiKey,
          model: config.ai.xaiModel,
          visionModel: config.ai.xaiVisionModel,
          transcribeModel: null,
          jsonMode: "schema",
          supportsFiles: "images",
          timeoutMs: config.ai.xaiTimeoutMs,
        })
      : null,
  openai: () =>
    createOpenAICompatible({
      name: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: config.ai.openaiKey,
      model: config.ai.model,
      transcribeModel: config.ai.transcribeModel,
      jsonMode: "schema",
      supportsFiles: true,
    }),
  local: () =>
    createOllama({
      name: "local",
      baseUrl: config.ai.localBaseUrl,
      model: config.ai.localModel,
      visionModel: config.ai.localVisionModel,
      keepAlive: config.ai.localKeepAlive,
      timeoutMs: config.ai.localTimeoutMs,
    }),
  "local-openai": () =>
    createOpenAICompatible({
      name: "local-openai",
      baseUrl: config.ai.localBaseUrl,
      apiKey: config.ai.localKey,
      model: config.ai.localModel,
      transcribeModel: null,
      jsonMode: "object",
      supportsFiles: false,
    }),
};

// Combina varios proveedores en uno: prueba en orden y cae al siguiente si uno falla.
export function createChain(list) {
  if (list.length === 1) return list[0];
  const files = list.some((p) => p.supportsFiles === true) ? true : list.some((p) => p.supportsFiles) ? "images" : false;

  async function chatJson(args) {
    let lastErr = null;
    for (const [i, p] of list.entries()) {
      try {
        const r = await p.chatJson(args);
        if (i > 0) console.warn(`[ai] respondió el respaldo ${p.name} (${p.model})`);
        return { ...r, provider: p.name, model: p.model };
      } catch (e) {
        lastErr = e;
        console.warn(`[ai] ${p.name} falló: ${e.status || ""} ${e.code || ""} ${String(e.message).slice(0, 160)}${i < list.length - 1 ? " → paso al siguiente" : ""}`);
      }
    }
    const err = new Error(`todos los proveedores fallaron: ${lastErr?.message || ""}`);
    err.offline = true;
    throw err;
  }

  async function transcribe(args) {
    const p = list.find((x) => x.audio);
    if (!p) {
      const err = new Error("transcripción no disponible");
      err.noAudio = true;
      throw err;
    }
    return p.transcribe(args);
  }

  async function ping() {
    const providers = await Promise.all(
      list.map(async (p) => ({ name: p.name, model: p.model, ...(p.ping ? await p.ping() : { ok: null, error: null }) })),
    );
    const ok = providers.some((p) => p.ok);
    return { ok, error: ok ? null : "ia_offline", providers };
  }

  return {
    name: list.map((p) => p.name).join(","),
    model: list[0].model,
    supportsFiles: files,
    audio: list.some((p) => p.audio),
    chatJson,
    transcribe,
    ping,
  };
}

export function buildProvider(names) {
  const list = names
    .map((n) => {
      const make = providers[n];
      if (!make) throw new Error(`AI_PROVIDER desconocido: ${n}`);
      const p = make();
      if (!p) console.warn(`[ai] ${n} sin configurar (falta la key), lo salteo`);
      return p;
    })
    .filter(Boolean);
  if (!list.length) throw new Error("AI_PROVIDER: ningún proveedor configurado");
  return createChain(list);
}

let cached = null;
export function getProvider() {
  if (!cached) cached = buildProvider(config.ai.provider.split(",").map((x) => x.trim()).filter(Boolean));
  return cached;
}
