// Abstracción de proveedores de IA. Para sumar un modelo local en Broly (Ollama / LM Studio):
//   AI_PROVIDER=local  AI_LOCAL_BASE_URL=http://<host>:11434/v1  AI_LOCAL_MODEL=<modelo>
import { config } from "../config.js";
import { createOpenAICompatible } from "./openaiCompatible.js";

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
    createOpenAICompatible({
      name: "local",
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
