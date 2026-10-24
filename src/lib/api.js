// Cliente del backend. El frontend NUNCA habla directo con la IA: todo pasa por /api.
async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* respuesta vacía */
  }
  if (!res.ok) {
    const err = new Error(data.message || "No pudimos conectar. Probá de nuevo.");
    err.status = res.status;
    err.code = data.error;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  me: () => call("/auth/me"),
  pedirCodigo: (role, doc, email) => call("/auth/request", { method: "POST", body: { role, doc, email } }),
  verificar: (role, doc, code) => call("/auth/verify", { method: "POST", body: { role, doc, code } }),
  salir: () => call("/auth/logout", { method: "POST" }),
  chat: (messages, attachment) => call("/chat", { method: "POST", body: { messages, attachment } }),
  transcribir: (dataUrl) => call("/transcribe", { method: "POST", body: { dataUrl } }),
};

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
