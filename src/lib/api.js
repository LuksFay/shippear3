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
  salud: () => call("/health"),
  me: () => call("/auth/me"),
  pedirCodigo: (role, doc, email) => call("/auth/request", { method: "POST", body: { role, doc, email } }),
  verificar: (role, doc, code) => call("/auth/verify", { method: "POST", body: { role, doc, code } }),
  salir: () => call("/auth/logout", { method: "POST" }),
  // El historial vive en el servidor: se manda sólo el mensaje nuevo (texto, audio transcripto o adjunto).
  chat: (body) => call("/chat", { method: "POST", body }),
  conversacion: (id) => call(`/conversacion${id ? `?id=${encodeURIComponent(id)}` : ""}`),
  nuevaConversacion: () => call("/conversacion/nueva", { method: "POST" }),
  reclamos: () => call("/reclamos"),
  presentar: (id, datos, fundamento) => call("/reclamos/presentar", { method: "POST", body: { id, datos, fundamento } }),
  casosEntidad: () => call("/entidad/casos"),
  ejemplo: () => call("/reclamos/ejemplo"),
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

// Miniatura JPEG chica (máx. 320 px) para volver a mostrar la foto al recargar; el original no se guarda.
export function miniatura(dataUrl, max = 320) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Hora 24 h (es-AR).
export const hora24 = (d = new Date()) =>
  new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
