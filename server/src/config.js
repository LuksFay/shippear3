// Configuración leída SOLO de variables de entorno (en el servidor: /opt/shippear/.env).
// Nunca commitear valores reales. Ver .env.example en la raíz del repo.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

export const config = {
  port: num(env.PORT, 3000),
  dataDir: env.DATA_DIR || resolve(here, "../../src/mock"),
  databaseUrl: env.DATABASE_URL || "",
  sessionSecret: env.SESSION_SECRET || "",
  cookieName: "saf_session",
  cookieSecure: env.COOKIE_SECURE !== "false",
  sessionDays: num(env.SESSION_DAYS, 30),
  tokenMinutes: num(env.LOGIN_TOKEN_MINUTES, 10),
  ai: {
    // "openai" (por defecto) o "local" (servidor compatible OpenAI: Ollama / LM Studio en Broly).
    provider: env.AI_PROVIDER || "openai",
    model: env.AI_MODEL || "gpt-4.1-mini",
    transcribeModel: env.AI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    openaiKey: env.OPENAI_API_KEY || "",
    localBaseUrl: env.AI_LOCAL_BASE_URL || "http://172.19.0.1:11435",
    localKey: env.AI_LOCAL_API_KEY || "local",
    localModel: env.AI_LOCAL_MODEL || "qwen3.5:4b",
    localVisionModel: env.AI_LOCAL_VISION_MODEL || "",
    localKeepAlive: env.AI_LOCAL_KEEP_ALIVE || "30m",
    localTimeoutMs: num(env.AI_LOCAL_TIMEOUT_MS, 120_000),
    chatPerHour: num(env.AI_CHAT_PER_HOUR, 40),
    chatPerDay: num(env.AI_CHAT_PER_DAY, 200),
  },
  smtp: {
    host: env.SMTP_HOST || "",
    port: num(env.SMTP_PORT, 587),
    user: env.SMTP_USER || "",
    pass: env.SMTP_PASS || "",
    rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    from: env.MAIL_FROM || '"Saldo a Favor" <saldoafavor@arcadeestudio.com>',
  },
  publicUrl: env.PUBLIC_URL || "https://shippear.arcadeestudio.com",
};

export function assertConfig() {
  const missing = [];
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (!config.sessionSecret || config.sessionSecret.length < 32) missing.push("SESSION_SECRET (>=32 chars)");
  if (!config.smtp.host) missing.push("SMTP_HOST");
  if (config.ai.provider === "openai" && !config.ai.openaiKey) missing.push("OPENAI_API_KEY");
  if (missing.length) console.warn(`[config] faltan variables: ${missing.join(", ")}`);
  if (!config.sessionSecret || config.sessionSecret.length < 32 || !config.databaseUrl)
    throw new Error("Configuración incompleta: SESSION_SECRET y DATABASE_URL son obligatorias");
}
