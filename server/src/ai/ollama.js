// Proveedor nativo de Ollama (/api/chat). Lo usamos para el modelo local de Broly, que llega
// a este servidor por un túnel SSH inverso (ver AGENTS.md → "IA local (Broly)").
// - think:false y además limpiamos cualquier <think>…</think> que se cuele.
// - Las fotos van como `images` (base64) al modelo de visión; PDF y audio no están soportados.

const THINK_RE = /<think>[\s\S]*?(<\/think>|$)/gi;

export function stripThink(s) {
  return String(s ?? "").replace(THINK_RE, "").trim();
}

function parseJson(content) {
  const clean = stripThink(content);
  try {
    return JSON.parse(clean);
  } catch {
    const a = clean.indexOf("{");
    const b = clean.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(clean.slice(a, b + 1));
    throw new Error("respuesta no es JSON");
  }
}

// Convierte mensajes estilo OpenAI (content string o partes) al formato de Ollama.
function toOllama(messages) {
  let hasImages = false;
  const out = messages.map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    const text = m.content.filter((p) => p.type === "text").map((p) => p.text).join("\n");
    const images = m.content
      .filter((p) => p.type === "image_url")
      .map((p) => String(p.image_url?.url || "").replace(/^data:[^,]*,/, ""));
    if (images.length) hasImages = true;
    return images.length ? { role: m.role, content: text, images } : { role: m.role, content: text };
  });
  return { out, hasImages };
}

function offline(e) {
  const err = new Error(`ollama offline: ${e?.cause?.code || e?.message || "sin conexión"}`);
  err.offline = true;
  return err;
}

export function createOllama({ name = "local", baseUrl, model, visionModel, keepAlive = "30m", timeoutMs = 120_000, numCtx = 8192 }) {
  const root = baseUrl.replace(/\/$/, "").replace(/\/v1$/, "");

  async function post(path, body, ms) {
    let res;
    try {
      res = await fetch(`${root}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ms),
      });
    } catch (e) {
      if (e.name === "TimeoutError" || e.name === "AbortError") throw e;
      throw offline(e); // ECONNREFUSED / ECONNRESET: el túnel o Broly están caídos
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`${name} ${res.status}: ${data?.error || "error"}`);
      err.status = res.status;
      if (res.status === 502 || res.status === 503) err.offline = true;
      if (res.status === 404) err.status = 403; // modelo inexistente → error de configuración
      throw err;
    }
    return data;
  }

  async function chatJson({ system, messages, schema, temperature = 0.3 }) {
    const { out, hasImages } = toOllama(messages);
    const data = await post(
      "/api/chat",
      {
        model: hasImages ? visionModel || model : model,
        messages: [{ role: "system", content: system }, ...out],
        format: schema,
        think: false,
        stream: false,
        keep_alive: keepAlive,
        options: { temperature, num_ctx: numCtx },
      },
      timeoutMs,
    );
    return {
      json: parseJson(data.message?.content || "{}"),
      usage: { in: data.prompt_eval_count ?? null, out: data.eval_count ?? null },
    };
  }

  async function transcribe() {
    const err = new Error(`${name}: transcripción no disponible`);
    err.noAudio = true;
    throw err;
  }

  // Chequeo liviano para /api/health: ¿responde Ollama y está el modelo?
  async function ping() {
    try {
      const res = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return { ok: false, error: "ia_offline" };
      const names = ((await res.json()).models || []).map((m) => m.name);
      if (!names.includes(model)) return { ok: false, error: "ia_config" };
      return { ok: true, error: null };
    } catch {
      return { ok: false, error: "ia_offline" };
    }
  }

  return { name, model, supportsFiles: "images", audio: false, chatJson, transcribe, ping };
}
