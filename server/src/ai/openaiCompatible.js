// Proveedor genérico compatible con la API de OpenAI (/v1/chat/completions).
// Sirve para OpenAI y también para modelos locales (Ollama, LM Studio, vLLM) que exponen la misma API.

export function createOpenAICompatible({ name, baseUrl, apiKey, model, visionModel, transcribeModel, jsonMode = "schema", supportsFiles = true, timeoutMs = 60_000 }) {
  const root = baseUrl.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${apiKey}` };

  async function chatJson({ system, messages, schema, temperature = 0.3 }) {
    const hasImages = messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
    const body = {
      model: hasImages ? visionModel || model : model,
      temperature,
      messages: [{ role: "system", content: system }, ...messages],
      response_format:
        jsonMode === "schema"
          ? { type: "json_schema", json_schema: { name: "respuesta", strict: true, schema } }
          : { type: "json_object" },
    };
    const res = await fetch(`${root}/chat/completions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((e) => {
      if (e.name === "TimeoutError" || e.name === "AbortError") throw e;
      const err = new Error(`${name} sin conexión: ${e?.cause?.code || e.message}`);
      err.offline = true;
      throw err;
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data?.error === "string" ? data.error : data?.error?.message;
      const err = new Error(`${name} ${res.status}: ${String(msg || "error").slice(0, 200)}`);
      err.status = res.status;
      err.code = data?.error?.code || data?.code || null;
      err.type = data?.error?.type || null;
      throw err;
    }
    const content = String(data.choices?.[0]?.message?.content || "{}").replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
    return {
      json: JSON.parse(content),
      usage: { in: data.usage?.prompt_tokens ?? null, out: data.usage?.completion_tokens ?? null },
    };
  }

  async function transcribe({ buffer, mime, filename }) {
    if (!transcribeModel) {
      const err = new Error(`${name}: transcripción no disponible`);
      err.noAudio = true;
      throw err;
    }
    const form = new FormData();
    form.append("model", transcribeModel);
    form.append("language", "es");
    form.append("file", new Blob([buffer], { type: mime }), filename);
    const res = await fetch(`${root}/audio/transcriptions`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`${name} transcribe ${res.status}: ${data?.error?.message || "error"}`);
      err.status = res.status;
      err.code = data?.error?.code || null;
      err.type = data?.error?.type || null;
      throw err;
    }
    return String(data.text || "").trim();
  }

  // Chequeo liviano para /api/health (lista de modelos; no consume tokens). Se cachea 60 s.
  let last = null;
  async function ping() {
    if (last && Date.now() - last.t < 60_000) return last.r;
    let r;
    try {
      const res = await fetch(`${root}/models`, { headers, signal: AbortSignal.timeout(4000) });
      r = res.ok ? { ok: true, error: null } : { ok: false, error: res.status === 401 || res.status === 403 ? "ia_config" : res.status === 402 ? "ia_sin_credito" : "ia_no_disponible" };
    } catch {
      r = { ok: false, error: "ia_offline" };
    }
    last = { t: Date.now(), r };
    return r;
  }

  return { name, model, supportsFiles, audio: Boolean(transcribeModel), chatJson, transcribe, ping };
}
