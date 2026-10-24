import http from "node:http";
import { assertConfig, config } from "./config.js";
import { cleanup, migrate, q } from "./db.js";
import { listarAbogados, registrarAbogado } from "./abogados.js";
import { directorio } from "./entidades.js";
import { currentUser, HttpError, logout, publicUser, requestCode, sessionCookie, verifyCode } from "./auth.js";
import { aiStatus, chat, transcribe } from "./chat.js";
import { getStt } from "./ai/stt.js";
import { baja, casosEntidad, conversacion, demoVecino, editar, historial, listar, nueva, presentar } from "./reclamos.js";
import { seedDemo } from "./demo.js";
import { getProvider } from "./ai/index.js";

const MAX_BODY = 14.5 * 1024 * 1024; // por debajo del client_max_body_size 15m de nginx (varios adjuntos en base64)

function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, "muy_grande", "El envío es muy grande."));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "json_invalido", "Pedido inválido."));
      }
    });
    req.on("error", reject);
  });
}

function clientIp(req) {
  return String(req.headers["x-real-ip"] || req.socket.remoteAddress || "").slice(0, 64);
}

// El rol sale SIEMPRE de la sesión en el servidor (nunca del cliente).
async function requireUser(req, ...roles) {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, "sin_sesion", "Tenés que entrar con tu DNI o CUIT/CUIL.");
  if (roles.length && !roles.includes(u.role)) throw new HttpError(403, "rol_no_permitido", "Esta función no está disponible para tu tipo de usuario.");
  return u;
}

function sameOrigin(req) {
  // Defensa CSRF simple para métodos que modifican: si viene Origin, tiene que ser el nuestro.
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers["x-forwarded-host"] || req.headers.host);
  } catch {
    return false;
  }
}

const routes = {
  "GET /api/health": async () => {
    let db = false;
    try {
      await q("SELECT 1");
      db = true;
    } catch {}
    const p = getProvider();
    const stt = getStt();
    const ai = { provider: p.name, model: p.model, audio: stt.available, files: p.supportsFiles, ...aiStatus };
    if (p.ping) Object.assign(ai, await p.ping(), { at: new Date().toISOString() });
    ai.stt = await stt.ping();
    if (aiStatus.ok === false && ai.ok) ai.lastError = aiStatus.error; // último error real (sin secretos)
    return [db ? 200 : 503, { ok: db, db, ai, version: "0.4.0" }];
  },
  "POST /api/auth/request": async (req, body) => [200, await requestCode({ role: body.role, doc: body.doc ?? body.dni, email: body.email, ip: clientIp(req) })],
  "POST /api/auth/verify": async (req, body) => {
    const { cookie, user } = await verifyCode({ role: body.role, doc: body.doc ?? body.dni, code: body.code, ip: clientIp(req), userAgent: req.headers["user-agent"] });
    return [200, { ok: true, user }, { "Set-Cookie": sessionCookie(cookie, config.sessionDays * 86400) }];
  },
  "GET /api/auth/me": async (req) => {
    const u = await currentUser(req);
    return [200, { user: u ? publicUser(u) : null }];
  },
  "POST /api/auth/logout": async (req) => {
    await logout(req);
    return [200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) }];
  },
  // Reclamos con IA: sólo ciudadanos (vecino).
  "POST /api/chat": async (req, body) => [200, await chat(await requireUser(req, "vecino"), body)],
  "POST /api/transcribe": async (req, body) => [200, await transcribe(await requireUser(req, "vecino"), body)],
  // Historial persistido: la conversación activa (o ?id= para retomar un borrador propio).
  "GET /api/conversacion": async (req) => [200, await conversacion(await requireUser(req, "vecino"), new URL(req.url, "http://x").searchParams.get("id"))],
  "POST /api/conversacion/nueva": async (req) => [200, await nueva(await requireUser(req, "vecino"))],
  "GET /api/reclamos": async (req) => [200, await listar(await requireUser(req, "vecino"))],
  "POST /api/reclamos/presentar": async (req, body) => [200, await presentar(await requireUser(req, "vecino"), body)],
  // Baja lógica y edición: sólo el dueño (el servidor filtra por user_id); cada cambio queda en reclamo_versiones.
  "POST /api/reclamos/baja": async (req, body) => [200, await baja(await requireUser(req, "vecino"), body)],
  "POST /api/reclamos/editar": async (req, body) => [200, await editar(await requireUser(req, "vecino"), body)],
  "GET /api/reclamos/historial": async (req) => [200, await historial(await requireUser(req), new URL(req.url, "http://x").searchParams.get("id"))],
  // Panel de la entidad: sólo entidades, y sólo los reclamos presentados contra la entidad vinculada.
  "GET /api/entidad/perfil": async (req) => [200, { user: publicUser(await requireUser(req, "entidad")) }],
  "GET /api/reclamos/ejemplo": async (req) => [200, await demoVecino(await requireUser(req, "vecino"))],
  "POST /api/abogados": async (req, body) => [200, await registrarAbogado(body, clientIp(req))],
  "GET /api/entidad/directorio": async (req) => [200, await directorio(await requireUser(req, "entidad"), new URL(req.url, "http://x").searchParams)],
  "GET /api/entidad/abogados": async (req) => [200, await listarAbogados(await requireUser(req, "entidad"))],
  "GET /api/entidad/casos": async (req) => [200, await casosEntidad(await requireUser(req, "entidad"))],
};

const server = http.createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0];
  const handler = routes[`${req.method} ${path}`];
  try {
    if (!handler) throw new HttpError(404, "no_encontrado", "No encontrado.");
    if (req.method !== "GET" && !sameOrigin(req)) throw new HttpError(403, "origen", "Origen no permitido.");
    const body = req.method === "POST" ? await readJson(req) : {};
    const [status, data, headers] = await handler(req, body);
    send(res, status, data, headers);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.code, message: e.message, ...e.extra });
    console.error(`[api] ${req.method} ${path}:`, e.message);
    send(res, 500, { error: "interno", message: "Algo falló. Probá de nuevo." });
  }
});

assertConfig();
await migrate();
if (process.env.DEMO_SEED !== "0") await seedDemo();
setInterval(() => cleanup().catch(() => {}), 3_600_000).unref();
server.listen(config.port, () => console.log(`[api] escuchando en :${config.port} (IA: ${getProvider().name}/${getProvider().model})`));
