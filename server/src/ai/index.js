// Abstracción de proveedores de IA.
//   AI_PROVIDER=local        → Ollama nativo (Broly vía túnel): AI_LOCAL_BASE_URL=http://<host>:11435  AI_LOCAL_MODEL=<modelo>
//   AI_PROVIDER=local-openai → cualquier servidor compatible OpenAI (LM Studio, vLLM): AI_LOCAL_BASE_URL=http://<host>/v1
import { config } from "../config.js";
import { createOpenAICompatible } from "./openaiCompatible.js";
import { createOllama } from "./ollama.js";

const providers = {
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

let cached = null;
export function getProvider() {
  if (!cached) {
    const make = providers[config.ai.provider];
    if (!make) throw new Error(`AI_PROVIDER desconocido: ${config.ai.provider}`);
    cached = make();
  }
  return cached;
}
